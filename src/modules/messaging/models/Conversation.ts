import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IConversation extends Document {
  participants: {
    team?: Types.ObjectId;
    athlete?: Types.ObjectId;
    agent?: Types.ObjectId;
    agents?: Types.ObjectId[];
  };
  directKey?: string;
  lastMessage?: Types.ObjectId;
  // Admin/Moderator fields
  status: 'active' | 'archived' | 'hidden' | 'deleted';
  moderationActions: Array<{
    performedBy: {
      profile: Types.ObjectId;
      role: 'team' | 'athlete' | 'agent' | 'admin';
    };
    action: 'created' | 'edited' | 'archived' | 'hidden' | 'restored' | 'deleted';
    reason?: string;
    timestamp: Date;
    previousState?: {
      status: 'active' | 'archived' | 'hidden' | 'deleted';
      isArchived: boolean;
      isHidden: boolean;
    };
  }>;
  messages: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: {
      team: { type: Schema.Types.ObjectId, ref: 'TeamProfile' },
      athlete: { type: Schema.Types.ObjectId, ref: 'AthleteProfile' },
      agent: { type: Schema.Types.ObjectId, ref: 'AgentProfile' },
      agents: { type: [{ type: Schema.Types.ObjectId, ref: 'AgentProfile' }], default: undefined },
    },
    directKey: { type: String },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    // Admin/Moderator fields
    status: {
      type: String,
      enum: ['active', 'archived', 'hidden', 'deleted'],
      default: 'active',
    },
    moderationActions: [
      {
        performedBy: {
          profile: { type: Schema.Types.ObjectId, refPath: 'moderationActions.performedBy.role', required: true },
          role: { type: String, enum: ['team', 'athlete', 'agent', 'admin'], required: true },
        },
        action: { type: String, enum: ['created', 'edited', 'archived', 'hidden', 'restored', 'deleted'], required: true },
        reason: { type: String },
        timestamp: { type: Date, default: Date.now },
        previousState: {
          status: { type: String, enum: ['active', 'archived', 'hidden', 'deleted'] },
          isArchived: { type: Boolean },
          isHidden: { type: Boolean },
        },
      },
    ],

    messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
  },
  { timestamps: true }
);

// Existing team/athlete records have no directKey and are unaffected.
ConversationSchema.index({ directKey: 1 }, { unique: true, partialFilterExpression: { directKey: { $type: 'string' } } });
ConversationSchema.pre('validate', function () {
  const { team, athlete, agent, agents } = this.participants;
  if (agents?.length) {
    if (agents.length !== 2 || new Set(agents.map(String)).size !== 2 || team || athlete || agent) {
      this.invalidate('participants.agents', 'A direct agent conversation requires two distinct agents.');
    }
    return;
  }
  if ([team, athlete, agent].filter(Boolean).length < 2) {
    this.invalidate('participants', 'A conversation requires at least two participants.');
  }
});

export const ConversationModel = mongoose.model<IConversation>('Conversation', ConversationSchema);
