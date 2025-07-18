import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import AdminModel from '../../admin/model/AdminModel';
import { AthleteModel } from '../../athlete/models/AthleteModel';
import { ClaimType } from '../../auth/model/ClaimSchema';
import User, { UserType } from '../../auth/model/User';
import TeamModel from '../../team/model/TeamModel';
import { EmailService } from '../email/EmailService';
import Notification from '../model/Notification';

export default class UserEvents {
  public onPasswordUpdated = async (event: { userId: string; newPassword: string }) => {
    const { userId, newPassword } = event;
    console.log(`[Notification] Password updated for user ID: ${userId}`);
    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      throw new ErrorUtil('User not found', 404);
    }

    // Send email notification
    // TODO: implement a proper email template for password updates
    // await EmailService.sendEmail({
    //   to: user.email,
    //   subject: 'Your Password Has Been Updated',
    //   templateId: 'd-afbb4777e2d249a6a7eaaab1e4cb3395',
    //   data: {
    //     name: user.fullName,
    //     profileImageUrl: user.profileImageUrl,
    //     subject: 'Your Password Has Been Updated',
    //   },
    // });

    // Create a notification
    await Notification.insertNotification(
      user._id as any,
      null as any,
      'Password Updated',
      `Your password has been updated successfully.`,
      'user.passwordUpdated',
      user._id as any
    );
  };
}
