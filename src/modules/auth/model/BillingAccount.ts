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
  createdAt: Date;
  updatedAt: Date;
  vaulted: Boolean;
  vaultId: string;
  nextBillingDate?: Date;
  payor: UserType;
  plan: PlanType;
  // is yearly? whether or not the subscription is yearly
  isYearly?: boolean;
}

const Schema = new mongoose.Schema(
  {
    customerId: { // id of customer in pyre or payment processor
      type: String,
      required: true, 
    },
    profileId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'Profile',
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<BillingAccountType>('Billing', Schema);
