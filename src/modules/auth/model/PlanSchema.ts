import mongoose, { Types } from 'mongoose';
import { ObjectId } from 'mongoose';
import { FeatureType } from './FeatureSchema';

export interface PlanType extends mongoose.Document {
  _id: ObjectId;
  name: string;
  description: string;
  price: string;
  billingCycle: string;
  availableTo: string[];
  features: FeatureType[];
  isActive: boolean;
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
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<PlanType>('Plan', Schema);
