import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler } from '../../../utils/baseCRUD';
import ClaimSchema, { ClaimType } from '../model/ClaimSchema';
import TeamModel from '../../team/model/TeamModel';
import { AthleteModel } from '../../athlete/models/AthleteModel';
import { UserType } from '../model/User';
import { LocalUploadClient } from '../clients/UploadClient';

export class ClaimHandler extends CRUDHandler<ClaimType> {
  constructor() {
    super(ClaimSchema);
  }

  async create(data: any): Promise<ClaimType> {
    console.log(`Creating claim for profile ID: ${data.profile}`);
    // Validate the data and create a new claim
    if (!data.profile || !data.claimType) {
      throw new ErrorUtil('Profile ID and claim type are required.', 400);
    }
    const profile = await this.modelMap[data.claimType].findOne({ slug: data.profile }).lean();
    if (!profile || Array.isArray(profile)) {
      throw new ErrorUtil(`Profile with ID ${data.profile} not found for type ${data.claimType}.`, 404);
    }

    const claim = await this.Schema.create({
      profile: (profile as any)._id,
      claimType: data.claimType,
      user: data.user,
    });
    return claim;
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

  async handleClaim(data: { action: 'approve' | 'deny'; message?: string }, claimId: string): Promise<{ claim: ClaimType; profile?: any }> {
    const uploadClient = new LocalUploadClient();
    console.log(`Handling claim ${data.action} for claim ID: ${claimId}`);
    const claim = await this.Schema.findById(claimId).populate('user');
    if (!claim) {
      throw new ErrorUtil(`Claim with ID ${claimId} not found.`, 404);
    }
    const profile = await this.modelMap[claim.claimType].findById(claim.profile);
    if (!profile) {
      throw new ErrorUtil(`Profile with ID ${claim.profile} not found for type ${claim.claimType}.`, 404);
    }
    const user = claim.user as any as UserType;
    // Perform action based on the claim action
    if (data.action === 'approve') {
      console.log(`Approving claim for user ${user._id} and profile ${profile._id}`);
      // Add user to profile access list
      profile.linkedUsers.push({
        user: user._id,
        role: 'admin', // Could be dynamic if needed
      });
      await profile.save();

      // Update user's profileRefs
      user.profileRefs[claim.claimType] = profile._id;
      await user.save();

      // Clean up sensitive docs, To do this we need to remove the documents from the claim and remove them from the CDN
      for (const doc of claim.documents || []) {
        await uploadClient.deleteFile(doc.url);
      }
      claim.documents = [] as any; // Clear documents from the claim
      claim.status = 'approved';
      claim.message = data.message || 'Your claim has been approved. You now have access to the profile.';
    } else {
      console.log(`Denying claim for user ${user._id} and profile ${profile._id}`);
      // clean up sensitive docs, user will need to initiate a new claim if they want to try again
      for (const doc of claim.documents || []) {
        await uploadClient.deleteFile(doc.url);
      }
      claim.documents = [] as any; // Clear documents from the claim
      // Set claim status to denied
      claim.status = 'denied';
      claim.message = data.message || 'Your claim has been denied. Please contact support for more information.';
    }

    await this.Schema.findByIdAndUpdate(claimId, claim, { new: true, runValidators: true });
    return {
      claim,
      profile: { ...profile, type: claim.claimType },
    };
  }
}
