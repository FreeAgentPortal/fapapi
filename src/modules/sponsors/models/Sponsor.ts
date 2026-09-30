import mongoose, { Document, Schema, Types } from 'mongoose';

export interface SponsorLogo {
  url: string;
  publicId: string;
  altText?: string;
}

export interface ISponsor extends Document {
  __v: number;
  businessName: string;
  websiteUrl?: string;
  logo: SponsorLogo;
  isActive: boolean;
  displayOrder: number;
  startsAt?: Date;
  endsAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function hasUrlProtocol(value: string, protocols: string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const SponsorLogoSchema = new Schema<SponsorLogo>(
  {
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value: string) => hasUrlProtocol(value, ['https:']),
        message: 'Logo URL must be a valid HTTPS URL',
      },
    },
    publicId: { type: String, required: true, trim: true },
    altText: { type: String, trim: true },
  },
  { _id: false }
);

const SponsorSchema = new Schema<ISponsor>(
  {
    businessName: { type: String, required: true, trim: true },
    websiteUrl: {
      type: String,
      trim: true,
      validate: {
        validator: (value: string | null | undefined) => value == null || hasUrlProtocol(value, ['http:', 'https:']),
        message: 'Website URL must be a valid HTTP or HTTPS URL',
      },
    },
    logo: { type: SponsorLogoSchema, required: true },
    isActive: { type: Boolean, required: true, default: false },
    displayOrder: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Display order must be an integer',
      },
    },
    startsAt: { type: Date },
    endsAt: {
      type: Date,
      validate: {
        // Future updates must validate the full document to compare both dates.
        validator: function (this: ISponsor, value: Date | null | undefined): boolean {
          return value == null || this.startsAt == null || value > this.startsAt;
        },
        message: 'endsAt must be after startsAt',
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

SponsorSchema.index({ isActive: 1, displayOrder: 1 });

export const SponsorModel = mongoose.model<ISponsor>('Sponsor', SponsorSchema);

export default SponsorModel;
