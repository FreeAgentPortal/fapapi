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
  },
  { timestamps: true }
);

export const MessageModel = mongoose.model<IMessage>('Message', MessageSchema);
