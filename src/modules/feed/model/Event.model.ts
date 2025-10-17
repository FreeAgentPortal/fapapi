import mongoose, { Schema, Types } from 'mongoose';

/** Narrow string literal enums for safety + autocomplete */
export const EventType = {
  TRYOUT: 'tryout',
  PRACTICE: 'practice',
  SCRIMMAGE: 'scrimmage',
  GAME: 'game',
  CAMP: 'camp',
  COMBINE: 'combine',
  SHOWCASE: 'showcase',
  WORKOUT: 'workout',
  MEETING: 'meeting',
  OTHER: 'other',
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const Visibility = {
  PUBLIC: 'public', // discoverable by everyone
  TEAM: 'team', // visible to users linked to the team profile
  INVITE_ONLY: 'invite-only', // visible to those invited or given a link
  PRIVATE: 'private', // internal/team-staff only
} as const;
export type Visibility = (typeof Visibility)[keyof typeof Visibility];

export const Audience = {
  ATHLETES: 'athletes',
  AGENTS: 'agents',
  SCOUTS: 'scouts',
  MEDIA: 'media',
  ALL: 'all',
} as const;
export type Audience = (typeof Audience)[keyof typeof Audience];

export const LocationKind = {
  PHYSICAL: 'physical',
  VIRTUAL: 'virtual',
} as const;
export type LocationKind = (typeof LocationKind)[keyof typeof LocationKind];

const GeoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      // [lng, lat]
      type: [Number],
      required: true,
      validate: (v: number[]) => v.length === 2,
    },
  },
  { _id: false }
);

const PhysicalLocationSchema = new Schema(
  {
    venueName: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'US' },
    geo: { type: GeoPointSchema }, // add 2dsphere index on parent
  },
  { _id: false }
);

const VirtualLocationSchema = new Schema(
  {
    meetingUrl: { type: String, trim: true },
    passcode: { type: String, trim: true, select: false },
    platform: { type: String, trim: true }, // Zoom/Meet/Teams/etc.
  },
  { _id: false }
);

const LocationSchema = new Schema(
  {
    kind: { type: String, enum: Object.values(LocationKind), required: true },
    physical: { type: PhysicalLocationSchema },
    virtual: { type: VirtualLocationSchema },
  },
  { _id: false }
);

const OpponentSchema = new Schema(
  {
    // For cross-org games: either a known team_profile or a freeform label
    teamProfileId: { type: Schema.Types.ObjectId, ref: 'TeamProfile' },
    name: { type: String, trim: true }, // e.g., “Springfield Tigers (U18)”
    level: { type: String, trim: true }, // e.g., “HS Varsity”, “NCAA D2”, “Semi-Pro”
  },
  { _id: false }
);

const MetricRuleSchema = new Schema(
  {
    key: { type: String, required: true, trim: true }, // e.g. "fortyYard", "verticalJump"
    op: {
      type: String,
      enum: ['>=', '<=', '>', '<', '==', '!='],
      required: true,
    },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const EligibilitySchema = new Schema(
  {
    positions: [{ type: String, trim: true }], // sport-agnostic freeform labels
    ageRange: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
    },
    metrics: [MetricRuleSchema], // composable comparisons on athlete metrics
    tags: [{ type: String, trim: true }], // “QB”, “Lefty”, “U18”, “JuCo”, etc.
    verifiedOnly: { type: Boolean, default: false }, // only athletes w/ verified metrics
    diamondMin: { type: Number, min: 1, max: 5 }, // minimum scout “diamond” rating
  },
  { _id: false }
);

const QuestionSchema = new Schema(
  {
    key: { type: String, required: true, trim: true }, // stable key for answers
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['shortText', 'longText', 'singleSelect', 'multiSelect', 'number', 'boolean', 'url'],
      required: true,
    },
    required: { type: Boolean, default: false },
    options: [{ type: String, trim: true }], // for (multi)select
  },
  { _id: false }
);

const RegistrationSchema = new Schema(
  {
    required: { type: Boolean, default: false }, // can still express “interest” if false
    opensAt: { type: Date },
    closesAt: { type: Date },
    capacity: { type: Number, min: 0 }, // null/undefined = unlimited
    waitlistEnabled: { type: Boolean, default: true },
    allowWalkIns: { type: Boolean, default: false },
    price: { type: Number, min: 0 }, // optional monetization
    currency: { type: String, default: 'USD' },
    questions: [QuestionSchema],
  },
  { _id: false }
);

const RecurrenceSchema = new Schema(
  {
    // Keep simple for MVP; you can store an RFC5545 RRULE string later if needed
    freq: { type: String, enum: ['DAILY', 'WEEKLY', 'MONTHLY'] },
    interval: { type: Number, min: 1, default: 1 },
    byWeekday: [{ type: Number, min: 0, max: 6 }], // 0=Sun..6=Sat
    until: { type: Date },
  },
  { _id: false }
);

export interface EventDocument extends mongoose.Document {
  _id: Types.ObjectId;
  teamProfileId: Types.ObjectId; // owner/organizer team
  createdByUserId: Types.ObjectId; // auditing
  type: EventType;
  sport?: string; // “football”, “soccer”, etc. (freeform)
  title: string;
  description?: string;

  audience: Audience;
  visibility: Visibility;

  status: 'scheduled' | 'active' | 'completed' | 'canceled' | 'postponed';

  timezone: string; // IANA TZ, e.g., "America/New_York"
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;

  recurrence?: {
    freq?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    interval?: number;
    byWeekday?: number[];
    until?: Date;
  };

  location: {
    kind: LocationKind;
    physical?: {
      venueName?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      geo?: { type: 'Point'; coordinates: [number, number] };
    };
    virtual?: {
      meetingUrl?: string;
      passcode?: string;
      platform?: string;
    };
  };

  opponents?: Array<{
    teamProfileId?: Types.ObjectId;
    name?: string;
    level?: string;
  }>;

  registration?: {
    required: boolean;
    opensAt?: Date;
    closesAt?: Date;
    capacity?: number;
    waitlistEnabled: boolean;
    allowWalkIns: boolean;
    price?: number;
    currency?: string;
    questions: Array<{
      key: string;
      label: string;
      type: 'shortText' | 'longText' | 'singleSelect' | 'multiSelect' | 'number' | 'boolean' | 'url';
      required: boolean;
      options?: string[];
    }>;
  };

  eligibility?: {
    positions?: string[];
    ageRange?: { min?: number; max?: number };
    metrics?: Array<{ key: string; op: string; value: number }>;
    tags?: string[];
    verifiedOnly?: boolean;
    diamondMin?: number;
  };

  roster?: {
    maxParticipants?: number; // for practices/tryouts
    // future: lock roster, export, etc.
  };

  media?: Array<{ kind: 'image' | 'video' | 'link'; url: string; title?: string }>;
  tags?: string[];

  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<EventDocument>(
  {
    teamProfileId: { type: Schema.Types.ObjectId, ref: 'TeamProfile', required: true, index: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    type: { type: String, enum: Object.values(EventType), required: true },
    sport: { type: String, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true },

    audience: { type: String, enum: Object.values(Audience), default: Audience.ALL },
    visibility: { type: String, enum: Object.values(Visibility), default: Visibility.PUBLIC },

    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'canceled', 'postponed'],
      default: 'scheduled',
      index: true,
    },

    timezone: { type: String, required: true, default: 'America/New_York' },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    allDay: { type: Boolean, default: false },

    recurrence: { type: RecurrenceSchema },

    location: { type: LocationSchema, required: true },

    opponents: [OpponentSchema],

    registration: { type: RegistrationSchema },

    eligibility: { type: EligibilitySchema },

    roster: {
      maxParticipants: { type: Number, min: 1 },
    },

    media: [
      {
        kind: { type: String, enum: ['image', 'video', 'link'], required: true },
        url: { type: String, required: true, trim: true },
        title: { type: String, trim: true },
      },
    ],

    tags: [{ type: String, trim: true }],

    publishedAt: { type: Date },
  },
  { timestamps: true }
);

// ---- Indexing for fast feeds & geo search
EventSchema.index({ startsAt: 1, visibility: 1 });
EventSchema.index({ teamProfileId: 1, startsAt: 1 });
EventSchema.index({ 'location.physical.geo': '2dsphere' });
// Lightweight text search across title/description/tags:
EventSchema.index({ title: 'text', description: 'text', tags: 'text' });

// ---- Small invariants (pure guards)
EventSchema.pre('validate', function (next) {
  if (this.endsAt <= this.startsAt) {
    return next(new Error('endsAt must be after startsAt'));
  }
  if (this.location.kind === LocationKind.PHYSICAL && !this.location.physical) {
    return next(new Error('physical location details are required for kind=physical'));
  }
  if (this.location.kind === LocationKind.VIRTUAL && !this.location.virtual) {
    return next(new Error('virtual location details are required for kind=virtual'));
  }
  next();
});

export const EventModel = mongoose.models.Event || mongoose.model<EventDocument>('Event', EventSchema);
