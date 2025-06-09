import mongoose, { ObjectId, Schema } from 'mongoose';

export interface FeatureType {
  name: string;
  price: number;
  description: string;
  isInactive: boolean;
  availableTo: [string];
  tier: string;
  user: ObjectId;
  reliesOn: ObjectId;
}

interface ModelAttributes extends FeatureType {}

/**
 * @description                 - FeatureSchema model, this is the schema for the features that are available to the user to select.
 *                             Each feature has a name, price, and a description.
 *                             The user builds their account based
 * @param {String} name         - The name of the feature
 * @param {Number} price        - The price of the feature
 * @param {String} description  - The description of the feature
 * @param { String } createdAt  - The date the feature was created
 * @param { String } updatedAt  - The date the feature was last updated
 * @param { Boolean } isInactive - Used to hide features from the user, for example, if a feature is no longer available
 *                             or if the feature is not yet available
 * @param { ObjectId } user     - The user that created the feature
 * @param { ObjectId } reliesOn - The feature that this feature relies on
 *
 * @author                       - Austin Howard
 * @version                      1.0.0
 * @since                        1.0.0
 * @lastModifiedBy               - Austin Howard
 * @lastModifiedOn               - 2024-11-03 20:30:29
 */
const schema = new Schema<ModelAttributes>(
  {
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    reliesOn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Feature',
    },
    description: {
      type: String,
      required: true,
    },
    availableTo: {
      type: [String],
      enum: ['athlete', 'team', 'agent', 'scout', 'media'],
      required: true,
      default: [],
    },
    tier: {
      type: String,
      enum: ['silver', 'gold', 'platinum'],
      default: 'silver',
    },
    // used to hide features from the user, for example, if a feature is no longer available
    // or if the feature is not yet available
    isInactive: {
      type: Boolean,
      default: false,
    },
    // user that created the feature
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<FeatureType>('Feature', schema);
