import mongoose, { Document, ObjectId, Schema } from 'mongoose';

export interface ISubscription extends Document {
  _id: ObjectId;
  subscriber: {
    role: 'athlete' | 'team' | 'scout' | 'agent';
    profileId: ObjectId; // the one doing the subscribing
  };
  target: {
    role: 'team' | 'athlete'; // the entity being watched
    profileId: ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    subscriber: {
      role: { type: String, enum: ['athlete', 'team', 'scout', 'agent'], required: true },
      profileId: { type: Schema.Types.ObjectId, refPath: 'subscriber.role', required: true },
    },
    target: {
      role: { type: String, enum: ['team', 'athlete'], required: true },
      profileId: { type: Schema.Types.ObjectId, refPath: 'target.role', required: true },
    },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
