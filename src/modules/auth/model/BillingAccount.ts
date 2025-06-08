import mongoose from 'mongoose';
import { ObjectId } from 'mongoose';

export interface BillingAccountType extends mongoose.Document {
  _id: ObjectId;
  customerId: ObjectId;
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
  nextBillingDate?: Date;
  // is yearly? whether or not the subscription is yearly
  isYearly?: boolean;
}

const Schema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'Customer',
    },
    profileId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'Profile',
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<BillingAccountType>('Billing', Schema);
