import Stripe from 'stripe';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import BillingAccount from '../../auth/model/BillingAccount';
import Receipt from '../models/Receipt';
import { calculatePlanCycleAmount } from '../utils/billingPlanUtils';
import { buildSubscriptionReceiptQuery } from '../utils/subscriptionRevenue';

type UnmatchedChargeQuery = {
  month?: string;
  limit?: string;
  startingAfter?: string;
  customerId?: string;
};

export class UnmatchedStripeChargeHandler {
  private readonly stripe: Stripe;

  constructor(stripe?: Stripe) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripe && !stripeSecretKey) {
      throw new ErrorUtil('Stripe is not configured for unmatched charge reporting', 503);
    }

    this.stripe =
      stripe ??
      new Stripe(stripeSecretKey as string, {
        apiVersion: '2025-08-27.basil',
      });
  }

  public async getUnmatchedCharges(query: UnmatchedChargeQuery = {}, now: Date = new Date()) {
    const periodStart = this.resolveReportMonth(query.month, now);
    const periodEnd = this.addUtcMonths(periodStart, 1);
    const limit = this.resolveLimit(query.limit);
    const startingAfter = this.resolveStartingAfter(query.startingAfter);
    const customerIdFilter = this.resolveCustomerId(query.customerId);

    const subscriptionReceipts = await Receipt.find(
      buildSubscriptionReceiptQuery(periodStart, periodEnd, { successfulOnly: true, stripeOnly: true })
    )
      .select('processor.transactionId')
      .lean();

    const matchedTransactionIds = new Set(
      (subscriptionReceipts as any[])
        .map((receipt) => receipt.processor?.transactionId)
        .filter((transactionId): transactionId is string => Boolean(transactionId && transactionId !== 'N/A'))
    );

    let unmatchedPage: { charges: Stripe.Charge[]; nextCursor: string | null; hasMore: boolean };
    try {
      unmatchedPage = await this.listUnmatchedStripeCharges(
        periodStart,
        periodEnd,
        matchedTransactionIds,
        limit,
        startingAfter,
        customerIdFilter
      );
    } catch (error: any) {
      throw new ErrorUtil(`Unable to retrieve unmatched charges from Stripe: ${error.message}`, 502);
    }

    const chargeTransactionIds = unmatchedPage.charges.flatMap((charge) => {
      const paymentIntentId = this.stripeResourceId(charge.payment_intent);
      return paymentIntentId ? [charge.id, paymentIntentId] : [charge.id];
    });
    const customerIds = unmatchedPage.charges
      .map((charge) => this.stripeResourceId(charge.customer as any))
      .filter((customerId): customerId is string => Boolean(customerId));
    const customerEmails = unmatchedPage.charges
      .map((charge) => this.getChargeCustomerEmail(charge))
      .filter((email): email is string => Boolean(email));

    const [localReceipts, billingAccounts] = await Promise.all([
      chargeTransactionIds.length
        ? Receipt.find({
            'processor.name': 'stripe',
            'processor.transactionId': { $in: chargeTransactionIds },
          })
            .select(
              '_id billingAccountId status type amount currency description revenueCategory planInfo transactionDate processor.transactionId reconciliation'
            )
            .lean()
        : [],
      customerIds.length || customerEmails.length
        ? BillingAccount.find({
            $or: [
              ...(customerIds.length
                ? [
                    { customerId: { $in: customerIds } },
                    { 'paymentProcessorData.stripe.customer.id': { $in: customerIds } },
                  ]
                : []),
              ...(customerEmails.length ? [{ email: { $in: customerEmails } }] : []),
            ],
          })
            .select(
              '_id profileId email status processor customerId paymentProcessorData plan isYearly nextBillingDate vaulted needsUpdate pendingCancellation credits'
            )
            .populate('plan')
            .lean()
        : [],
    ]);

    const receiptsByTransactionId = new Map<string, any[]>();
    for (const receipt of localReceipts as any[]) {
      const transactionId = receipt.processor?.transactionId;
      if (!transactionId) continue;
      const receipts = receiptsByTransactionId.get(transactionId) ?? [];
      receipts.push(this.summarizeLocalReceipt(receipt));
      receiptsByTransactionId.set(transactionId, receipts);
    }

    const data = unmatchedPage.charges.map((charge) => {
      const paymentIntentId = this.stripeResourceId(charge.payment_intent);
      const customerId = this.stripeResourceId(charge.customer as any);
      const customerEmail = this.getChargeCustomerEmail(charge);
      const exactCustomerMatches = (billingAccounts as any[]).filter(
        (billing) => customerId && this.getBillingStripeCustomerId(billing) === customerId
      );
      const exactBillingIds = new Set(exactCustomerMatches.map((billing) => String(billing._id)));
      const emailMatches = (billingAccounts as any[]).filter(
        (billing) =>
          customerEmail &&
          String(billing.email).toLowerCase() === customerEmail &&
          !exactBillingIds.has(String(billing._id))
      );
      const localReceiptMatches = [
        ...(receiptsByTransactionId.get(charge.id) ?? []),
        ...(paymentIntentId ? receiptsByTransactionId.get(paymentIntentId) ?? [] : []),
      ].filter(
        (receipt, index, receipts) =>
          receipts.findIndex((candidate) => candidate.receiptId === receipt.receiptId) === index
      );

      return {
        stripe: this.summarizeStripeCharge(charge),
        localAssociations: {
          receipts: localReceiptMatches,
          exactCustomerBillingAccounts: exactCustomerMatches.map((billing) =>
            this.summarizeBillingAccount(billing, charge.amount_captured)
          ),
          emailCandidateBillingAccounts: emailMatches.map((billing) =>
            this.summarizeBillingAccount(billing, charge.amount_captured)
          ),
        },
        assessment: this.assessUnmatchedCharge(
          localReceiptMatches.length,
          exactCustomerMatches.length,
          emailMatches.length
        ),
      };
    });

    return {
      generatedAt: now.toISOString(),
      timezone: 'UTC',
      period: this.period(periodStart, periodEnd),
      filters: {
        month: this.formatUtcMonth(periodStart),
        customerId: customerIdFilter ?? null,
      },
      pagination: {
        limit,
        nextCursor: unmatchedPage.nextCursor,
        hasMore: unmatchedPage.hasMore,
      },
      data,
    };
  }

  private async listUnmatchedStripeCharges(
    start: Date,
    end: Date,
    matchedTransactionIds: Set<string>,
    limit: number,
    startingAfter?: string,
    customerId?: string
  ): Promise<{ charges: Stripe.Charge[]; nextCursor: string | null; hasMore: boolean }> {
    const charges: Stripe.Charge[] = [];
    let cursor = startingAfter;
    let hasMoreStripeRecords = true;

    while (charges.length < limit && hasMoreStripeRecords) {
      const page = await this.stripe.charges.list({
        created: { gte: this.toUnixSeconds(start), lt: this.toUnixSeconds(end) },
        limit: 100,
        starting_after: cursor,
        customer: customerId,
        expand: ['data.balance_transaction', 'data.customer', 'data.payment_intent'],
      });

      for (let index = 0; index < page.data.length; index += 1) {
        const charge = page.data[index];
        cursor = charge.id;
        const paymentIntentId = this.stripeResourceId(charge.payment_intent);
        const isUnmatched =
          charge.status === 'succeeded' &&
          !matchedTransactionIds.has(charge.id) &&
          (!paymentIntentId || !matchedTransactionIds.has(paymentIntentId));

        if (isUnmatched) charges.push(charge);

        if (charges.length === limit) {
          const hasUninspectedRecords = index < page.data.length - 1 || page.has_more;
          return {
            charges,
            nextCursor: hasUninspectedRecords ? cursor : null,
            hasMore: hasUninspectedRecords,
          };
        }
      }

      hasMoreStripeRecords = page.has_more;
      if (page.data.length === 0) break;
    }

    return { charges, nextCursor: null, hasMore: false };
  }

  private summarizeStripeCharge(charge: Stripe.Charge) {
    const customer = charge.customer && typeof charge.customer !== 'string' ? (charge.customer as any) : null;
    const paymentIntent =
      charge.payment_intent && typeof charge.payment_intent !== 'string'
        ? (charge.payment_intent as Stripe.PaymentIntent)
        : null;
    const balanceTransaction =
      charge.balance_transaction && typeof charge.balance_transaction !== 'string'
        ? (charge.balance_transaction as Stripe.BalanceTransaction)
        : null;
    const card = charge.payment_method_details?.card;
    const invoiceId = this.stripeResourceId((charge as any).invoice);

    return {
      chargeId: charge.id,
      paymentIntentId: this.stripeResourceId(charge.payment_intent),
      createdAt: new Date(charge.created * 1000).toISOString(),
      livemode: charge.livemode,
      status: charge.status,
      paid: charge.paid,
      captured: charge.captured,
      disputed: charge.disputed,
      refunded: charge.refunded,
      amount: this.centsToMoney(charge.amount),
      amountCaptured: this.centsToMoney(charge.amount_captured),
      amountRefunded: this.centsToMoney(charge.amount_refunded),
      currency: charge.currency.toUpperCase(),
      description: charge.description,
      statementDescriptor: charge.statement_descriptor,
      receiptUrl: charge.receipt_url,
      invoiceId,
      paymentMethodId: this.stripeResourceId(charge.payment_method as any),
      customer: {
        id: this.stripeResourceId(charge.customer as any),
        deleted: Boolean(customer?.deleted),
        name: customer?.deleted ? null : customer?.name ?? charge.billing_details?.name ?? null,
        email: customer?.deleted ? charge.billing_details?.email ?? null : customer?.email ?? charge.billing_details?.email ?? null,
        phone: customer?.deleted ? charge.billing_details?.phone ?? null : customer?.phone ?? charge.billing_details?.phone ?? null,
      },
      billingDetails: {
        name: charge.billing_details?.name ?? null,
        email: charge.billing_details?.email ?? null,
        phone: charge.billing_details?.phone ?? null,
        country: charge.billing_details?.address?.country ?? null,
        postalCode: charge.billing_details?.address?.postal_code ?? null,
      },
      paymentMethod: card
        ? {
            type: charge.payment_method_details?.type,
            brand: card.brand,
            last4: card.last4,
            funding: card.funding,
            country: card.country,
            expirationMonth: card.exp_month,
            expirationYear: card.exp_year,
            walletType: card.wallet?.type ?? null,
          }
        : { type: charge.payment_method_details?.type ?? null },
      recurringSignals: {
        invoiceId,
        initiatedBy: paymentIntent?.metadata?.initiated_by ?? charge.metadata?.initiated_by ?? null,
        storedCredentialIndicator:
          paymentIntent?.metadata?.stored_credential_indicator ??
          charge.metadata?.stored_credential_indicator ??
          null,
      },
      settlement: balanceTransaction
        ? {
            gross: this.centsToMoney(balanceTransaction.amount),
            fees: this.centsToMoney(balanceTransaction.fee),
            net: this.centsToMoney(balanceTransaction.net),
            availableOn: new Date(balanceTransaction.available_on * 1000).toISOString(),
          }
        : null,
      outcome: charge.outcome
        ? {
            networkStatus: charge.outcome.network_status,
            riskLevel: charge.outcome.risk_level,
            riskScore: charge.outcome.risk_score,
            sellerMessage: charge.outcome.seller_message,
            type: charge.outcome.type,
          }
        : null,
      metadata: {
        ...charge.metadata,
        ...(paymentIntent?.metadata ?? {}),
      },
    };
  }

  private summarizeLocalReceipt(receipt: any) {
    return {
      receiptId: String(receipt._id),
      billingAccountId: receipt.billingAccountId ? String(receipt.billingAccountId) : null,
      status: receipt.status,
      type: receipt.type,
      amount: this.asMoney(receipt.amount),
      currency: receipt.currency,
      description: receipt.description,
      revenueCategory: receipt.revenueCategory ?? null,
      reconciliation: receipt.reconciliation ?? null,
      planInfo: receipt.planInfo ?? null,
      transactionDate: receipt.transactionDate,
    };
  }

  private summarizeBillingAccount(billing: any, stripeAmountCapturedCents: number) {
    const isYearly = Boolean(billing.isYearly);
    const planCycleAmount = this.asMoney(calculatePlanCycleAmount(billing.plan, isYearly));
    const stripeAmount = this.centsToMoney(stripeAmountCapturedCents);

    return {
      billingAccountId: String(billing._id),
      profileId: billing.profileId ? String(billing.profileId) : null,
      email: billing.email,
      status: billing.status,
      processor: billing.processor,
      stripeCustomerId: this.getBillingStripeCustomerId(billing),
      plan: billing.plan
        ? {
            id: String(billing.plan._id),
            name: billing.plan.name,
            billingCycle: isYearly ? 'yearly' : 'monthly',
            expectedCycleAmount: planCycleAmount,
            differenceFromStripeCharge: this.asMoney(stripeAmount - planCycleAmount),
          }
        : null,
      nextBillingDate: billing.nextBillingDate ?? null,
      vaulted: Boolean(billing.vaulted),
      needsUpdate: Boolean(billing.needsUpdate),
      pendingCancellation: Boolean(billing.pendingCancellation),
      credits: this.asMoney(billing.credits ?? 0),
    };
  }

  private assessUnmatchedCharge(receiptMatches: number, exactCustomerMatches: number, emailMatches: number) {
    if (receiptMatches > 0) {
      return {
        category: 'local_non_subscription_receipt',
        explanation: 'The Stripe charge has a local receipt, but it was not classified as a successful subscription payment for this period.',
      };
    }
    if (exactCustomerMatches > 0) {
      return {
        category: 'stripe_customer_matches_billing_account',
        explanation: 'The Stripe customer is attached to a local billing account, but no successful subscription receipt matched this charge.',
      };
    }
    if (emailMatches > 0) {
      return {
        category: 'email_candidate_only',
        explanation: 'No Stripe customer ID matched locally, but one or more billing accounts use the same email address.',
      };
    }
    return {
      category: 'no_local_match',
      explanation: 'No local receipt, Stripe customer billing account, or email candidate was found for this charge.',
    };
  }

  private getBillingStripeCustomerId(billing: any): string | null {
    return billing.paymentProcessorData?.stripe?.customer?.id ?? billing.customerId ?? null;
  }

  private getChargeCustomerEmail(charge: Stripe.Charge): string | null {
    const customer = charge.customer && typeof charge.customer !== 'string' ? (charge.customer as any) : null;
    const email = (!customer?.deleted ? customer?.email : null) ?? charge.billing_details?.email;
    return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
  }

  private resolveReportMonth(month: string | undefined, now: Date): Date {
    if (!month) return this.startOfUtcMonth(now);
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!match) throw new ErrorUtil('month must use YYYY-MM format', 400);
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  }

  private resolveLimit(limit: string | undefined): number {
    if (!limit) return 25;
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new ErrorUtil('limit must be an integer between 1 and 100', 400);
    }
    return parsed;
  }

  private resolveStartingAfter(startingAfter: string | undefined): string | undefined {
    if (!startingAfter) return undefined;
    if (!startingAfter.startsWith('ch_')) {
      throw new ErrorUtil('startingAfter must be a Stripe charge ID', 400);
    }
    return startingAfter;
  }

  private resolveCustomerId(customerId: string | undefined): string | undefined {
    if (!customerId) return undefined;
    if (!customerId.startsWith('cus_')) {
      throw new ErrorUtil('customerId must be a Stripe customer ID', 400);
    }
    return customerId;
  }

  private stripeResourceId(resource: string | { id: string } | null): string | null {
    if (!resource) return null;
    return typeof resource === 'string' ? resource : resource.id;
  }

  private startOfUtcMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private addUtcMonths(date: Date, months: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  }

  private formatUtcMonth(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private period(start: Date, end: Date) {
    return { start: start.toISOString(), endExclusive: end.toISOString() };
  }

  private toUnixSeconds(date: Date): number {
    return Math.floor(date.getTime() / 1000);
  }

  private centsToMoney(cents: number): number {
    return this.asMoney(cents / 100);
  }

  private asMoney(amount: number): number {
    return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
  }
}
