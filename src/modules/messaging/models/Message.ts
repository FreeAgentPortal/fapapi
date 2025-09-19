import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMessage extends Document {
  conversation: Types.ObjectId;
  receiver: {
    profile: Types.ObjectId;
    role: 'team' | 'athlete';
  };
  sender: {
    profile: Types.ObjectId;
    role: 'team' | 'athlete';
  };
  content: string;
  read: boolean;

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

  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: {
      profile: { type: Schema.Types.ObjectId, refPath: 'sender.role', required: true },
      role: { type: String, enum: ['team', 'athlete'], required: true },
    },
    receiver: {
      profile: { type: Schema.Types.ObjectId, refPath: 'receiver.role', required: true },
      role: { type: String, enum: ['team', 'athlete'], required: true },
    },
    content: { type: String, required: true },
    read: { type: Boolean, default: false },

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
        action: {
          type: String,
          enum: ['created', 'edited', 'archived', 'hidden', 'restored', 'deleted'],
          required: true,
        },
        reason: { type: String },
        timestamp: { type: Date, default: Date.now, required: true },
        previousState: {
          status: { type: String, enum: ['active', 'archived', 'hidden', 'deleted'] },
          isArchived: { type: Boolean },
          isHidden: { type: Boolean },
        },
      },
    ],
  },
  { timestamps: true }
);

export const MessageModel = mongoose.model<IMessage>('Message', MessageSchema);
