import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMessage extends Document {
  conversation: Types.ObjectId;
  sender: {
    user: Types.ObjectId;
    profile: Types.ObjectId;
    role: 'scout' | 'athlete';
  };
  content: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: {
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      profile: { type: Schema.Types.ObjectId, refPath: 'sender.role', required: true },
      role: { type: String, enum: ['scout', 'athlete'], required: true },
    },
    content: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const MessageModel = mongoose.model<IMessage>('Message', MessageSchema);
