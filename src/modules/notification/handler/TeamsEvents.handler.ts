import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { EmailService } from '../email/EmailService';
import Notification from '../model/Notification';

export default class TeamEventsHandler {
  async onTeamInvited(event: { profile: any; invitationData: any; additionalData: any }) {
    const { profile, invitationData, additionalData } = event;

    // Send invitation email
    await EmailService.sendEmail({
      to: invitationData.email,
      subject: 'You Have Been Invited to Join a Team',
      templateId: 'd-bd8a348f14db4bf68fa9e5428afd27a3',
      data: {
        inviteeName: invitationData.inviteeName,
        inviterName: 'Damond Talbot',
        inviterMessage: invitationData.inviteMessage,
        teamName: profile.name,
        inviteUrl: `https://auth.thefreeagentportal.com/auth/claim?slug=${profile.slug}&type=team`,
        expiresInHours: 48,
        supportEmail: 'support@freeagentportal.com',
        logoUrl: 'https://res.cloudinary.com/dsltlng97/image/upload/v1752863629/placeholder-logo_s7jg3y.png',
        year: new Date().getFullYear(),
        subject: `You Have Been Invited to Join the ${profile.name} Team`,
      },
    });
  }
}
