import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IConversation extends Document {
  participants: {
    scout: Types.ObjectId;
    athlete: Types.ObjectId;
  };
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
    messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
  },
  { timestamps: true }
);

export const ConversationModel = mongoose.model<IConversation>('Conversation', ConversationSchema);
