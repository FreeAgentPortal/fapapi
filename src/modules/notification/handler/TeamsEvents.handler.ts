import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import AdminModel from '../../profiles/admin/model/AdminModel';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { ClaimType } from '../../auth/model/ClaimSchema';
import User, { UserType } from '../../auth/model/User';
import TeamModel from '../../profiles/team/model/TeamModel';
import { EmailService } from '../email/EmailService';
import Notification from '../model/Notification';

export default class TeamEventsHandler { 
  async onTeamInvited(event: { profile: any; invitationData: any; additionalData: any }) {
    const { profile, invitationData, additionalData } = event;

    // Create a notification for the team invitation
    await Notification.insertNotification(
      profile._id as any,
      null as any,
      'Team Invited',
      `You have been invited to join the team: ${profile.name}`,
      'team.invited',
      profile._id as any
    );

    // Send invitation email
    await EmailService.sendEmail({
      to: invitationData.email,
      subject: 'You Have Been Invited to Join a Team',
      templateId: 'd-1234567890abcdef1234567890abcdef',
      data: {
        currentYear: new Date().getFullYear(),
        subject: 'You Have Been Invited to Join a Team',
        teamName: profile.name,
        ...additionalData
      },
    });
  }
}
