import Stripe from 'stripe';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

export type StripeSubscriptionSummary = {
  grossCaptured: number;
  refunds: number;
  fees: number;
  netReceived: number;
  successfulPayments: number;
  failedChargeAttempts: number;
  unmatchedSuccessfulCharges: number;
  unmatchedSuccessfulAmount: number;
  missingBalanceTransactions: number;
  netIsEstimated: boolean;
  proratedGrossCaptured: number;
  proratedSuccessfulPayments: number;
};

export type StripeSubscriptionReconciliationResult = {
  summary: StripeSubscriptionSummary;
  matchedCharges: Stripe.Charge[];
  matchedRefunds: Stripe.Refund[];
};

export class StripeSubscriptionReconciliation {
  private readonly stripe: Stripe;

  constructor(stripe?: Stripe) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripe && !stripeSecretKey) {
      throw new ErrorUtil('Stripe is not configured for subscription revenue reporting', 503);
    }
    this.stripe =
      stripe ??
      new Stripe(stripeSecretKey as string, {
        apiVersion: '2025-08-27.basil',
      });
  }

  public async reconcilePeriod(
    start: Date,
    end: Date,
    subscriptionTransactionIds: Set<string>,
    prorationTransactionIds: Set<string> = new Set()
  ): Promise<StripeSubscriptionReconciliationResult> {
    try {
      const [charges, refunds] = await Promise.all([
        this.listCharges(start, end),
        this.listRefunds(start, end),
      ]);

      const matchedCharges = charges.filter(
        (charge) => charge.status === 'succeeded' && this.chargeMatches(charge, subscriptionTransactionIds)
      );
      const matchedPaymentIntentIds = new Set(
        matchedCharges
          .map((charge) => this.resourceId(charge.payment_intent))
          .filter((id): id is string => Boolean(id))
      );
      const matchedChargeIds = new Set(matchedCharges.map((charge) => charge.id));
      const matchedRefunds = refunds.filter((refund) => {
        const paymentIntentId = this.resourceId(refund.payment_intent);
        const chargeId = this.resourceId(refund.charge);
        return Boolean(
          (paymentIntentId &&
            (subscriptionTransactionIds.has(paymentIntentId) || matchedPaymentIntentIds.has(paymentIntentId))) ||
          (chargeId &&
            (subscriptionTransactionIds.has(chargeId) || matchedChargeIds.has(chargeId)))
        );
      });
      const proratedCharges = matchedCharges.filter((charge) => this.chargeMatches(charge, prorationTransactionIds));

      const grossCapturedCents = matchedCharges.reduce((sum, charge) => sum + charge.amount_captured, 0);
      const refundsCents = matchedRefunds.reduce((sum, refund) => sum + refund.amount, 0);
      const balanceTransactions = [
        ...matchedCharges.map((charge) => charge.balance_transaction),
        ...matchedRefunds.map((refund) => refund.balance_transaction),
      ];
      const expandedBalanceTransactions = balanceTransactions.filter(
        (transaction): transaction is Stripe.BalanceTransaction =>
          Boolean(transaction && typeof transaction !== 'string')
      );
      const missingBalanceTransactions = balanceTransactions.length - expandedBalanceTransactions.length;
      const netReceivedCents = expandedBalanceTransactions.reduce((sum, transaction) => sum + transaction.net, 0);
      const feesCents = grossCapturedCents - refundsCents - netReceivedCents;
      const unmatchedCharges = charges.filter(
        (charge) => charge.status === 'succeeded' && !this.chargeMatches(charge, subscriptionTransactionIds)
      );

      return {
        summary: {
          grossCaptured: this.centsToMoney(grossCapturedCents),
          refunds: this.centsToMoney(refundsCents),
          fees: this.centsToMoney(missingBalanceTransactions === 0 ? feesCents : 0),
          netReceived: this.centsToMoney(
            missingBalanceTransactions === 0 ? netReceivedCents : grossCapturedCents - refundsCents
          ),
          successfulPayments: matchedCharges.length,
          failedChargeAttempts: charges.filter((charge) => charge.status === 'failed').length,
          unmatchedSuccessfulCharges: unmatchedCharges.length,
          unmatchedSuccessfulAmount: this.centsToMoney(
            unmatchedCharges.reduce((sum, charge) => sum + charge.amount_captured, 0)
          ),
          missingBalanceTransactions,
          netIsEstimated: missingBalanceTransactions > 0,
          proratedGrossCaptured: this.centsToMoney(
            proratedCharges.reduce((sum, charge) => sum + charge.amount_captured, 0)
          ),
          proratedSuccessfulPayments: proratedCharges.length,
        },
        matchedCharges,
        matchedRefunds,
      };
    } catch (error: any) {
      if (error instanceof ErrorUtil) throw error;
      throw new ErrorUtil(`Unable to retrieve subscription revenue from Stripe: ${error.message}`, 502);
    }
  }

  private async listCharges(start: Date, end: Date): Promise<Stripe.Charge[]> {
    const charges: Stripe.Charge[] = [];
    let startingAfter: string | undefined;
    do {
      const page = await this.stripe.charges.list({
        created: { gte: this.toUnixSeconds(start), lt: this.toUnixSeconds(end) },
        limit: 100,
        starting_after: startingAfter,
        expand: ['data.balance_transaction'],
      });
      charges.push(...page.data);
      startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : undefined;
    } while (startingAfter);
    return charges;
  }

  private async listRefunds(start: Date, end: Date): Promise<Stripe.Refund[]> {
    const refunds: Stripe.Refund[] = [];
    let startingAfter: string | undefined;
    do {
      const page = await this.stripe.refunds.list({
        created: { gte: this.toUnixSeconds(start), lt: this.toUnixSeconds(end) },
        limit: 100,
        starting_after: startingAfter,
        expand: ['data.balance_transaction'],
      });
      refunds.push(...page.data);
      startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : undefined;
    } while (startingAfter);
    return refunds;
  }

  private chargeMatches(charge: Stripe.Charge, transactionIds: Set<string>): boolean {
    const paymentIntentId = this.resourceId(charge.payment_intent);
    return transactionIds.has(charge.id) || Boolean(paymentIntentId && transactionIds.has(paymentIntentId));
  }

  private resourceId(resource: string | { id: string } | null | undefined): string | null {
    if (!resource) return null;
    return typeof resource === 'string' ? resource : resource.id;
  }

  private toUnixSeconds(date: Date): number {
    return Math.floor(date.getTime() / 1000);
  }

  private centsToMoney(cents: number): number {
    return Math.round((cents / 100 + Number.EPSILON) * 100) / 100;
  }
}
