import mongoose, { Document, Schema, Types } from 'mongoose';
import { FEATURE_UPDATE_PORTALS, FeatureUpdateFields, FeatureUpdateMediaOptions } from '../types';
import { isReleaseDate, isSafeDestination, isSafePublicPath } from '../utils/featureUpdateInput';

export interface IFeatureUpdate extends FeatureUpdateFields, Document {
  __v: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const optionsSchema = new Schema<FeatureUpdateMediaOptions>({
  placement: { type: String, enum: ['side', 'banner'] },
  fit: { type: String, enum: ['cover', 'contain'] },
  aspectRatio: { type: Number, validate: (value: number) => Number.isFinite(value) && value > 0 },
  controls: Boolean,
  autoPlay: Boolean,
  muted: Boolean,
  loop: Boolean,
  poster: { type: String, maxlength: 2048, validate: isSafeDestination },
}, { _id: false, strict: 'throw' });

const mediaSchema = new Schema<NonNullable<FeatureUpdateFields['media']>>({
  type: { type: String, enum: ['image', 'video'], required: true },
  src: { type: String, required: true, maxlength: 2048, validate: isSafeDestination },
  alt: { type: String, required: true, trim: true, maxlength: 500 },
  options: { type: optionsSchema, default: undefined },
}, { _id: false, strict: 'throw' });

const actionSchema = new Schema<NonNullable<FeatureUpdateFields['action']>>({
  type: { type: String, enum: ['internal', 'external'], required: true },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  href: {
    type: String, required: true, maxlength: 2048,
    validate: function (this: NonNullable<FeatureUpdateFields['action']>, value: string) {
      return isSafeDestination(value) && (this.type !== 'internal' || isSafePublicPath(value));
    },
  },
}, { _id: false, strict: 'throw' });

const schema = new Schema<IFeatureUpdate>({
  key: { type: String, required: true, unique: true, immutable: true, trim: true, maxlength: 120 },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  releasedAt: { type: String, required: true, validate: isReleaseDate },
  badge: { type: String, trim: true, maxlength: 80 },
  highlights: { type: [{ type: String, required: true, trim: true, maxlength: 1000 }], default: undefined, validate: (values: string[]) => values.length <= 30 },
  media: { type: mediaSchema, default: undefined },
  action: { type: actionSchema, default: undefined },
  enabled: { type: Boolean, required: true, default: false },
  belongs_to: {
    type: [{ type: String, enum: FEATURE_UPDATE_PORTALS, required: true }], required: true,
    validate: { validator: (values: string[]) => values.length > 0 && new Set(values).size === values.length, message: 'belongs_to requires unique portal tags' },
  },
  displayOrder: { type: Number, default: 0, required: true, min: 0, validate: Number.isSafeInteger },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, optimisticConcurrency: true, strict: 'throw' });

schema.index({ belongs_to: 1, enabled: 1, displayOrder: 1, releasedAt: -1, _id: 1 });

export default mongoose.model<IFeatureUpdate>('FeatureUpdate', schema);
