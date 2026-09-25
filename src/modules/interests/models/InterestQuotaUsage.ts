import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInterestQuotaUsage extends Document {
  athleteProfile: Types.ObjectId;
  period: string;
  used: number;
  limitSnapshot: number;
  createdAt: Date;
  updatedAt: Date;
}

const InterestQuotaUsageSchema = new Schema<IInterestQuotaUsage>(
  {
    athleteProfile: { type: Schema.Types.ObjectId, ref: 'AthleteProfile', required: true },
    period: { type: String, required: true },
    used: { type: Number, required: true, min: 0, default: 0 },
    limitSnapshot: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

InterestQuotaUsageSchema.index({ athleteProfile: 1, period: 1 }, { unique: true });

export const InterestQuotaUsageModel = mongoose.model<IInterestQuotaUsage>('InterestQuotaUsage', InterestQuotaUsageSchema);

