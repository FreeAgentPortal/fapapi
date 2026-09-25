import Notification from '../model/Notification';
import type { ProfileViewRecordedEvent } from '../../profiles/analytics/types';
import logger from '../../../utils/logger';

export default class ProfileViewEventsHandler {
  public profileViewRecorded = async (event: ProfileViewRecordedEvent): Promise<void> => {
    try {
      await Notification.insertNotification(
        event.subjectOwnerUserId as any,
        undefined as any,
        'Your profile is getting noticed.',
        'Someone viewed your profile.',
        'profile.view.recorded',
        event.viewId as any
      );
    } catch (err) {
      logger.error({ err, viewId: event.viewId }, '[ProfileViewEventsHandler] Failed to create profile view notification.');
    }
  };
}
