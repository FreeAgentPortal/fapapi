import mongoose, { Document, Schema, Types } from 'mongoose';

export const INTEREST_STATUSES = ['sent', 'viewed', 'dismissed', 'conversation_started'] as const;
export type InterestStatus = (typeof INTEREST_STATUSES)[number];

export interface InterestExpression {
  expressedAt: Date;
  note?: string;
  quotaPeriod: string;
}

export interface IAthleteTeamInterest extends Document {
  _id: Types.ObjectId;
  athleteProfile: Types.ObjectId;
  teamProfile: Types.ObjectId;
  initiatedByUser: Types.ObjectId;
  note?: string;
  status: InterestStatus;
  lastExpressedAt: Date;
  viewedAt?: Date;
  dismissedAt?: Date;
  conversationStartedAt?: Date;
  conversation?: Types.ObjectId;
  expressions: InterestExpression[];
  createdAt: Date;
  updatedAt: Date;
}

const ExpressionSchema = new Schema<InterestExpression>(
  {
    expressedAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 280 },
    quotaPeriod: { type: String, required: true },
  },
  { _id: false }
);

const AthleteTeamInterestSchema = new Schema<IAthleteTeamInterest>(
  {
    athleteProfile: { type: Schema.Types.ObjectId, ref: 'AthleteProfile', required: true },
    teamProfile: { type: Schema.Types.ObjectId, ref: 'TeamProfile', required: true },
    initiatedByUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true, maxlength: 280 },
    status: { type: String, enum: INTEREST_STATUSES, default: 'sent', required: true },
    lastExpressedAt: { type: Date, required: true, default: Date.now },
    viewedAt: Date,
    dismissedAt: Date,
    conversationStartedAt: Date,
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    expressions: { type: [ExpressionSchema], default: [] },
  },
  { timestamps: true }
);

AthleteTeamInterestSchema.index({ athleteProfile: 1, teamProfile: 1 }, { unique: true });
AthleteTeamInterestSchema.index({ athleteProfile: 1, lastExpressedAt: -1 });
AthleteTeamInterestSchema.index({ teamProfile: 1, status: 1, lastExpressedAt: -1 });

export const AthleteTeamInterestModel = mongoose.model<IAthleteTeamInterest>('AthleteTeamInterest', AthleteTeamInterestSchema);
