import mongoose, { ObjectId, Schema } from 'mongoose';

export interface FeatureType extends mongoose.Document {
  _id: ObjectId;
  name: string;
  shortDescription: string;
  detailedDescription: string;
  isActive: boolean;
  type: string;
}

interface ModelAttributes extends FeatureType {}

/**
 * @author                       - Austin Howard
 * @version                      1.0.3
 * @since                        1.0.0
 * @lastModifiedBy               - Austin Howard
 * @lastModifiedOn               - 2025-06-09 19:03:17
 */
const schema = new Schema<ModelAttributes>(
  {
    name: { type: String, required: true, unique: true },
    shortDescription: { type: String, required: true },
    detailedDescription: { type: String }, // For marketing or display purposes
    type: {
      type: String,
      enum: ['analytics', 'visibility', 'media', 'profile-enhancement', 'scouting', 'admin', 'misc'],
      default: 'misc',
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<FeatureType>('Feature', schema);
