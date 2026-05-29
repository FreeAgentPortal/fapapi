import { JobPostModel } from '../models/JobPost';

export interface JobExpirationResult {
  success: boolean;
  closed: number;
  error?: string;
}

export default class JobExpirationHandler {
  /**
   * Close all published job posts whose expiresAt date is in the past.
   * Only jobs with status 'published' and an explicit expiresAt are touched.
   */
  public static async closeExpiredJobs(): Promise<JobExpirationResult> {
    const now = new Date();

    const result = await JobPostModel.updateMany(
      {
        status: 'published',
        expiresAt: { $exists: true, $lt: now },
      },
      { $set: { status: 'closed' } }
    );

    return {
      success: true,
      closed: result.modifiedCount,
    };
  }
}
