import Stripe from 'stripe';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import BillingAccount from '../../auth/model/BillingAccount';
import Receipt from '../models/Receipt';
import type { ReceiptRevenueCategory } from '../utils/subscriptionRevenue';

type StripePaymentBundle = {
  charge: Stripe.Charge;
  paymentIntent: Stripe.PaymentIntent | null;
  customer: Stripe.Customer | Stripe.DeletedCustomer | null;
  invoice: Stripe.Invoice | null;
  paymentMethod: Stripe.PaymentMethod | null;
  balanceTransaction: Stripe.BalanceTransaction | null;
};

type RevenueClassification = {
  category: ReceiptRevenueCategory;
  reason: string;
};

export class StripeReceiptRecoveryHandler {
  private readonly stripe: Stripe;

  constructor(stripe?: Stripe) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripe && !stripeSecretKey) {
      throw new ErrorUtil('Stripe is not configured for receipt recovery', 503);
    }

    this.stripe =
      stripe ??
      new Stripe(stripeSecretKey as string, {
        apiVersion: '2025-08-27.basil',
      });
  }

  public async recoverReceipt(stripeId: string, recoveredBy: string) {
    this.validateStripeId(stripeId);
    if (!recoveredBy) {
      throw new ErrorUtil('The authenticated administrator is required for receipt recovery', 401);
    }

    const bundle = await this.fetchStripePayment(stripeId);
    const { charge, paymentIntent } = bundle;
    if (charge.status !== 'succeeded' || !charge.paid || charge.amount_captured <= 0) {
      throw new ErrorUtil('Only successful, paid Stripe charges with a captured amount can be recovered', 400);
    }

    const paymentIntentId = paymentIntent?.id ?? this.stripeResourceId(charge.payment_intent);
    const existingReceipt = await this.findExistingReceipt(charge.id, paymentIntentId);
    if (existingReceipt) {
      return {
        created: false,
        receipt: existingReceipt,
        classification: this.classifyRevenue(bundle),
        message: 'This Stripe payment already has a local receipt',
      };
    }

    const customerId = this.stripeResourceId(charge.customer as any) ?? this.stripeResourceId(paymentIntent?.customer as any);
    if (!customerId) {
      throw new ErrorUtil('The Stripe payment does not identify a customer and cannot be attached safely', 422);
    }

    const billingAccounts = await BillingAccount.find({
      $or: [
        { customerId },
        { 'paymentProcessorData.stripe.customer.id': customerId },
      ],
    })
      .select(
        '_id profileId email status processor customerId paymentProcessorData plan isYearly nextBillingDate vaulted needsUpdate pendingCancellation payor'
      )
      .populate('plan')
      .populate('payor')
      .lean();

    if (billingAccounts.length === 0) {
      throw new ErrorUtil(`No local billing account is attached to Stripe customer ${customerId}`, 422);
    }
    if (billingAccounts.length > 1) {
      throw new ErrorUtil(`Stripe customer ${customerId} is attached to multiple local billing accounts`, 409);
    }

    const billing = billingAccounts[0] as any;
    const classification = this.classifyRevenue(bundle);
    const recovery = await this.createRecoveredReceipt(bundle, billing, classification, recoveredBy);

    return {
      created: recovery.created,
      receipt: recovery.receipt,
      classification,
      billingAccount: {
        billingAccountId: String(billing._id),
        profileId: billing.profileId ? String(billing.profileId) : null,
        status: billing.status,
        needsUpdate: Boolean(billing.needsUpdate),
        pendingCancellation: Boolean(billing.pendingCancellation),
        nextBillingDate: billing.nextBillingDate ?? null,
      },
      message: recovery.created
        ? 'Stripe payment receipt recovered successfully'
        : 'This Stripe payment already has a local receipt',
    };
  }

  private async fetchStripePayment(stripeId: string): Promise<StripePaymentBundle> {
    try {
      let charge: Stripe.Charge;
      let paymentIntent: Stripe.PaymentIntent | null = null;

      if (stripeId.startsWith('ch_')) {
        charge = await this.stripe.charges.retrieve(stripeId, {
          expand: ['balance_transaction', 'customer', 'payment_intent'],
        });
        paymentIntent =
          charge.payment_intent && typeof charge.payment_intent !== 'string'
            ? (charge.payment_intent as Stripe.PaymentIntent)
            : await this.safeRetrievePaymentIntent(this.stripeResourceId(charge.payment_intent));
      } else {
        paymentIntent = await this.stripe.paymentIntents.retrieve(stripeId, {
          expand: ['latest_charge.balance_transaction', 'latest_charge.customer'],
        });
        const latestCharge = paymentIntent.latest_charge;
        if (!latestCharge) {
          throw new ErrorUtil('The Stripe PaymentIntent has no charge to recover', 400);
        }
        charge =
          typeof latestCharge === 'string'
            ? await this.stripe.charges.retrieve(latestCharge, {
                expand: ['balance_transaction', 'customer', 'payment_intent'],
              })
            : (latestCharge as Stripe.Charge);
      }

      const invoiceId = this.stripeResourceId((charge as any).invoice) ?? this.stripeResourceId((paymentIntent as any)?.invoice);
      const paymentMethodId = this.stripeResourceId(charge.payment_method as any) ?? this.stripeResourceId(paymentIntent?.payment_method as any);
      const balanceTransactionId = this.stripeResourceId(charge.balance_transaction as any);
      const expandedCustomer = charge.customer && typeof charge.customer !== 'string' ? charge.customer : null;
      const expandedBalanceTransaction =
        charge.balance_transaction && typeof charge.balance_transaction !== 'string'
          ? charge.balance_transaction
          : null;

      const [customer, invoice, paymentMethod, balanceTransaction] = await Promise.all([
        expandedCustomer ?? this.safeRetrieveCustomer(this.stripeResourceId(charge.customer as any)),
        this.safeRetrieveInvoice(invoiceId),
        this.safeRetrievePaymentMethod(paymentMethodId),
        expandedBalanceTransaction ?? this.safeRetrieveBalanceTransaction(balanceTransactionId),
      ]);

      return {
        charge,
        paymentIntent,
        customer,
        invoice,
        paymentMethod,
        balanceTransaction,
      };
    } catch (error: any) {
      if (error instanceof ErrorUtil) throw error;
      if (error?.statusCode === 404 || error?.code === 'resource_missing') {
        throw new ErrorUtil(`Stripe payment ${stripeId} was not found`, 404);
      }
      throw new ErrorUtil(`Unable to retrieve Stripe payment data: ${error.message}`, 502);
    }
  }

  private async createRecoveredReceipt(
    bundle: StripePaymentBundle,
    billing: any,
    classification: RevenueClassification,
    recoveredBy: string
  ) {
    const { charge, paymentIntent, customer, invoice, paymentMethod, balanceTransaction } = bundle;
    const paymentIntentId = paymentIntent?.id ?? this.stripeResourceId(charge.payment_intent);
    const payor = billing.payor as any;
    const stripeCustomer = customer && !customer.deleted ? customer : null;
    const description =
      charge.description ??
      paymentIntent?.description ??
      invoice?.description ??
      `Recovered Stripe ${classification.category.replace(/_/g, ' ')} charge ${charge.id}`;
    const includePlan =
      Boolean(billing.plan) &&
      (classification.category === 'subscription' || classification.category === 'subscription_proration');

    const receiptData = {
      transactionId: `STRIPE_RECOVERY_${charge.id}`,
      billingAccountId: billing._id,
      userId: payor?._id ?? billing.payor,
      status: 'succeeded' as const,
      type: 'payment' as const,
      amount: this.centsToMoney(charge.amount_captured),
      currency: charge.currency.toUpperCase(),
      description,
      revenueCategory: classification.category,
      planInfo: includePlan
        ? {
            planId: billing.plan._id,
            planName: billing.plan.name,
            planPrice: Number(billing.plan.price),
            billingCycle: billing.isYearly ? 'yearly' : 'monthly',
          }
        : undefined,
      processor: {
        name: 'stripe',
        transactionId: paymentIntentId ?? charge.id,
        response: {
          source: 'stripe_receipt_recovery',
          classification,
          charge: this.toPlainObject(charge),
          paymentIntent: this.toPlainObject(paymentIntent),
          customer: this.toPlainObject(customer),
          invoice: this.toPlainObject(invoice),
          paymentMethod: this.toPlainObject(paymentMethod),
          balanceTransaction: this.toPlainObject(balanceTransaction),
        },
      },
      customer: {
        email: stripeCustomer?.email ?? charge.billing_details?.email ?? billing.email,
        name: this.firstNonEmpty([
          stripeCustomer?.name,
          charge.billing_details?.name,
          payor?.fullName,
          `${payor?.firstName ?? ''} ${payor?.lastName ?? ''}`,
        ]) ?? 'Unknown',
        phone: this.firstNonEmpty([
          stripeCustomer?.phone,
          charge.billing_details?.phone,
          payor?.phoneNumber,
        ]) ?? 'N/A',
      },
      transactionDate: new Date(charge.created * 1000),
      reconciliation: {
        source: 'stripe_recovery' as const,
        stripeChargeId: charge.id,
        stripePaymentIntentId: paymentIntentId,
        recoveredBy,
        recoveredAt: new Date(),
      },
    };

    try {
      return { receipt: await Receipt.create(receiptData), created: true };
    } catch (error: any) {
      if (error?.code === 11000) {
        const existingReceipt = await this.findExistingReceipt(charge.id, paymentIntentId);
        if (existingReceipt) return { receipt: existingReceipt, created: false };
      }
      throw error;
    }
  }

  private classifyRevenue(bundle: StripePaymentBundle): RevenueClassification {
    const metadata = {
      ...(bundle.charge.metadata ?? {}),
      ...(bundle.paymentIntent?.metadata ?? {}),
      ...(bundle.invoice?.metadata ?? {}),
    };
    const explicitCategory = metadata.revenue_category as ReceiptRevenueCategory | undefined;
    if (['subscription', 'subscription_proration', 'setup_fee', 'other'].includes(explicitCategory ?? '')) {
      return { category: explicitCategory as ReceiptRevenueCategory, reason: 'Stripe revenue_category metadata' };
    }

    const description = [
      bundle.charge.description,
      bundle.paymentIntent?.description,
      bundle.invoice?.description,
    ]
      .filter(Boolean)
      .join(' ');

    if (/prorat/i.test(description)) {
      return { category: 'subscription_proration', reason: 'Stripe description identifies a prorated charge' };
    }
    if (/setup fee/i.test(description)) {
      return { category: 'setup_fee', reason: 'Stripe description identifies a setup fee' };
    }
    const invoiceSubscriptionId =
      this.stripeResourceId((bundle.invoice as any)?.subscription) ??
      this.stripeResourceId((bundle.invoice as any)?.parent?.subscription_details?.subscription);
    if (invoiceSubscriptionId || /subscription/i.test(description)) {
      return {
        category: 'subscription',
        reason: invoiceSubscriptionId
          ? `Stripe invoice belongs to subscription ${invoiceSubscriptionId}`
          : 'Stripe description identifies a subscription',
      };
    }

    return { category: 'other', reason: 'Stripe did not provide a reliable subscription classification signal' };
  }

  private findExistingReceipt(chargeId: string, paymentIntentId: string | null) {
    return Receipt.findOne({
      $or: [
        { 'reconciliation.stripeChargeId': chargeId },
        { transactionId: `STRIPE_RECOVERY_${chargeId}` },
        ...(paymentIntentId ? [{ 'processor.name': 'stripe', 'processor.transactionId': paymentIntentId }] : []),
      ],
    }).lean();
  }

  private validateStripeId(stripeId: string) {
    if (!stripeId || (!stripeId.startsWith('ch_') && !stripeId.startsWith('pi_'))) {
      throw new ErrorUtil('stripeId must be a Stripe charge ID or PaymentIntent ID', 400);
    }
  }

  private async safeRetrievePaymentIntent(id: string | null): Promise<Stripe.PaymentIntent | null> {
    if (!id) return null;
    try {
      return await this.stripe.paymentIntents.retrieve(id);
    } catch {
      return null;
    }
  }

  private async safeRetrieveCustomer(id: string | null): Promise<Stripe.Customer | Stripe.DeletedCustomer | null> {
    if (!id) return null;
    try {
      return await this.stripe.customers.retrieve(id);
    } catch {
      return null;
    }
  }

  private async safeRetrieveInvoice(id: string | null): Promise<Stripe.Invoice | null> {
    if (!id) return null;
    try {
      return await this.stripe.invoices.retrieve(id);
    } catch {
      return null;
    }
  }

  private async safeRetrievePaymentMethod(id: string | null): Promise<Stripe.PaymentMethod | null> {
    if (!id) return null;
    try {
      return await this.stripe.paymentMethods.retrieve(id);
    } catch {
      return null;
    }
  }

  private async safeRetrieveBalanceTransaction(id: string | null): Promise<Stripe.BalanceTransaction | null> {
    if (!id) return null;
    try {
      return await this.stripe.balanceTransactions.retrieve(id);
    } catch {
      return null;
    }
  }

  private stripeResourceId(resource: string | { id: string } | null | undefined): string | null {
    if (!resource) return null;
    return typeof resource === 'string' ? resource : resource.id;
  }

  private toPlainObject(value: unknown) {
    if (value === null || value === undefined) return null;
    return JSON.parse(JSON.stringify(value));
  }

  private firstNonEmpty(values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  private centsToMoney(cents: number): number {
    return Math.round((cents / 100 + Number.EPSILON) * 100) / 100;
  }
}
