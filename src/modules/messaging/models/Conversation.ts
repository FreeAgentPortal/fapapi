import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IConversation extends Document {
  participants: {
    team: Types.ObjectId;
    athlete: Types.ObjectId;
  };
  lastMessage?: Types.ObjectId;
  // Admin/Moderator fields
  status: 'active' | 'archived' | 'hidden' | 'deleted';
  moderationActions: Array<{
    performedBy: {
      profile: Types.ObjectId;
      role: 'team' | 'athlete' | 'admin';
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
      team: { type: Schema.Types.ObjectId, ref: 'TeamProfile', required: true },
      athlete: { type: Schema.Types.ObjectId, ref: 'AthleteProfile', required: true },
    },
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
          role: { type: String, enum: ['team', 'athlete', 'admin'], required: true },
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

export const ConversationModel = mongoose.model<IConversation>('Conversation', ConversationSchema);
