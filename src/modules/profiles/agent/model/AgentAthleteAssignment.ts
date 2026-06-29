import mongoose, { Document, Schema } from 'mongoose';

export type AgentAthleteAssignmentStatus = 'pending' | 'accepted' | 'declined' | 'removed';

export interface IAgentAthleteAssignment extends Document {
  _id: mongoose.Types.ObjectId;
  agentProfile: mongoose.Types.ObjectId;
  athleteProfile: mongoose.Types.ObjectId;
  athleteUser?: mongoose.Types.ObjectId;
  invitedBy?: mongoose.Types.ObjectId;
  status: AgentAthleteAssignmentStatus;
  message?: string;
  invitedAt: Date;
  respondedAt?: Date;
  acceptedAt?: Date;
  removedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AgentAthleteAssignmentSchema = new Schema<IAgentAthleteAssignment>(
  {
    agentProfile: { type: Schema.Types.ObjectId, ref: 'AgentProfile', required: true, index: true },
    athleteProfile: { type: Schema.Types.ObjectId, ref: 'AthleteProfile', required: true, index: true },
    athleteUser: { type: Schema.Types.ObjectId, ref: 'User' },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'removed'],
      default: 'pending',
      index: true,
    },
    message: { type: String, trim: true, maxlength: 1000 },
    invitedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
    acceptedAt: { type: Date },
    removedAt: { type: Date },
  },
  { timestamps: true }
);

AgentAthleteAssignmentSchema.index(
  { agentProfile: 1, athleteProfile: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'accepted'] } },
  }
);

export const AgentAthleteAssignmentModel = mongoose.model<IAgentAthleteAssignment>('AgentAthleteAssignment', AgentAthleteAssignmentSchema);
