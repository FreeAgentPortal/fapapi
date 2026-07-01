import moment from 'moment';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import BillingAccount from '../../auth/model/BillingAccount';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';
import { PaymentHandler } from './PaymentHandler';
import { getPaymentSafeCountryCode } from '../utils/countryHelpers';
import { validatePaymentFormData } from '../utils/paymentValidation';
import PaymentProcessingHandler from './PaymentProcessing.handler';
import { eventBus } from '../../../lib/eventBus';
import PlanSchema from '../../auth/model/PlanSchema';
import { RoleRegistry } from '../../auth/utils/RoleRegistry';
import {
  applyBillingPlanSnapshot,
  BillingPlanChangeType,
  BillingPlanSnapshot,
  buildBillingPlanSnapshot,
  calculatePlanCycleAmount,
  ScheduledBillingPlanChange,
} from '../utils/billingPlanUtils';

export class BillingHandler {
  constructor(private readonly paymentHandler: PaymentHandler = new PaymentHandler()) {}

  async updateVault(req: AuthenticatedRequest): Promise<{ planId: string; billingId: string; profileId: string }> {
    const { id } = req.params;
    const { paymentFormValues, selectedPlans, billingCycle, paymentMethod, stripeToken } = req.body;
    const operationId = `billing-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      this.logUpdateVault(operationId, 'start', {
        params: req.params,
        body: {
          planId: req.body?.planId,
          selectedPlanId: req.body?.selectedPlanId,
          selectedPlans,
          billingCycle,
          paymentMethod,
          stripeTokenPresent: Boolean(stripeToken),
          paymentFormKeys: paymentFormValues ? Object.keys(paymentFormValues) : [],
        },
        user: {
          id: req.user?._id?.toString?.(),
          roles: req.user?.roles,
          profileRefs: req.user?.profileRefs,
        },
      });

      const billingCount = await BillingAccount.countDocuments({ profileId: id });
      this.logUpdateVault(operationId, 'billing_lookup_count', { profileId: id, billingCount });

      const billing = await BillingAccount.findOne({ profileId: id }).sort({ updatedAt: -1, createdAt: -1 }).populate('payor profileId');
      this.logUpdateVault(operationId, 'billing_lookup_result', {
        profileId: id,
        found: Boolean(billing),
        billing: this.summarizeBilling(billing),
      });

      if (!billing) {
        throw new ErrorUtil('Could not find billing information', 404);
      }

      const processorResult = await new PaymentProcessorFactory().smartChooseProcessor();
      const processor = processorResult.processor;
      this.logUpdateVault(operationId, 'processor_selection', {
        processorFound: Boolean(processor),
        processorName: processor?.getProcessorName?.(),
        processorResult,
      });

      if (!processor) {
        throw new ErrorUtil('No payment processor is configured', 500);
      }

      const selectedPlanId = this.resolveSelectedPlanId(req.body, billing.plan);
      this.logUpdateVault(operationId, 'plan_id_resolved', {
        selectedPlanId,
        currentBillingPlanId: this.extractPlanId(billing.plan),
        requestPlanId: req.body?.planId,
        requestSelectedPlanId: req.body?.selectedPlanId,
      });

      const plan = await PlanSchema.findById(selectedPlanId).lean();
      this.logUpdateVault(operationId, 'plan_lookup_result', {
        found: Boolean(plan),
        plan: this.summarizePlan(plan),
      });

      if (!plan) {
        throw new ErrorUtil('Selected plan not found', 404);
      }

      this.validatePlanSelection(plan, billing.profileType);
      this.logUpdateVault(operationId, 'plan_validated', {
        profileType: billing.profileType,
        availableTo: plan.availableTo,
        isActive: plan.isActive,
      });

      const billingIsYearly = billingCycle === 'yearly';
      const billingSnapshot = this.buildPlanSnapshot(plan, billing.profileType, billingIsYearly);
      const isFree = plan?.price === (0 as any);
      this.logUpdateVault(operationId, 'plan_characteristics', {
        resolvedEntitlements: billingSnapshot.entitlements,
        isFree,
        price: plan.price,
        billingCycle,
      });

      if (!isFree) {
        this.logUpdateVault(operationId, 'payment_validation_start', {
          processorName: processor.getProcessorName(),
          usingStripeToken: Boolean(stripeToken),
        });
        validatePaymentFormData(processor.getProcessorName(), stripeToken ? { stripeToken } : paymentFormValues, 'creditcard');
        this.logUpdateVault(operationId, 'payment_validation_complete', {});
      }

      if (!isFree) {
        this.logUpdateVault(operationId, 'paid_plan_branch_start', {
          billingBeforeVault: this.summarizeBilling(billing),
        });

        billing.payor = req.user;
        const vaultResponse = await processor.createVault(
          billing as any,
          {
            email: billing.email,
            phone: billing.payor?.phoneNumber,
            paymentMethod: 'creditcard',
            stripeToken: stripeToken,
            achDetails: paymentFormValues?.achDetails,
          } as any
        );

        this.logUpdateVault(operationId, 'vault_response', {
          success: vaultResponse.success,
          message: vaultResponse.message,
          dataKeys: vaultResponse.data ? Object.keys(vaultResponse.data) : [],
        });

        if (!vaultResponse.success) {
          console.info(`[BillingHandler] - vaulting was not successful: ${vaultResponse.message}`);
          console.info(vaultResponse);
          throw new ErrorUtil(`${vaultResponse.message}`, 400);
        }

        billing.vaulted = true;
        if (vaultResponse.customerId) {
          billing.customerId = vaultResponse.customerId;
        }

        if (!billing.paymentProcessorData) {
          billing.paymentProcessorData = {};
        }

        const name = processor.getProcessorName();
        billing.paymentProcessorData[name] = {
          ...vaultResponse.data,
        };
        billing.markModified('paymentProcessorData');

        this.logUpdateVault(operationId, 'paid_plan_branch_complete', {
          processorName: name,
          billingAfterVault: this.summarizeBilling(billing),
        });
      } else {
        this.logUpdateVault(operationId, 'free_plan_branch_start', {
          billingBeforeFreeUpdate: this.summarizeBilling(billing),
        });

        if (!billing.payor) {
          billing.payor = req.user;
        }

        billing.vaulted = this.hasStoredPaymentMethod(billing);

        this.logUpdateVault(operationId, 'free_plan_branch_complete', {
          billingAfterFreeUpdate: this.summarizeBilling(billing),
        });
      }

      this.logUpdateVault(operationId, 'billing_assignment_start', {
        previousPlanId: this.extractPlanId(billing.plan),
        nextPlanId: this.extractPlanId(billingSnapshot.plan),
        featuresCount: billingSnapshot.features.length,
        billingIsYearly,
      });

      applyBillingPlanSnapshot(billing, billingSnapshot);
      billing.scheduledPlanChange = undefined;

      if (isFree) {
        billing.nextBillingDate = undefined;
        billing.status = 'active';
        billing.needsUpdate = false;
        this.logUpdateVault(operationId, 'free_plan_billing_fields_applied', {
          billingAfterAssignment: this.summarizeBilling(billing),
        });
      } else {
        if (!billing.needsUpdate) {
          if (!billing.nextBillingDate || !moment(billing.nextBillingDate).isAfter(moment())) {
            const nextMonth = moment().add(1, 'month').startOf('month');
            billing.nextBillingDate = nextMonth.toDate();
          }
        }
        billing.status = 'active';
        billing.needsUpdate = false;

        this.logUpdateVault(operationId, 'pre_intermediate_save', {
          billingBeforeSave: this.summarizeBilling(billing),
        });
        await billing.save();
        this.logUpdateVault(operationId, 'post_intermediate_save', {
          billingAfterSave: this.summarizeBilling(billing),
        });

        const roleMeta = RoleRegistry[req.user.profileRefs[0] ?? 'athlete'];
        this.logUpdateVault(operationId, 'setup_fee_check', {
          roleMeta,
          setupFeePaid: billing.setupFeePaid,
        });

        if (!billing.setupFeePaid && roleMeta.requiresSetupFee) {
          console.log(`fell into here`);
          const paymentResults = await PaymentProcessingHandler.processPaymentForProfile(billing._id as any, roleMeta.setupFeeAmount, false, 'Account setup fee');
          this.logUpdateVault(operationId, 'setup_fee_result', paymentResults);
          if (paymentResults.success === false) {
            console.info(`[BillingHandler] - Initial setup fee payment failed: ${paymentResults.message}`);
          }
          billing.setupFeePaid = true;
        }
      }

      billing.processor = processor.getProcessorName();
      this.logUpdateVault(operationId, 'pre_final_save', {
        processorName: billing.processor,
        billingBeforeFinalSave: this.summarizeBilling(billing),
      });
      await billing.save();
      this.logUpdateVault(operationId, 'post_final_save', {
        billingAfterFinalSave: this.summarizeBilling(billing),
      });

      const persistedBilling = await BillingAccount.findById(billing._id).select('_id profileId plan status needsUpdate nextBillingDate updatedAt');
      const persistedPlanId = this.extractPlanId(persistedBilling?.plan);
      const expectedPlanId = this.extractPlanId(billingSnapshot.plan);
      this.logUpdateVault(operationId, 'persisted_billing_check', {
        persistedBilling,
        persistedPlanId,
        expectedPlanId,
      });

      if (!persistedBilling || !persistedPlanId || persistedPlanId !== expectedPlanId) {
        throw new ErrorUtil('Billing plan update did not persist correctly', 500);
      }

      const response = {
        billingId: persistedBilling._id.toString(),
        profileId: persistedBilling.profileId.toString(),
        planId: persistedPlanId,
      };

      this.logUpdateVault(operationId, 'complete', response);

      return response;
    } catch (error: any) {
      this.logUpdateVault(operationId, 'error', {
        message: error?.message,
        stack: error?.stack,
        statusCode: error?.statusCode,
        name: error?.name,
      });
      throw error;
    }
  }

  async changePlan(req: AuthenticatedRequest): Promise<{
    billingId: string;
    profileId: string;
    activePlanId: string;
    pendingPlanId?: string;
    changeType: BillingPlanChangeType;
    effectiveAt: Date;
    chargedAmountCents: number;
    scheduled: boolean;
  }> {
    const { id } = req.params;
    const { planId } = req.body;

    if (!planId) {
      throw new ErrorUtil('Selected plan not provided', 400);
    }

    const billing = await BillingAccount.findOne({ profileId: id }).populate('payor profileId plan');
    if (!billing) {
      throw new ErrorUtil('Could not find billing information', 404);
    }

    if (!billing.vaulted || !this.hasUsableProcessorData(billing)) {
      throw new ErrorUtil('Billing account must complete payment setup before changing plans', 400);
    }

    const currentPlan = billing.plan as any;
    const currentPlanId = this.extractPlanId(currentPlan);
    if (!currentPlanId || !currentPlan) {
      throw new ErrorUtil('Billing account does not have an active plan. Complete billing setup first.', 400);
    }

    const targetPlan = await PlanSchema.findById(planId).lean();
    if (!targetPlan) {
      throw new ErrorUtil('Selected plan not found', 404);
    }

    this.validatePlanSelection(targetPlan, billing.profileType);

    const billingIsYearly = Boolean(billing.isYearly);
    const targetSnapshot = this.buildPlanSnapshot(targetPlan, billing.profileType, billingIsYearly);
    const currentAmount = calculatePlanCycleAmount(currentPlan, billingIsYearly);
    const targetAmount = calculatePlanCycleAmount(targetPlan, billingIsYearly);
    const changeType = this.resolvePlanChangeType(currentAmount, targetAmount);
    const targetPlanId = this.extractPlanId(targetSnapshot.plan);

    if (!targetPlanId) {
      throw new ErrorUtil('Selected plan not found', 404);
    }

    if (changeType === 'downgrade') {
      const effectiveDate = this.requireFutureNextBillingDate(billing, 'Cannot schedule a downgrade without a valid future billing date');
      const scheduledPlanChange: ScheduledBillingPlanChange = {
        ...targetSnapshot,
        effectiveDate,
        changeType,
      };

      billing.scheduledPlanChange = scheduledPlanChange;
      await billing.save();

      return {
        billingId: billing._id.toString(),
        profileId: (billing.profileId as any)?._id?.toString?.() ?? billing.profileId.toString(),
        activePlanId: currentPlanId,
        pendingPlanId: targetPlanId,
        changeType,
        effectiveAt: effectiveDate,
        chargedAmountCents: 0,
        scheduled: true,
      };
    }

    let chargedAmountCents = 0;
    if (changeType === 'upgrade') {
      const nextBillingDate = this.requireFutureNextBillingDate(billing, 'Cannot prorate an upgrade without a valid future billing date');
      chargedAmountCents = this.calculateProratedDifferenceInCents(currentAmount, targetAmount, nextBillingDate, billingIsYearly);

      if (chargedAmountCents > 0) {
        const chargeResult = (await PaymentProcessingHandler.processPlanChangeCharge(
          billing._id.toString(),
          chargedAmountCents,
          targetPlan,
          `Prorated upgrade charge for ${targetPlan.name}`
        )) as any;

        if (!chargeResult.success) {
          throw new ErrorUtil(`Upgrade charge failed: ${chargeResult.message}`, 400);
        }
      }
    }

    applyBillingPlanSnapshot(billing, targetSnapshot);
    billing.scheduledPlanChange = undefined;
    billing.status = 'active';
    billing.needsUpdate = false;

    if (targetAmount === 0) {
      billing.nextBillingDate = undefined;
    }

    await billing.save();

    return {
      billingId: billing._id.toString(),
      profileId: (billing.profileId as any)?._id?.toString?.() ?? billing.profileId.toString(),
      activePlanId: targetPlanId,
      changeType,
      effectiveAt: new Date(),
      chargedAmountCents,
      scheduled: false,
    };
  }

  async createPaymentMethod(req: AuthenticatedRequest): Promise<{
    billingId: string;
    profileId: string;
    processor: string;
    vaulted: boolean;
    paymentMethod: Record<string, any> | null;
  }> {
    const { paymentFormValues, paymentMethod = 'creditcard', stripeToken } = req.body;
    const billing = await this.loadBillingForOwnerAction(req);
    const processor = await this.resolveBillingProcessor(billing);

    validatePaymentFormData(processor.getProcessorName(), stripeToken ? { stripeToken } : paymentFormValues, paymentMethod);

    if (!billing.payor) {
      billing.payor = req.user;
    }

    const paymentMethodResult = await processor.createPaymentMethod(billing as any, {
      email: billing.email,
      phone: billing.payor?.phoneNumber,
      paymentMethod,
      stripeToken,
      achDetails: paymentFormValues?.achDetails,
    });

    if (!paymentMethodResult.success) {
      throw new ErrorUtil(paymentMethodResult.message || 'Unable to store payment method', 400);
    }

    if (!billing.paymentProcessorData) {
      billing.paymentProcessorData = {};
    }

    const processorName = processor.getProcessorName();
    billing.processor = processorName;
    billing.customerId = paymentMethodResult.customerId || billing.customerId;
    billing.paymentProcessorData[processorName] = {
      ...(billing.paymentProcessorData[processorName] || {}),
      customer: paymentMethodResult.data?.customer,
      paymentMethod: paymentMethodResult.data?.paymentMethod,
    };
    billing.markModified('paymentProcessorData');
    billing.vaulted = true;
    billing.needsUpdate = false;

    await billing.save();

    return {
      billingId: billing._id.toString(),
      profileId: (billing.profileId as any)?._id?.toString?.() ?? billing.profileId.toString(),
      processor: processorName,
      vaulted: true,
      paymentMethod: this.sanitizeStoredPaymentMethod(paymentMethodResult.data?.paymentMethod),
    };
  }

  async removePaymentMethod(req: AuthenticatedRequest): Promise<{
    billingId: string;
    profileId: string;
    processor: string | null;
    vaulted: boolean;
  }> {
    const billing = await this.loadBillingForOwnerAction(req);

    if (!this.hasStoredPaymentMethod(billing)) {
      throw new ErrorUtil('No stored payment method found for this billing account', 404);
    }

    const processor = await this.resolveBillingProcessor(billing);
    const processorName = processor.getProcessorName();
    const storedPaymentMethodId = billing.paymentProcessorData?.[processorName]?.paymentMethod?.id;

    const result = await processor.removePaymentMethod(billing as any, {
      customerId: billing.paymentProcessorData?.[processorName]?.customer?.id || billing.customerId,
      paymentMethodId: storedPaymentMethodId,
    });

    if (!result.success) {
      throw new ErrorUtil(result.message || 'Unable to remove payment method', 400);
    }

    if (billing.paymentProcessorData?.[processorName]) {
      billing.paymentProcessorData[processorName] = {
        ...billing.paymentProcessorData[processorName],
        paymentMethod: null,
      };
      billing.markModified('paymentProcessorData');
    }

    billing.vaulted = false;
    billing.needsUpdate = this.requiresStoredPaymentMethod(billing);

    await billing.save();

    return {
      billingId: billing._id.toString(),
      profileId: (billing.profileId as any)?._id?.toString?.() ?? billing.profileId.toString(),
      processor: billing.processor || null,
      vaulted: billing.vaulted === true,
    };
  }

  async fetchPaymentMethod(req: AuthenticatedRequest): Promise<{
    billingId: string;
    profileId: string;
    processor: string | null;
    vaulted: boolean;
    paymentMethod: Record<string, any> | null;
  }> {
    const billing = await this.loadBillingForOwnerAction(req);

    if (!billing.processor || !billing.paymentProcessorData?.[billing.processor]?.customer?.id) {
      return {
        billingId: billing._id.toString(),
        profileId: (billing.profileId as any)?._id?.toString?.() ?? billing.profileId.toString(),
        processor: billing.processor || null,
        vaulted: this.hasStoredPaymentMethod(billing),
        paymentMethod: null,
      };
    }

    const processor = await this.resolveBillingProcessor(billing);
    const result = await processor.fetchPaymentMethod(billing as any, {
      customerId: billing.paymentProcessorData?.[billing.processor]?.customer?.id || billing.customerId,
    });

    if (!(result.success as any)) {
      throw new ErrorUtil(result.message || 'Unable to fetch payment method', 400);
    }

    return {
      billingId: billing._id.toString(),
      profileId: (billing.profileId as any)?._id?.toString?.() ?? billing.profileId.toString(),
      processor: billing.processor || null,
      vaulted: this.hasStoredPaymentMethod(billing),
      paymentMethod: this.sanitizeStoredPaymentMethod(result.data?.paymentMethod),
    };
  }

  private logUpdateVault(operationId: string, step: string, payload: any) {
    // only if we're in a development or debug environment, otherwise we may not want to log sensitive billing info
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_BILLING === 'true') {
      console.log(`[BillingHandler.updateVault][${operationId}] ${step}`, payload);
    }
  }

  private summarizeBilling(billing: any) {
    if (!billing) {
      return null;
    }

    return {
      billingId: billing._id?.toString?.(),
      profileId: billing.profileId?._id?.toString?.() ?? billing.profileId?.toString?.(),
      profileType: billing.profileType,
      currentPlanId: this.extractPlanId(billing.plan),
      status: billing.status,
      needsUpdate: billing.needsUpdate,
      vaulted: billing.vaulted,
      processor: billing.processor,
      customerId: billing.customerId,
      nextBillingDate: billing.nextBillingDate,
      isYearly: billing.isYearly,
      setupFeePaid: billing.setupFeePaid,
      entitlements: billing.entitlements,
      scheduledPlanChange: billing.scheduledPlanChange
        ? {
            planId: this.extractPlanId(billing.scheduledPlanChange.plan),
            effectiveDate: billing.scheduledPlanChange.effectiveDate,
            changeType: billing.scheduledPlanChange.changeType,
            isYearly: billing.scheduledPlanChange.isYearly,
          }
        : null,
      featureCount: Array.isArray(billing.features) ? billing.features.length : 0,
      updatedAt: billing.updatedAt,
      createdAt: billing.createdAt,
    };
  }

  private summarizePlan(plan: any) {
    if (!plan) {
      return null;
    }

    return {
      planId: this.extractPlanId(plan._id),
      name: plan.name,
      price: plan.price,
      billingCycle: plan.billingCycle,
      availableTo: plan.availableTo,
      isActive: plan.isActive,
      entitlements: plan.entitlements,
      featureCount: Array.isArray(plan.features) ? plan.features.length : 0,
      updatedAt: plan.updatedAt,
      createdAt: plan.createdAt,
    };
  }

  private resolveSelectedPlanId(body: any, currentPlan?: any): string {
    const candidates = [body?.planId, body?.selectedPlanId, ...(Array.isArray(body?.selectedPlans) ? body.selectedPlans : [body?.selectedPlans])]
      .map((candidate) => this.extractPlanId(candidate))
      .filter((candidate): candidate is string => Boolean(candidate));

    if (candidates.length === 0) {
      throw new ErrorUtil('Selected plan not provided', 400);
    }

    const uniqueCandidates = [...new Set(candidates)];
    const currentPlanId = this.extractPlanId(currentPlan);
    const nextPlanId = currentPlanId
      ? ([...uniqueCandidates].reverse().find((candidate) => candidate !== currentPlanId) ?? uniqueCandidates[uniqueCandidates.length - 1])
      : uniqueCandidates[uniqueCandidates.length - 1];

    if (!nextPlanId) {
      throw new ErrorUtil('Selected plan not provided', 400);
    }

    return nextPlanId;
  }

  private extractPlanId(candidate: any): string | null {
    if (!candidate) {
      return null;
    }

    if (typeof candidate === 'string') {
      return candidate;
    }

    if (typeof candidate === 'object') {
      if (typeof candidate._id === 'string') {
        return candidate._id;
      }

      if (typeof candidate.id === 'string') {
        return candidate.id;
      }

      if (typeof candidate.planId === 'string') {
        return candidate.planId;
      }

      if (typeof candidate.toString === 'function') {
        const stringValue = candidate.toString();
        if (stringValue && stringValue !== '[object Object]') {
          return stringValue;
        }
      }
    }

    return null;
  }

  private buildPlanSnapshot(plan: any, profileType: string, isYearly: boolean): BillingPlanSnapshot {
    const entitlements = this.resolveBillingEntitlements(plan, profileType);
    return buildBillingPlanSnapshot(plan, entitlements, isYearly);
  }

  private resolvePlanChangeType(currentAmount: number, targetAmount: number): BillingPlanChangeType {
    if (targetAmount > currentAmount) {
      return 'upgrade';
    }

    if (targetAmount < currentAmount) {
      return 'downgrade';
    }

    return 'lateral';
  }

  private async loadBillingForOwnerAction(req: AuthenticatedRequest) {
    const { id } = req.params;
    const billing = await BillingAccount.findOne({ profileId: id }).populate('payor profileId plan');
    if (!billing) {
      throw new ErrorUtil('Could not find billing information', 404);
    }

    this.ensureBillingOwnerAccess(billing, req);
    return billing;
  }

  private ensureBillingOwnerAccess(billing: any, req: AuthenticatedRequest) {
    const payorId = billing.payor?._id?.toString?.() ?? billing.payor?.toString?.();
    const isOwner = payorId === req.user._id?.toString();
    const isAdmin = req.user.roles?.some((r) => ['admin', 'developer'].includes(r));
    if (!isOwner && !isAdmin) {
      throw new ErrorUtil('Not authorized to manage this billing account', 403);
    }
  }

  private async resolveBillingProcessor(billing: any) {
    if (billing.processor) {
      return new PaymentProcessorFactory().chooseProcessor(billing.processor);
    }

    const processorResult = await new PaymentProcessorFactory().smartChooseProcessor();
    if (!processorResult.processor) {
      throw new ErrorUtil('No payment processor is configured', 500);
    }

    return processorResult.processor;
  }

  private hasUsableProcessorData(billing: any): boolean {
    const processorName = billing.processor;
    if (!processorName || !billing.paymentProcessorData?.[processorName]) {
      return false;
    }

    if (processorName === 'stripe') {
      return Boolean(billing.paymentProcessorData?.stripe?.customer?.id && billing.paymentProcessorData?.stripe?.paymentMethod?.id);
    }

    return Boolean(billing.customerId || billing.paymentProcessorData?.[processorName]);
  }

  private hasStoredPaymentMethod(billing: any): boolean {
    const processorName = billing.processor;
    if (!processorName) {
      return false;
    }

    const processorData = billing.paymentProcessorData?.[processorName];
    if (!processorData) {
      return false;
    }

    if (processorName === 'stripe') {
      return Boolean(processorData?.customer?.id && processorData?.paymentMethod?.id);
    }

    return Boolean(processorData);
  }

  private requiresStoredPaymentMethod(billing: any): boolean {
    const activePlan = billing.plan as any;
    const hasNoRenewalBoundary = !billing.nextBillingDate;
    const activePlanPrice = activePlan?.price;

    if (typeof activePlanPrice === 'number') {
      return activePlanPrice > 0;
    }

    return !hasNoRenewalBoundary;
  }

  private sanitizeStoredPaymentMethod(paymentMethod: any): Record<string, any> | null {
    if (!paymentMethod) {
      return null;
    }

    if (paymentMethod.type === 'card') {
      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        brand: paymentMethod.card?.brand ?? null,
        last4: paymentMethod.card?.last4 ?? null,
        expMonth: paymentMethod.card?.exp_month ?? null,
        expYear: paymentMethod.card?.exp_year ?? null,
      };
    }

    if (paymentMethod.type === 'us_bank_account') {
      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        bankName: paymentMethod.us_bank_account?.bank_name ?? null,
        last4: paymentMethod.us_bank_account?.last4 ?? null,
        accountType: paymentMethod.us_bank_account?.account_type ?? null,
      };
    }

    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
    };
  }
  private requireFutureNextBillingDate(billing: any, errorMessage: string): Date {
    const nextBillingMoment = moment(billing.nextBillingDate);
    if (nextBillingMoment.isValid() && nextBillingMoment.isAfter(moment())) {
      return nextBillingMoment.toDate();
    }

    const fallbackNextBillingDate = moment().add(1, 'month').startOf('month');
    if (!fallbackNextBillingDate.isValid()) {
      throw new ErrorUtil(errorMessage, 400);
    }

    billing.nextBillingDate = fallbackNextBillingDate.toDate();
    return billing.nextBillingDate;
  }

  private calculateProratedDifferenceInCents(currentAmount: number, targetAmount: number, nextBillingDate: Date, isYearly: boolean): number {
    const cycleEnd = moment(nextBillingDate);
    const cycleStart = moment(nextBillingDate).subtract(isYearly ? 1 : 1, isYearly ? 'year' : 'month');
    const totalCycleMs = Math.max(cycleEnd.diff(cycleStart), 1);
    const remainingCycleMs = Math.max(cycleEnd.diff(moment()), 0);
    const remainingRatio = Math.min(1, remainingCycleMs / totalCycleMs);
    const proratedDifference = Math.max(0, (targetAmount - currentAmount) * remainingRatio);

    return Math.round(proratedDifference * 100);
  }

  private validatePlanSelection(plan: any, profileType: string): void {
    if (!plan?.isActive) {
      throw new ErrorUtil('Selected plan is not active', 400);
    }

    const availableTo = Array.isArray(plan?.availableTo) ? plan.availableTo : [];
    if (!availableTo.includes(profileType)) {
      throw new ErrorUtil(`Selected plan is not available for ${profileType} accounts`, 400);
    }
  }

  private resolveBillingEntitlements(plan: any, profileType: string): { agentSeats: number | null } {
    if (profileType !== 'agent') {
      return { agentSeats: null };
    }

    const agentSeats = plan?.entitlements?.agentSeats;
    if (!Number.isInteger(agentSeats) || agentSeats < 0) {
      throw new ErrorUtil('Selected agent plan is missing a valid seat entitlement', 400);
    }

    return { agentSeats };
  }

  /**
   * @description Request cancellation of a user's account.
   *              Sets `pendingCancellation = true` so the account stays active through the
   *              end of the current billing period. The scheduler will finalize the
   *              cancellation (remove from processor, set inactive) when the next billing
   *              date is reached instead of processing a payment.
   *              Only the account owner or an admin/developer may cancel an account.
   */
  async cancelAccount(req: AuthenticatedRequest): Promise<Boolean> {
    const { id } = req.params;
    const billing = await BillingAccount.findOne({ profileId: id });
    if (!billing) {
      throw new ErrorUtil('Could not find billing information', 404);
    }

    const isOwner = billing.payor?.toString() === req.user._id?.toString();
    const isAdmin = req.user.roles?.some((r) => ['admin', 'developer'].includes(r));
    if (!isOwner && !isAdmin) {
      throw new ErrorUtil('Not authorized to cancel this account', 403);
    }

    billing.pendingCancellation = true;
    await billing.save();

    eventBus.publish('billing.cancellation.requested', {
      billing: billing.toObject(),
      userId: billing.payor,
    });

    return true;
  }

  /**
   * @description Fetch billing information for user from profile id
   */
  async getVault(id: string): Promise<any> {
    try {
      const billing = await BillingAccount.findOne({ profileId: id }).populate('plan');
      if (!billing) throw new ErrorUtil('Billing Account not found', 404);

      let billingDetails = {};

      if (billing.processor === 'paynetworx') {
        const pnxData = billing.paymentProcessorData?.pnx || {};
        billingDetails = {
          tokenId: pnxData.tokenId,
          tokenName: pnxData.tokenName,
          vaulted: billing.vaulted,
        };
      } else if (billing.processor === 'stripe') {
        const stripeData = billing.paymentProcessorData?.stripe || {};
        billingDetails = {
          customerId: stripeData.customer?.id,
          paymentMethodId: stripeData.paymentMethod?.id,
          vaulted: billing.vaulted,
        };
      } else {
        const { payload } = await this.paymentHandler.fetchCustomer(billing.customerId);
        billingDetails = payload.vault;
      }

      return {
        ...billing.toObject(),
        billingDetails,
      };
    } catch (err) {
      console.error(err);
      throw new ErrorUtil('Something went wrong', 400);
    }
  }
}
