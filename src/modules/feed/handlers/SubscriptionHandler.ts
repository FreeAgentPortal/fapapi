import { Request } from 'express';
import mongoose, { ObjectId } from 'mongoose';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { CRUDHandler } from '../../../utils/CRUDHandler';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { ISubscription, Subscription } from '../model/SubscriptionModel';
type RoleRef = {
  role: 'athlete' | 'team' | 'scout' | 'agent';
  profileId: ObjectId;
};

/**
 * Handles creation, retrieval, and modification of athlete profiles.
 */
export class Handler extends CRUDHandler<ISubscription> {
  constructor() {
    super(Subscription);
  }

  /**
   * @Description - toggles a subscription between two profiles.
   */
  async toggle(subscriber: RoleRef, target: RoleRef): Promise<{ subscribed: boolean }> {
    const existing = await Subscription.findOne({ 'subscriber.profileId': subscriber.profileId, 'target.profileId': target.profileId });

    if (existing) {
      console.log(`Unsubscribing ${subscriber.profileId} from ${target.profileId}`);
      await Subscription.deleteOne({ _id: existing._id });
      return { subscribed: false };
    }

    console.log(`Subscribing ${subscriber.profileId} to ${target.profileId}`);
    await Subscription.create({ subscriber, target, createdAt: new Date(), updatedAt: new Date() });
    return { subscribed: true };
  }
}
