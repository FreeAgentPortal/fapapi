import User from '../../auth/model/User';
import { AthleteTeamInterestModel } from '../../interests/models/AthleteTeamInterest';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import TeamModel from '../../profiles/team/model/TeamModel';
import logger from '../../../utils/logger';
import { EmailService } from '../email/EmailService';
import { buildAthleteInterestEmail } from '../email/templates/athleteInterestEmail';
import Notification from '../model/Notification';

export interface AthleteInterestExpressedEvent {
  interestId: string;
  athleteProfileId: string;
  teamProfileId: string;
  initiatedByUserId: string;
}

export default class InterestEventsHandler {
  public interestExpressed = async (event: AthleteInterestExpressedEvent): Promise<void> => {
    try {
      const [interest, athlete, team] = await Promise.all([
        AthleteTeamInterestModel.findById(event.interestId).lean(),
        AthleteModel.findById(event.athleteProfileId).lean(),
        TeamModel.findById(event.teamProfileId).lean(),
      ]);

      if (!interest || !athlete || !team) {
        logger.warn({ event }, '[InterestEventsHandler] Interest notification data could not be resolved.');
        return;
      }
      if (team.alertsEnabled === false) return;

      const linkedUserIds = Array.from(
        new Set((team.linkedUsers || []).map((member: any) => member?.user?._id?.toString?.() || member?.user?.toString?.()).filter(Boolean))
      );
      if (!linkedUserIds.length) return;

      const users = await User.find({ _id: { $in: linkedUserIds }, isActive: { $ne: false } }).lean();
      const positions = (athlete.positions || []).map((position) => position.abbreviation || position.name).filter(Boolean);
      const location = athlete.birthPlace
        ? [athlete.birthPlace.city, athlete.birthPlace.state, athlete.birthPlace.country].filter(Boolean).join(', ')
        : undefined;
      const profileUrl = `https://team.thefreeagentportal.com/opportunities_hub/athletes/${athlete._id}`;
      const email = buildAthleteInterestEmail({
        athleteName: athlete.fullName,
        athletePhotoUrl: athlete.profileImageUrl,
        positions,
        college: athlete.college,
        location,
        note: interest.note,
        profileUrl,
        teamName: team.name,
      });

      await Promise.all([
        ...linkedUserIds.map(async (userId) => {
          try {
            await Notification.insertNotification(
              userId as any,
              event.initiatedByUserId as any,
              'New athlete interest',
              `${athlete.fullName} expressed interest in ${team.name}.`,
              'athlete.interest.expressed',
              interest._id as any
            );
          } catch (err) {
            logger.error({ err, interestId: interest._id, userId }, '[InterestEventsHandler] In-app notification failed.');
          }
        }),
        ...users.map(async (user) => {
          if (!user.email || user.notificationSettings?.accountNotificationEmail === false) return;
          try {
            await EmailService.sendEmail({
              to: user.email,
              subject: `${athlete.fullName} expressed interest in ${team.name}`,
              html: email.html,
              text: email.text,
            });
          } catch (err) {
            logger.error({ err, interestId: interest._id, userId: user._id }, '[InterestEventsHandler] Interest email failed.');
          }
        }),
      ]);
    } catch (err) {
      logger.error({ err, event }, '[InterestEventsHandler] Interest notification fan-out failed.');
    }
  };
}
