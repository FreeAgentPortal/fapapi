import mongoose from 'mongoose';
import bcyrpt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * @description Interface for the User model
 *
 * @author Austin Howard
 * @since 1.0
 * @version 1.0
 * @lastModified - 2023-06-11T16:20:26.000-05:00
 */
export interface UserType extends mongoose.Document {
  _id: string;
  firstName: string;
  lastName: string;
  customerId: string;
  profileImageUrl: string;
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
  emailVerificationToken: string | undefined | null;
  emailVerificationExpires: Date | undefined | null;
  profileRefs: Record<string, string | null>;
  getSignedJwtToken: () => string;
  getResetPasswordToken: () => string;
  matchPassword: (enteredPassword: string) => boolean;
}

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'Please add a name'],
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 10,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true, // soft delete
    },
    role: [
      {
        type: String,
        default: ['user'],
        enum: ['user', 'admin', 'player', 'agent', 'team', 'developer'],
      },
    ],
    fullName: {
      type: String,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
      select: false, // do not return this field by default
    },
    resetPasswordExpire: Date,
    emailVerificationToken: {
      type: String,
    },
    emailVerificationExpires: {
      type: Date,
    },
    profileRefs: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password before saving new user
// Should hash the password on registration.
UserSchema.pre('save', async function (next) {
  //conditional will check to see if the password is being modified so it wont update the password constantly.
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcyrpt.genSalt(10);
  this.password = await bcyrpt.hash(this.password!, salt);
});

// creates the fullName field.
UserSchema.pre('save', async function () {
  const firstName = this.firstName ?? '';
  const lastName = this.lastName ?? '';
  this.fullName = `${firstName} ${lastName}`.trim();
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  // JWT_SECRET is an environment variable, use the ! to tell typescript that it will be there.
  // as this method requires the JWT_SECRET to be set, it cannot be null or undefined.
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET!, {
    expiresIn: '30d',
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword: string) {
  return await bcyrpt.compare(enteredPassword, this.password);
};
// enforces that the email string be lower case throughout, as if it isnt, a user with
// test@email.com and a user Test@email.com do not match, and you can end up with duplicate emails..
UserSchema.pre('save', async function (next) {
  this.email = this.email!.toLowerCase();
  next();
});

// Generate and hash password token
UserSchema.methods.getResetPasswordToken = async function () {
  // Generate a token
  // this returns a buffer, we want to make it into a string
  const resetToken = crypto.randomBytes(20).toString('hex');
  // Hash token and set to resetPasswordToken field.
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Set expiration, 10 minutes
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  // save the user
  await this.save({ validateBeforeSave: true });
  return resetToken;
};
export default mongoose.model<UserType>('User', UserSchema);
