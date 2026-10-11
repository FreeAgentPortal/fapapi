import mongoose, { Schema } from 'mongoose';
import { FEATURE_UPDATE_PORTALS, FeatureUpdatePortal } from '../types';

const schema = new Schema({
  portal: { type: String, enum: FEATURE_UPDATE_PORTALS, required: true, unique: true, immutable: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
}, { timestamps: true, strict: 'throw' });

export const DEFAULT_FEATURE_UPDATE_TITLE = "Check out What's new on Free Agent Portal";

// Preserve the existing browser acknowledgment namespace while using singular portal tags.
export function appIdForPortal(portal: FeatureUpdatePortal): string {
  return portal === 'agent' ? 'agents' : portal;
}

export default mongoose.model('FeatureUpdatePortal', schema);
