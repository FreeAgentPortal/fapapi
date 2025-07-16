import mongoose, { Types } from 'mongoose';
import { ObjectId } from 'mongoose';
import { FeatureType } from './FeatureSchema';

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
      enum: ['athlete', 'team', 'agent', 'scout'], 
      required: true,
    },
    features: [
      {
        type: Types.ObjectId,
        ref: 'Feature',
        required: true,
      },
    ],
    tier: {
      type: String,
      enum: ['silver', 'gold', 'platnium', 'bronze', 'diamond'],
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
