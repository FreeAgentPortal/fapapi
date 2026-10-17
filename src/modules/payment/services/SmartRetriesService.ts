import { randomUUID } from 'crypto';
import BillingAccount, { BillingAccountType, SmartRetriesState } from '../../auth/model/BillingAccount';
import { RoleRegistry } from '../../auth/utils/RoleRegistry';
import PaymentProcessor, { PaymentChargeResult, ScheduledChargeDetails } from '../classes/PaymentProcess';
import { calculateNextRenewalBillingDate, calculatePlanCycleAmount } from '../utils/billingPlanUtils';
import { nextDailyBillingRun, nextRetry, retryDate, retryDeadline } from '../utils/smartRetries';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import logger from '../../../utils/logger';

type WriteReceipt = (billing: BillingAccountType, result: PaymentChargeResult, amount: number, plan: any) => Promise<unknown>;

export default class SmartRetriesService {
  static dueFilter(now: Date): Record<string, any> {
    return {
      vaulted: true,
      pendingCancellation: { $ne: true },
      plan: { $exists: true, $ne: null },
      $or: [
        { smartRetries: { $exists: false }, status: { $in: ['active', 'trialing'] }, needsUpdate: { $ne: true }, nextBillingDate: { $lte: now } },
        { 'smartRetries.status': 'retrying', 'smartRetries.nextAttemptAt': { $lte: now }, 'smartRetries.deadline': { $gte: now }, status: { $in: ['active', 'trialing'] }, needsUpdate: { $ne: true } },
        { 'smartRetries.status': 'recovery_pending', 'smartRetries.nextAttemptAt': { $lte: now }, status: 'suspended' },
      ],
    };
  }

  static async expireRetries(now = new Date()): Promise<void> {
    await BillingAccount.updateMany({
      'smartRetries.status': 'retrying',
      'smartRetries.deadline': { $lt: now },
      pendingCancellation: { $ne: true },
    }, {
      $set: { 'smartRetries.status': 'exhausted', status: 'suspended', needsUpdate: true },
      $unset: { 'smartRetries.nextAttemptAt': 1 },
    });
  }

  static async reportBlockedAttempts(now = new Date()): Promise<void> {
    const blocked = await BillingAccount.find({ $or: [
      { 'smartRetries.status': 'review' },
      { 'smartRetries.status': 'processing', updatedAt: { $lt: new Date(now.getTime() - 60 * 60 * 1000) } },
    ] }).select('_id smartRetries.attemptId smartRetries.status').limit(50).lean();
    if (blocked.length) {
      logger.warn({ accounts: blocked }, '[SmartRetries] Unresolved attempts require reconciliation; automatic collection remains blocked');
    }
  }

  static assertPlanChangeAllowed(billing: BillingAccountType): void {
    if (billing.smartRetries) throw new ErrorUtil('Resolve the outstanding subscription payment before changing plans or billing cycle', 409);
    // Guard against a scheduler claiming the account after this check.
    billing.$where = { ...billing.$where, smartRetries: { $exists: false } };
  }

  static assertCardChangeAllowed(billing: BillingAccountType): void {
    if (['processing', 'review'].includes(billing.smartRetries?.status ?? '')) {
      throw new ErrorUtil('Subscription payment is processing or awaiting reconciliation', 409);
    }
    billing.$where = {
      ...billing.$where,
      updatedAt: billing.updatedAt,
      ...(billing.smartRetries
        ? { 'smartRetries.attemptId': billing.smartRetries.attemptId, 'smartRetries.status': billing.smartRetries.status }
        : { smartRetries: { $exists: false } }),
    };
  }

  static cardUpdated(billing: BillingAccountType, previousMethodId: string | undefined, now = new Date()): void {
    const state = billing.smartRetries;
    if (!state) {
      billing.needsUpdate = false;
      return;
    }
    const methodId = billing.paymentProcessorData?.[billing.processor ?? '']?.paymentMethod?.id;
    if (!methodId || methodId === previousMethodId || billing.pendingCancellation) return;
    const nextRun = nextDailyBillingRun(now);
    if (state.status === 'retrying' && now <= state.deadline) {
      state.nextAttemptAt = nextRun;
      billing.needsUpdate = false;
    } else if (state.status === 'exhausted' || (state.status === 'retrying' && now > state.deadline)) {
      state.status = 'recovery_pending';
      state.nextAttemptAt = nextRun;
      state.recovery = true;
      billing.status = 'suspended';
      billing.needsUpdate = true;
    }
  }

  static async saveBillingChange(billing: BillingAccountType): Promise<void> {
    try {
      await billing.save();
    } catch (error: any) {
      if (error.name === 'DocumentNotFoundError' || error.name === 'VersionError') {
        throw new ErrorUtil('Billing changed while this request was running. Refresh and try again.', 409);
      }
      throw error;
    }
  }

  static async collect(billingId: string, processor: PaymentProcessor, writeReceipt: WriteReceipt, now = new Date()): Promise<{ success: boolean; skipped?: boolean; message: string }> {
    const billing = await BillingAccount.findOne({ _id: billingId, ...this.dueFilter(now) }).populate('plan').populate('payor');
    if (!billing) return { success: false, skipped: true, message: 'Subscription is not due or is already claimed' };
    const previous = billing.smartRetries;
    if (!previous && billing.scheduledPlanChange?.effectiveDate && billing.scheduledPlanChange.effectiveDate <= now) {
      return { success: false, skipped: true, message: 'Due plan change must be applied before collection' };
    }
    // A manual trigger or a card update cannot cause two submissions on the same UTC day.
    if (previous?.lastAttemptAt && retryDate(previous.lastAttemptAt, 0).getTime() === retryDate(now, 0).getTime()) {
      return { success: false, skipped: true, message: 'Subscription already attempted today' };
    }
    const processorName = processor.getProcessorName();
    const processorData = billing.paymentProcessorData?.[processorName];
    const plan = previous?.planSnapshot ?? billing.plan;
    const grossCents = Math.round(calculatePlanCycleAmount(plan, Boolean(billing.isYearly)) * 100);
    const creditsCents = previous?.creditsCents ?? Math.min(grossCents, Math.max(0, Math.round((billing.credits ?? 0) * 100)));
    const amountCents = previous?.amountCents ?? grossCents - creditsCents;
    const compare = { _id: billing._id, updatedAt: billing.updatedAt, ...this.dueFilter(now) };

    if (!billing.plan?._id || !billing.payor?._id || !billing.nextBillingDate || !Number.isFinite(amountCents) || amountCents < 0 ||
        (amountCents > 0 && (!processorData || (processorName === 'stripe' && (!processorData.customer?.id || !processorData.paymentMethod?.id))))) {
      const set: Record<string, any> = { needsUpdate: true };
      if (previous) {
        set['smartRetries.status'] = 'exhausted';
        set.status = 'suspended';
      }
      await BillingAccount.updateOne(compare, { $set: set, $unset: { 'smartRetries.nextAttemptAt': 1 } });
      return { success: false, message: 'Missing or invalid billing, payor, or payment method information' };
    }

    const state: SmartRetriesState = {
      status: 'processing',
      dueDate: previous?.dueDate ?? billing.nextBillingDate!,
      deadline: previous?.deadline ?? retryDeadline(billing.nextBillingDate!),
      attemptCount: (previous?.attemptCount ?? 0) + (amountCents > 0 ? 1 : 0),
      retrySlot: previous?.retrySlot ?? -1,
      attemptId: randomUUID(),
      recovery: previous?.status === 'recovery_pending',
      lastAttemptAt: amountCents > 0 ? now : previous?.lastAttemptAt,
      amountCents,
      creditsCents,
      isYearly: previous?.isYearly ?? Boolean(billing.isYearly),
      planSnapshot: { _id: String(plan._id), name: plan.name, price: Number(plan.price) },
      paymentMethodId: processorData?.paymentMethod?.id,
    };
    const claimed = await BillingAccount.findOneAndUpdate(compare, { $set: { smartRetries: state } }, { new: true });
    if (!claimed) return { success: false, skipped: true, message: 'Subscription claimed by another worker' };
    const attemptFilter = { _id: billing._id, 'smartRetries.attemptId': state.attemptId, 'smartRetries.status': 'processing' };

    try {
      // Recheck cancellation after claiming, before crossing the processor boundary.
      const permitted = await BillingAccount.exists({ ...attemptFilter, pendingCancellation: { $ne: true } });
      if (!permitted) {
        await BillingAccount.updateOne(attemptFilter, {
          $set: { 'smartRetries.status': 'exhausted', 'smartRetries.attemptCount': previous?.attemptCount ?? 0 },
          $unset: { 'smartRetries.nextAttemptAt': 1, 'smartRetries.lastAttemptAt': 1 },
        });
        return { success: false, skipped: true, message: 'Subscription cancelled before submission' };
      }
      const details: ScheduledChargeDetails = {
        ...processorData,
        amount: amountCents / 100,
        billingAccountId: String(billing._id),
        revenueCategory: 'subscription',
        description: 'Scheduled subscription payment',
        idempotencyKey: `subscription-${billing._id}-${state.attemptId}`,
        paymentMethodId: state.paymentMethodId,
      };
      const result: PaymentChargeResult = amountCents === 0
        ? { success: true, status: 'succeeded', outcome: 'succeeded', transactionId: `CREDIT_${state.attemptId}`, data: { covered_by_credits: true } }
        : await processor.processPayment(details);
      // Persist the processor result before receipt creation or settlement. Never release
      // an interrupted/ambiguous attempt to the scheduler, even after idempotency expiry.
      await BillingAccount.updateOne(attemptFilter, { $set: { 'smartRetries.outcome': result } });
      const succeeded = result?.outcome === 'succeeded' || (result?.success && result.status === 'succeeded');
      if (!result || result.outcome === 'unknown' || (result.success && !succeeded)) {
        throw new Error('Processor outcome requires reconciliation');
      }
      await writeReceipt(billing, result, amountCents / 100, state.planSnapshot);

      if (succeeded) {
        const policy = RoleRegistry[billing.profileType]?.subscriptionStart ?? {
          chargeTiming: 'deferred' as const, amount: 'full' as const,
          renewalAnchor: { monthly: { type: 'calendar-month' as const, day: 1 }, yearly: { type: 'rolling-years' as const, years: 1 } },
        };
        const nextBillingDate = calculateNextRenewalBillingDate(policy, state.isYearly, state.dueDate, now);
        // $inc preserves independently added credits; the claim prevents settling twice.
        const settled = await BillingAccount.updateOne({ ...attemptFilter, ...(creditsCents > 0 ? { credits: { $gte: creditsCents / 100 } } : {}) }, {
          $set: { nextBillingDate, status: 'active', needsUpdate: false },
          $inc: { credits: -creditsCents / 100 },
          $unset: { smartRetries: 1 },
        });
        if (!settled.matchedCount) throw new Error('Subscription settlement requires reconciliation');
        return { success: true, message: 'Subscription collected successfully' };
      }

      const retry = result.outcome === 'declined' && result.declineCode === 'insufficient_funds' && processorName === 'stripe' ? nextRetry(state, now) : undefined;
      await BillingAccount.updateOne(attemptFilter, retry ? {
        $set: { 'smartRetries.status': 'retrying', 'smartRetries.retrySlot': retry.slot, 'smartRetries.nextAttemptAt': retry.date, needsUpdate: false },
      } : {
        $set: { 'smartRetries.status': 'exhausted', status: 'suspended', needsUpdate: true },
        $unset: { 'smartRetries.nextAttemptAt': 1 },
      });
      return { success: false, message: result.message ?? 'Subscription payment declined' };
    } catch (error: any) {
      logger.error({ billingId, attemptId: state.attemptId, error: error.message }, '[SmartRetries] Attempt requires reconciliation; automatic collection blocked');
      await BillingAccount.updateOne(attemptFilter, {
        $set: { 'smartRetries.status': 'review' },
        $unset: { 'smartRetries.nextAttemptAt': 1 },
      });
      return { success: false, message: 'Subscription attempt requires reconciliation' };
    }
  }
}
