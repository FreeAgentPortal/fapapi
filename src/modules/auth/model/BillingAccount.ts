import mongoose from 'mongoose';
import { ObjectId } from 'mongoose';
import { UserType } from './User';
import { PlanEntitlements, PlanType } from './PlanSchema';

export interface SmartRetriesState {
  status: 'processing' | 'retrying' | 'exhausted' | 'recovery_pending' | 'review';
  dueDate: Date;
  deadline: Date;
  attemptCount: number;
  // -1 is the original charge; 0..3 represent days 1, 3, 5, 7.
  retrySlot: number;
  nextAttemptAt?: Date;
  lastAttemptAt?: Date;
  attemptId: string;
  recovery: boolean;
  amountCents: number;
  creditsCents: number;
  isYearly: boolean;
  planSnapshot: { _id: string; name: string; price: number };
  paymentMethodId?: string;
  outcome?: Record<string, any>;
}

export interface BillingAccountType extends mongoose.Document {
  _id: ObjectId;
  customerId: string;
  profileId: ObjectId;
  email: string;
  profileType: string;
  features: ObjectId[];
  status: string;
  trialLength: number;
  processor?: string;
  credits?: number;
  setupFeePaid?: boolean;
  initialSubscriptionChargeStatus?: 'pending' | 'processing' | 'paid' | 'failed' | 'deferred' | 'not_required';
  subscriptionStartedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  vaulted: Boolean;
  vaultId: string;
  nextBillingDate?: Date;
  smartRetries?: SmartRetriesState;
  needsUpdate?: boolean;
  pendingCancellation?: boolean;
  payor: UserType;
  plan: PlanType;
  entitlements?: PlanEntitlements;
  // is yearly? whether or not the subscription is yearly
  isYearly?: boolean;
  // Payment processor specific data map
  paymentProcessorData: {
    [processorName: string]: any;
  };
  scheduledPlanChange?: {
    plan: ObjectId | PlanType;
    features: ObjectId[];
    entitlements?: PlanEntitlements;
    effectiveDate: Date;
    changeType: 'upgrade' | 'downgrade' | 'lateral';
    isYearly: boolean;
  };
}

const Schema = new mongoose.Schema(
  {
    customerId: {
      // id of customer in pyre or payment processor
      type: String, 
    },
    profileId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'AthleteProfile',
    },
    credits: {
      type: Number,
      default: 0, // credits for free usage
    },
    isYearly: {
      type: Boolean,
      default: false,
    },
    setupFeePaid: {
      type: Boolean,
      default: false,
    },
    nextBillingDate: {
      type: Date,
    },
    smartRetries: {
      type: new mongoose.Schema({
        status: { type: String, enum: ['processing', 'retrying', 'exhausted', 'recovery_pending', 'review'], required: true },
        dueDate: { type: Date, required: true },
        deadline: { type: Date, required: true },
        attemptCount: { type: Number, min: 0, required: true },
        retrySlot: { type: Number, min: -1, max: 3, required: true },
        nextAttemptAt: Date,
        lastAttemptAt: Date,
        attemptId: { type: String, required: true },
        recovery: { type: Boolean, default: false },
        amountCents: { type: Number, min: 0, required: true },
        creditsCents: { type: Number, min: 0, required: true },
        isYearly: Boolean,
        planSnapshot: {
          _id: String,
          name: String,
          price: Number,
        },
        paymentMethodId: String,
        outcome: mongoose.Schema.Types.Mixed,
      }, { _id: false }),
      default: undefined,
    },
    initialSubscriptionChargeStatus: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed', 'deferred', 'not_required'],
    },
    subscriptionStartedAt: {
      type: Date,
    },
    vaultId: {
      type: String,
    },
    plan: {
      type: mongoose.Types.ObjectId,
      ref: 'Plan',
    },
    email: {
      type: String,
      required: true,
    },
    profileType: {
      type: String,
      required: true,
    },
    features: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'Feature',
      },
    ],
    entitlements: {
      agentSeats: {
        type: Number,
        min: 0,
        default: null,
      },
      teamInterestsPerMonth: {
        type: Number,
        min: 0,
        default: null,
      },
    },
    scheduledPlanChange: {
      plan: {
        type: mongoose.Types.ObjectId,
        ref: 'Plan',
      },
      features: [
        {
          type: mongoose.Types.ObjectId,
          ref: 'Feature',
        },
      ],
      entitlements: {
        agentSeats: {
          type: Number,
          min: 0,
          default: null,
        },
        teamInterestsPerMonth: {
          type: Number,
          min: 0,
          default: null,
        },
      },
      effectiveDate: {
        type: Date,
      },
      changeType: {
        type: String,
        enum: ['upgrade', 'downgrade', 'lateral'],
      },
      isYearly: {
        type: Boolean,
        default: false,
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'trialing'],
      default: 'active',
    },
    trialLength: {
      type: Number,
      default: 30,
    },
    processor: {
      type: String,
    },
    vaulted: {
      type: Boolean,
      default: false,
    },
    payor: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
    },
    needsUpdate: {
      type: Boolean,
      default: false,
    },
    pendingCancellation: {
      type: Boolean,
      default: false,
    },
    // Payment processor specific data map
    paymentProcessorData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<BillingAccountType>('Billing', Schema);
