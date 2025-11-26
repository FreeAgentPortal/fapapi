import { IAthlete } from '../athlete/models/AthleteModel';
import { eventBus } from '../../../lib/eventBus';
import Notification from '../../notification/model/Notification';
import { ResumeProfile } from '../resume/models/ResumeProfile';

export interface ProfileCompletionStatus {
  isComplete: boolean;
  missingFields: string[];
  completionPercentage: number;
  criticalFieldsMissing: string[];
}

export class AthleteProfileCompletionHandler {
  /**
   * Send completion alert to an athlete who has an incomplete profile
   * @param athlete - The athlete profile to send alert for
   */
  public static async sendCompletionAlert(athlete: IAthlete): Promise<void> {
    try {
      console.info(`[AthleteProfileCompletion] Sending completion alert for athlete: ${athlete.fullName} (ID: ${athlete._id})`);

      // Check profile completion status
      const completionStatus = await AthleteProfileCompletionHandler.checkProfileCompletion(athlete);

      if (completionStatus.isComplete) {
        console.info(`[AthleteProfileCompletion] Profile is complete for athlete: ${athlete.fullName}, skipping alert`);
        return;
      }

      // Create notification for the athlete
      await AthleteProfileCompletionHandler.createCompletionNotification(athlete, completionStatus);

      // Emit event for potential email notification
      await AthleteProfileCompletionHandler.emitCompletionAlertEvent(athlete, completionStatus);

      console.info(`[AthleteProfileCompletion] Completion alert sent successfully for athlete: ${athlete.fullName}`);
    } catch (error) {
      console.error(`[AthleteProfileCompletion] Error sending completion alert for athlete ${athlete._id}:`, error);
      throw error;
    }
  }

  /**
   * Check the completion status of an athlete profile
   * @param athlete - The athlete profile to check
   * @returns ProfileCompletionStatus
   */
  public static async checkProfileCompletion(athlete: IAthlete): Promise<ProfileCompletionStatus> {
    const missingFields: string[] = [];
    const criticalFieldsMissing: string[] = [];

    // Check for profile image
    if (!athlete.profileImageUrl || athlete.profileImageUrl.trim() === '') {
      missingFields.push('Profile Image');
      criticalFieldsMissing.push('profileImageUrl');
    }

    // Check for metrics
    if (!athlete.metrics || (athlete.metrics instanceof Map && athlete.metrics.size === 0) || (typeof athlete.metrics === 'object' && Object.keys(athlete.metrics).length === 0)) {
      missingFields.push('Performance Metrics');
      criticalFieldsMissing.push('metrics');
    }

    // Check for measurements
    if (
      !athlete.measurements ||
      (athlete.measurements instanceof Map && athlete.measurements.size === 0) ||
      (typeof athlete.measurements === 'object' && Object.keys(athlete.measurements).length === 0)
    ) {
      missingFields.push('Physical Measurements');
      criticalFieldsMissing.push('measurements');
    }

    // Check for resume (check if athlete has a resume profile)
    try {
      const resume = await ResumeProfile.findOne({
        'owner.kind': 'AthleteProfile',
        'owner.ref': athlete._id,
      });

      if (!resume || resume.experiences.length === 0) {
        missingFields.push('Resume/Experience');
        criticalFieldsMissing.push('resume');
      }
    } catch (error) {
      console.warn(`[AthleteProfileCompletion] Could not check resume for athlete ${athlete._id}:`, error);
      // Don't fail the whole process if resume check fails
      missingFields.push('Resume/Experience');
      criticalFieldsMissing.push('resume');
    }

    // Calculate completion percentage
    const totalFields = 4; // profileImageUrl, metrics, measurements, resume
    const completedFields = totalFields - criticalFieldsMissing.length;
    const completionPercentage = Math.round((completedFields / totalFields) * 100);

    return {
      isComplete: missingFields.length === 0,
      missingFields,
      completionPercentage,
      criticalFieldsMissing,
    };
  }

  /**
   * Create an in-app notification for profile completion
   * @param athlete - The athlete profile
   * @param completionStatus - The completion status
   */
  private static async createCompletionNotification(athlete: IAthlete, completionStatus: ProfileCompletionStatus): Promise<void> {
    try {
      const missingFieldsText = completionStatus.missingFields.join(', ');
      const message = `Your profile is ${completionStatus.completionPercentage}% complete. Please add: ${missingFieldsText} to improve your visibility to scouts and teams.`;

      await Notification.insertNotification(athlete.userId as any, undefined as any, 'Complete Your Profile', message, 'profile.completion', athlete._id as any);

      console.info(`[AthleteProfileCompletion] Notification created for athlete: ${athlete.fullName}`);
    } catch (error) {
      console.error(`[AthleteProfileCompletion] Error creating notification for athlete ${athlete._id}:`, error);
      // Don't throw here - we don't want to break the whole process
    }
  }

  /**
   * Emit event for profile completion alert (for potential email notifications)
   * @param athlete - The athlete profile
   * @param completionStatus - The completion status
   */
  private static async emitCompletionAlertEvent(athlete: IAthlete, completionStatus: ProfileCompletionStatus): Promise<void> {
    try {
      // Populate userId to get user details including notification settings
      const user = (athlete as any).userId;

      eventBus.publish('athlete.profile.completion.alert', {
        athleteId: athlete._id,
        userId: athlete.userId,
        athleteName: athlete.fullName,
        email: user?.email || athlete.email,
        phoneNumber: user?.phoneNumber,
        completionPercentage: completionStatus.completionPercentage,
        missingFields: completionStatus.missingFields,
        criticalFieldsMissing: completionStatus.criticalFieldsMissing,
        profileId: athlete._id,
        fullName: athlete.fullName,
        // Pass notification settings to avoid additional lookups
        notificationSettings: {
          accountNotificationSMS: user?.notificationSettings?.accountNotificationSMS ?? false,
          accountNotificationEmail: user?.notificationSettings?.accountNotificationEmail ?? true,
        },
      });

      console.info(`[AthleteProfileCompletion] Event emitted for athlete: ${athlete.fullName}`);
    } catch (error) {
      console.error(`[AthleteProfileCompletion] Error emitting event for athlete ${athlete._id}:`, error);
      // Don't throw here - notification creation should succeed even if event emission fails
    }
  }

  /**
   * Get detailed profile completion report for an athlete
   * @param athlete - The athlete profile to analyze
   * @returns Detailed completion report
   */
  public static async getDetailedCompletionReport(athlete: IAthlete): Promise<{
    athlete: {
      id: string;
      name: string;
      email?: string;
    };
    completion: ProfileCompletionStatus;
    recommendations: string[];
    priority: 'high' | 'medium' | 'low';
  }> {
    const completionStatus = await AthleteProfileCompletionHandler.checkProfileCompletion(athlete);

    // Generate recommendations based on missing fields
    const recommendations: string[] = [];

    if (completionStatus.criticalFieldsMissing.includes('profileImageUrl')) {
      recommendations.push('Upload a professional profile photo to make a great first impression');
    }

    if (completionStatus.criticalFieldsMissing.includes('metrics')) {
      recommendations.push('Add performance metrics (40-yard dash, bench press, etc.) to showcase your athletic abilities');
    }

    if (completionStatus.criticalFieldsMissing.includes('measurements')) {
      recommendations.push('Include physical measurements (height, weight) for better position matching');
    }

    if (completionStatus.criticalFieldsMissing.includes('resume')) {
      recommendations.push('Create a sports resume with your experience, achievements, and education');
    }

    // Determine priority based on completion percentage
    let priority: 'high' | 'medium' | 'low' = 'low';
    if (completionStatus.completionPercentage < 25) {
      priority = 'high';
    } else if (completionStatus.completionPercentage < 75) {
      priority = 'medium';
    }

    return {
      athlete: {
        id: athlete._id.toString(),
        name: athlete.fullName,
        email: (athlete as any).userId?.email || athlete.email,
      },
      completion: completionStatus,
      recommendations,
      priority,
    };
  }

  /**
   * Check if an athlete should receive completion alerts
   * (to avoid spamming users who recently received alerts)
   * @param athlete - The athlete profile
   * @returns boolean indicating if alert should be sent
   */
  public static async shouldSendAlert(athlete: IAthlete): Promise<boolean> {
    try {
      // Check if we've sent a completion alert in the last 7 days
      const recentAlert = await Notification.findOne({
        userTo: athlete.userId,
        notificationType: 'profile.completion',
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      });

      return !recentAlert;
    } catch (error) {
      console.warn(`[AthleteProfileCompletion] Error checking recent alerts for athlete ${athlete._id}:`, error);
      // If we can't check, err on the side of sending the alert
      return true;
    }
  }
}
