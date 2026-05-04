import { CRUDHandler } from '../../../utils/baseCRUD';
import { ModelKey, ModelMap } from '../../../utils/ModelMap';
import Notification, { NotificationType } from '../model/Notification';

export class NCRUDHandler extends CRUDHandler<NotificationType> {
  private modelMap: Record<ModelKey, any> = ModelMap;
  constructor() {
    super(Notification);
  }

  async updateAll(userId: string): Promise<{ success: boolean }> {
    // update all notifications to read for user
    const user = await this.modelMap['user'].findById(userId).lean();
    const profileRefValues = Object.values(user.profileRefs).filter(Boolean) as string[];

    await Notification.updateMany(
      {
        userTo: {
          $in: [user._id, ...profileRefValues],
        },
        opened: false,
      },
      { $set: { opened: true } }
    );
    return { success: true };
  }
  /**
   * Custom method to alert users with notifications
   */
  async alertUsers(alertData: {
    alertType?: 'all' | 'team' | 'athlete';
    message: string;
    targetUserIds?: string[];
    deliveryMethod: 'broadcast' | 'specific';
    title: string;
  }): Promise<void> {
    try {
      let targetUserIds: string[] = [];

      // 1. Check if specific targetUserIds are provided
      if (alertData.targetUserIds && alertData.targetUserIds.length > 0) {
        console.info(`[NCRUDHandler] Using specific target users: ${alertData.targetUserIds.length} users`);
        targetUserIds = alertData.targetUserIds;
      } else {
        // 2. No specific targets, use alertType to determine broadcast targets
        console.info(`[NCRUDHandler] Broadcasting to alertType: ${alertData.alertType}`);

        switch (alertData.alertType) {
          case 'all':
            const allUserIds = await this.getAthleteUserIds();
            const teamIds = await this.getTeamUserIds();
            targetUserIds = [...allUserIds, ...teamIds];
            console.info('[NCRUDHandler] Broadcasting to all users - implementation needed');
            break;

          case 'team':
            targetUserIds = await this.getTeamUserIds();
            console.info('[NCRUDHandler] Broadcasting to team users - implementation needed');
            break;

          case 'athlete':
            targetUserIds = await this.getAthleteUserIds();
            console.info('[NCRUDHandler] Broadcasting to athlete users - implementation needed');
            break;

          default:
            console.warn(`[NCRUDHandler] Unknown alertType: ${alertData.alertType}`);
            return;
        }
      }

      // 3. Create notifications for all target users
      if (targetUserIds.length === 0) {
        console.warn('[NCRUDHandler] No target users found, skipping notification creation');
        return;
      }

      // Create notifications using the static method to prevent duplicates
      const notificationPromises = targetUserIds.map(async (userId) => {
        return await Notification.insertNotification(
          userId as any, // userTo
          null as any, // userFrom (null indicates system-generated notification)
          alertData.title, // description
          alertData.message, // message
          'system.alert', // notificationType
          undefined // entityId (optional)
        );
      });

      await Promise.all(notificationPromises);
      console.info(`[NCRUDHandler] Successfully created ${targetUserIds.length} notifications`);
    } catch (error) {
      console.error('Error alerting users:', error);
      throw error;
    }
  }

  private async getTeamUserIds(): Promise<string[]> {
    // this one is a bit different since many users can be on a team, we need to instead of finding all teams
    // find all users who have a profileRef['team'] that is not null
    return await this.modelMap['user'].find({ 'profileRef.team': { $ne: null } }).distinct('_id');
  }
  private async getAthleteUserIds(): Promise<string[]> {
    return await this.modelMap['user'].find({ 'profileRef.athlete': { $ne: null } }).distinct('_id');
  }
}
