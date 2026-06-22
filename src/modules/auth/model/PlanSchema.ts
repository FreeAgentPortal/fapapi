import mongoose, { Types } from 'mongoose';
import { ObjectId } from 'mongoose';
import { FeatureType } from './FeatureSchema';

export interface PlanEntitlements {
  agentSeats?: number | null;
}

export interface PlanType extends mongoose.Document {
  _id: ObjectId;
  name: string;
  description: string;
  price: string;
  yearlyDiscount: number;
  billingCycle: string;
  availableTo: string[];
  tier: string;
  features: FeatureType[];
  entitlements?: PlanEntitlements;
  isActive: boolean;
  mostPopular: boolean;
}

const Schema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    price: { type: Number, required: true },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    availableTo: {
      type: [String],
      enum: ['athlete', 'team', 'agent', 'scout', 'professional'],
      required: true,
    },
    features: [
      {
        type: Types.ObjectId,
        ref: 'Feature',
        required: true,
      },
    ],
    entitlements: {
      agentSeats: {
        type: Number,
        min: 0,
        default: null,
      },
    },
    tier: {
      type: String,
      enum: ['silver', 'gold', 'platinum', 'bronze', 'diamond'],
      default: 'silver',
    },
    yearlyDiscount: {
      type: Number,
      default: 0.1,
    },
    isActive: { type: Boolean, default: true },
    mostPopular: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<PlanType>('Plan', Schema);
