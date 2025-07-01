import { IAthlete, AthleteModel } from '../models/AthleteModel'; 
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import BillingAccount from '../../auth/model/BillingAccount';
import mongoose from 'mongoose';
import { CRUDHandler } from '../../../utils/baseCRUD';

export interface AthleteProfileInput {
  fullName: string;
  contactNumber?: string;
  email?: string;
  hometown?: string;
  birthdate?: Date;
  measurements?: Map<string, string>;
  metrics?: Map<string, number>;
  college?: string;
  position?: string;
  highSchool?: string;
  awards?: string[];
  strengths?: string;
  weaknesses?: string;
  testimony?: string;
  profileImageUrl?: string;
  highlightVideos?: string[];
}

/**
 * Handles creation, retrieval, and modification of athlete profiles.
 */
export class AthleteProfileHandler extends CRUDHandler<IAthlete> {
  constructor() {
    super(AthleteModel);
  }

  /**
   * Overrides the base create method to require a userId and AthleteProfileInput.
   * @param userId User ID for the athlete
   * @param data Athlete profile input
   * @returns The created athlete document
   */
  async beforeCreate(data: IAthlete): Promise<void> {
    const existing = await this.Schema.findOne({ userId: data.userId });
    if (existing) {
      throw new ErrorUtil('Athlete profile already exists for this user.', 400);
    }
  }

  async getProfile(data: any): Promise<IAthlete> {
    const profile = await this.fetch(data.id);
    if (!profile) throw new ErrorUtil('Unable to fetch Profile', 400);
    const billing = await BillingAccount.findOne({ profileId: profile._id });
    if (!billing) {
      throw new ErrorUtil('billing information not found', 400);
    }
    return {
      ...profile,
      needsBillingSetup: !billing.vaulted,
    } as any as IAthlete;
  }

  async fetch(id: string): Promise<any | null> {
    const [result] = await this.Schema.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) },
      },

      {
        // find all subscriptions for the athlete,
        // each subscription will have a subscriber.profileId which is the athlete's profileId
        // and a target.profileId which is the profileId of the subscribed profile
        $lookup: {
          from: 'subscriptions',
          let: { athleteId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [{ $eq: ['$subscriber.profileId', '$$athleteId'] }, { $eq: ['$target.profileId', '$$athleteId'] }],
                },
              },
            },
            {
              $project: {
                _id: 0,
                subscribed: { $cond: [{ $eq: ['$subscriber.profileId', '$$athleteId'] }, true, false] },
                targetProfileId: '$target.profileId', 
              },
            },
          ],
          as: 'subscriptions',
        },
      },
    ]);
    return result;
  }
}
