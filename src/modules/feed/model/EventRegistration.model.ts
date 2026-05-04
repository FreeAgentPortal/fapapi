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
  profileId?: {
    collection: 'AthleteProfile' | 'AgentProfile' | 'ScoutProfile' | 'MediaProfile';
    id: Types.ObjectId;
  };
  role: 'athlete' | 'agent' | 'scout' | 'media';

  status: RegistrationStatus;

  // answers with question context for display without needing to reference Event model
  answers?: Array<{
    key: string; // matches Event.registration.questions[].key
    label: string; // question text snapshot
    answer: string | number | boolean | string[]; // the user's response
  }>;

  // server-side stamps
  createdAt: Date;
  updatedAt: Date;
}

const ProfileIdSchema = new Schema(
  {
    collection: {
      type: String,
      enum: ['AthleteProfile', 'AgentProfile', 'ScoutProfile', 'MediaProfile'],
      required: true,
    },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const AnswerSchema = new Schema(
  {
    key: { type: String, required: true, trim: true }, // stable key from Event question
    label: { type: String, required: true, trim: true }, // question text snapshot
    answer: { type: Schema.Types.Mixed, required: true }, // string | number | boolean | string[]
  },
  { _id: false }
);

const EventRegistrationSchema = new Schema<EventRegistrationDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    profileId: { type: ProfileIdSchema },
    role: { type: String, enum: ['athlete', 'agent', 'scout', 'media'], required: true },

    status: {
      type: String,
      enum: Object.values(RegistrationStatus),
      default: RegistrationStatus.INTERESTED,
      index: true,
    },

    answers: [AnswerSchema], // array of question-answer pairs
  },
  { timestamps: true }
);

// A user has at most one registration record per event
EventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export const EventRegistrationModel = mongoose.models.EventRegistration || mongoose.model<EventRegistrationDocument>('EventRegistration', EventRegistrationSchema);
