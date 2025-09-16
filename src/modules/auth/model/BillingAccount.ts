import mongoose from 'mongoose';
import { ObjectId } from 'mongoose';
import { UserType } from './User';
import { PlanType } from './PlanSchema';

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
  setupFeePaid?: boolean;
  createdAt: Date;
  updatedAt: Date;
  vaulted: Boolean;
  vaultId: string;
  nextBillingDate?: Date;
  needsUpdate?: boolean;
  payor: UserType;
  plan: PlanType;
  // is yearly? whether or not the subscription is yearly
  isYearly?: boolean;
  // Payment processor specific data map
  paymentProcessorData?: {
    [processorName: string]: any;
  };
}

const Schema = new mongoose.Schema(
  {
    customerId: {
      // id of customer in pyre or payment processor
      type: String,
      required: true,
    },
    profileId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'AthleteProfile',
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
      default: Date.now(),
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
