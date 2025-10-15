import mongoose, { Schema, Types } from 'mongoose';

export const RegistrationStatus = {
  INTERESTED: 'interested', // light-weight “I’m watching this”
  APPLIED: 'applied', // submitted registration answers
  INVITED: 'invited', // invited by team
  CONFIRMED: 'confirmed', // has a spot
  WAITLISTED: 'waitlisted',
  DECLINED: 'declined',
  NO_SHOW: 'no-show',
  ATTENDED: 'attended',
} as const;
export type RegistrationStatus = (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

export interface EventRegistrationDocument extends mongoose.Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  userId: Types.ObjectId; // who is acting (athlete/agent/scout)
  athleteProfileId?: Types.ObjectId; // if applicable
  role: 'athlete' | 'agent' | 'scout' | 'media';

  status: RegistrationStatus;

  // answers keyed by Event.registration.questions[].key
  answers?: Record<string, string | number | boolean | string[]>;

  // server-side stamps
  createdAt: Date;
  updatedAt: Date;
}

const EventRegistrationSchema = new Schema<EventRegistrationDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    athleteProfileId: { type: Schema.Types.ObjectId, ref: 'AthleteProfile', index: true },
    role: { type: String, enum: ['athlete', 'agent', 'scout', 'media'], required: true },

    status: {
      type: String,
      enum: Object.values(RegistrationStatus),
      default: RegistrationStatus.INTERESTED,
      index: true,
    },

    answers: { type: Schema.Types.Mixed }, // validated at service layer to keep schema simple
  },
  { timestamps: true }
);

// A user has at most one registration record per event
EventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export const EventRegistrationModel = mongoose.models.EventRegistration || mongoose.model<EventRegistrationDocument>('EventRegistration', EventRegistrationSchema);
