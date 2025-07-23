import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import AdminModel from '../../profiles/admin/model/AdminModel';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { ClaimType } from '../../auth/model/ClaimSchema';
import User, { UserType } from '../../auth/model/User';
import TeamModel from '../../profiles/team/model/TeamModel';
import { EmailService } from '../email/EmailService';
import Notification from '../model/Notification';

export default class ProfileEventHandler {
  async profilePopulated(event: { profileDetails: any }) {
    const { profileDetails } = event;
    if (!profileDetails) {
      throw new ErrorUtil('Profile details are required for profile populated event handling', 400);
    }
    console.log(`[Notification] Profile populated with ID: ${profileDetails._id}`);

    const user = await User.findById(profileDetails.user);
    if (!user) {
      throw new ErrorUtil('User not found for the profile', 404);
    }

    try { 
    } catch (err: any) {
      console.error('Failed to send profile population email:', err);
      throw new ErrorUtil('Failed to send profile population email', 500);
    }
  }
}
