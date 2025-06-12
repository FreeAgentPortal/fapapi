import mongoose from 'mongoose';
export interface UserType extends mongoose.Document {
  _id: string;
  firstName: string;
  lastName: string;
  customerId: string;
  profileImageUrl: string;
  phoneNumber: string;
  email: string;
  password: string;
  role: string;
  fullName: string;
  isActive: boolean;
  resetPasswordToken: string | undefined | null;
  resetPasswordExpire: Date | undefined | null;
  createdAt: Date;
  updatedAt: Date;
  isEmailVerified: boolean;
  permissions: string[];
  emailVerificationToken: string | undefined | null;
  emailVerificationExpires: Date | undefined | null;
  profileRefs: Record<string, string | null>;
}

const UserSchema = new mongoose.Schema({}, { strict: false });

export default mongoose.model<UserType>('User', UserSchema);
