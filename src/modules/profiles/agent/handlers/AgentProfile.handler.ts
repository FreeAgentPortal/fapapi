import mongoose from 'mongoose';
import { CRUDHandler, PaginationOptions } from '../../../../utils/baseCRUD';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { AgentProfileModel, IAgentProfile } from '../model/AgentProfile';
import BillingAccount from '../../../auth/model/BillingAccount';
import { BillingValidator } from '../../../../utils/billingValidation';
import logger from '../../../../utils/logger';

export class AgentProfileHandler extends CRUDHandler<IAgentProfile> {
  constructor() {
    super(AgentProfileModel);
  }

  protected async afterCreate(doc: IAgentProfile): Promise<void> {
    const user = await mongoose.model('User').findById(doc.user);
    if (!user) {
      await this.Schema.findByIdAndDelete(doc._id);
      throw new ErrorUtil('[Profiles - Agent] User not found', 404);
    }

    user.profileRefs.agent = doc._id;
    await user.save();
  }

  async fetch(id: string): Promise<any | null> {
    return await this.Schema.findById(id).populate('user', '_id email fullName phoneNumber profileImageUrl').lean();
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: IAgentProfile[]; metadata: any[] }[]> {
    return await this.Schema.aggregate([
      {
        $match: {
          $and: [...options.filters],
          ...(options.query.length > 0 && { $or: options.query }),
        },
      },
      { $sort: options.sort },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page: options.page, limit: options.limit } }],
          entries: [
            { $skip: (options.page - 1) * options.limit },
            { $limit: options.limit },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'user',
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      email: 1,
                      fullName: 1,
                      profileImageUrl: 1,
                      phoneNumber: 1,
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: '$user',
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
    ]);
  }

  protected async afterDelete(doc: IAgentProfile | null): Promise<void> {
    if (!doc) {
      return;
    }

    const user = await mongoose.model('User').findById(doc.user);
    if (user?.profileRefs?.agent?.toString() === doc._id.toString()) {
      user.profileRefs.agent = undefined;
      await user.save();
    }
  }
  async getProfile(data: any): Promise<IAgentProfile> {
    const profile = await this.fetch(data.id);
    if (!profile) throw new ErrorUtil('Unable to fetch Profile', 400);

    const billing = await BillingAccount.findOne({ profileId: profile._id }).populate('plan');
    if (!billing) {
      throw new ErrorUtil('billing information not found', 400);
    }

    // Use the comprehensive billing validator
    const billingValidation = BillingValidator.validateBillingAccount(billing);
    logger.debug({ billingValidation }, '[AgentProfileHandler] Billing validation result');

    return {
      ...profile,
      needsBillingSetup: billingValidation.needsUpdate,
      billingValidation,
    } as any as IAgentProfile;
  }
}
