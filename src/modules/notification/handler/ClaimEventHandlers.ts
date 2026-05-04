import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import AdminModel from '../../profiles/admin/model/AdminModel';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { ClaimType } from '../../auth/model/ClaimSchema';
import User, { UserType } from '../../auth/model/User';
import TeamModel from '../../profiles/team/model/TeamModel';
import { EmailService } from '../email/EmailService';
import Notification from '../model/Notification';

export default class ClaimEventHandlers {
  private modelMap: Record<string, Model<any>> = {
    team: TeamModel,
    athlete: AthleteModel,
    // extend with other models as needed
  };

  claimCreated = async (event: { claimDetails: ClaimType }) => {
    const { claimDetails } = event;
    if (!claimDetails) {
      throw new ErrorUtil('Claim details are required for claim creation event handling', 400);
    }
    console.info(`[Notification] Claim created with ID: ${claimDetails._id}`);

    const user = await User.findById(claimDetails.user);
    const profile = await this.modelMap[claimDetails.claimType].findById(claimDetails.profile);
    if (!user || !profile) {
      throw new ErrorUtil('User or Profile not found for the claim', 404);
    }
    try {
      await EmailService.sendEmail({
        to: user.email,
        subject: 'Your Claim Has Been Created Successfully',
        templateId: 'd-afbb4777e2d249a6a7eaaab1e4cb3395',
        data: {
          name: user.fullName,
          profileImageUrl: profile.profileImageUrl,
          profileName: profile.name,
          subject: 'Your Claim Has Been Created Successfully',
        },
      });

      // Find all admins and use the InsertNotification method from the Notification Model to insert a notification about a new claim
      const admins = await AdminModel.find({ role: 'developer' });
      for (const admin of admins) {
        await Notification.insertNotification(
          admin._id as any,
          null as any,
          'New Claim Created',
          `A new claim has been created by ${user.firstName} (${user.email}).`,
          'claim.created',
          claimDetails._id as any
        );
      }
    } catch (err: any) {
      console.error('Failed to send claim creation email:', err);
      throw new ErrorUtil('Failed to send claim creation email', 500);
    }
  };
}
