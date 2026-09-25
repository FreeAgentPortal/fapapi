import mongoose, { Schema } from 'mongoose';

interface ITeamMessageReminder {
  // One delivery record per conversation, team member, and channel.
  _id: string;
  lastSentAt?: Date;
  lockedUntil?: Date;
  lockToken?: string;
}

const TeamMessageReminderSchema = new Schema<ITeamMessageReminder>(
  {
    _id: { type: String, required: true },
    lastSentAt: Date,
    lockedUntil: Date,
    lockToken: String,
  },
  { timestamps: true }
);

export const TeamMessageReminderModel = mongoose.model<ITeamMessageReminder>('TeamMessageReminder', TeamMessageReminderSchema);
