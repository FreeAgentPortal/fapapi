import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler } from '../../../utils/baseCRUD';
import ClaimSchema, { ClaimType } from '../model/ClaimSchema';
import TeamModel from '../../team/model/TeamModel';
import { AthleteModel } from '../../athlete/models/AthleteModel';

export class ClaimHandler extends CRUDHandler<ClaimType> {
  constructor() {
    super(ClaimSchema);
  }

  protected async beforeCreate(data: any): Promise<void> {
      
  }

  modelMap: Record<string, Model<any>> = {
    team: TeamModel,
    athlete: AthleteModel,
    // extend with other models as needed
  };

  async fetchClaimStatus(type: string, profileId: string): Promise<{ success: boolean; claim: ClaimType | undefined; profile?: any }> {
    console.log(`Fetching claim status for profile ID: ${profileId}`);
    // we are passed in a type, this type is what model we need to query to see if the profile exists
    const Model = this.modelMap[type];

    const profile = (await Model.findOne({ slug: profileId }).lean()) as any;

    if (!profile) {
      throw new ErrorUtil(`Profile with ID ${profileId} not found for type ${type}.`, 404);
    }
    const claim = await this.Schema.findOne({ profile: profile._id }).lean();
    if (!claim) {
      return {
        success: false,
        claim: undefined,
        profile: { ...profile, type },
      };
    }
    return {
      success: true,
      claim: claim,
      profile: { ...profile, type },
    };
  }
}
