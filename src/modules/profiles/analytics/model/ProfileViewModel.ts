import mongoose, { Document, Schema } from 'mongoose';
import { ProfileSubjectType, ProfileViewSessionSource, ViewerProfileType } from '../types';

export interface IProfileView extends Document {
  _id: mongoose.Types.ObjectId;
  subjectType: ProfileSubjectType;
  subjectProfileId: mongoose.Types.ObjectId;
  viewerUserId: mongoose.Types.ObjectId;
  viewerProfileId: mongoose.Types.ObjectId;
  viewerType: ViewerProfileType;
  sessionHash: string;
  sessionSource: ProfileViewSessionSource;
  createdAt: Date;
  updatedAt: Date;
}

const ProfileViewSchema = new Schema<IProfileView>(
  {
    subjectType: {
      type: String,
      enum: ['athlete', 'professional'],
      required: true,
      index: true,
    },
    subjectProfileId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    viewerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    viewerProfileId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    viewerType: {
      type: String,
      enum: ['team', 'scout', 'agent', 'athlete', 'professional', 'admin'],
      required: true,
      index: true,
    },
    sessionHash: {
      type: String,
      required: true,
    },
    sessionSource: {
      type: String,
      enum: ['header', 'jwt', 'legacy'],
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'profile_views',
  }
);

ProfileViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
ProfileViewSchema.index({ subjectType: 1, subjectProfileId: 1, createdAt: -1 });
ProfileViewSchema.index({ subjectType: 1, subjectProfileId: 1, viewerType: 1, createdAt: -1 });
ProfileViewSchema.index(
  {
    subjectType: 1,
    subjectProfileId: 1,
    viewerType: 1,
    viewerProfileId: 1,
    sessionHash: 1,
  },
  { unique: true, name: 'unique_profile_view_per_session' }
);

export const ProfileViewModel = mongoose.model<IProfileView>('ProfileView', ProfileViewSchema);
