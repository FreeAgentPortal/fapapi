import mongoose, { Types } from 'mongoose';
import { ObjectId } from 'mongoose';

export interface SignInLogType extends mongoose.Document {
  _id: ObjectId;
  userId: ObjectId;
  ipAddress: string;
  signedInAt: Date;
}

const SignInLogSchema = new mongoose.Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    signedInAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: 'sign_in_logs',
  }
);

// Automatically delete logs older than 60 days
SignInLogSchema.index({ signedInAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

const SignInLog = mongoose.model<SignInLogType>('SignInLog', SignInLogSchema);

export default SignInLog;
