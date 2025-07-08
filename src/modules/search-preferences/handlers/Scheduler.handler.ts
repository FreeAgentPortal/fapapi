import { ISearchPreferences } from '../models/SearchPreferences';
import { eventBus } from '../../../lib/eventBus';
import { AthleteModel } from '../../athlete/models/AthleteModel';

export interface AthleteSearchResult {
  id: string;
  name: string;
  positions: string[];
  age: number | null;
  birthdate?: Date;
  metrics: Record<string, number>;
  college?: string;
  profileImageUrl?: string;
  diamondRating?: number;
  email?: string;
  experienceYears?: number;
  graduationYear?: number;
}

export interface ReportData {
  searchPreference: ISearchPreferences;
  results: AthleteSearchResult[];
  generatedAt: Date;
  reportId: string;
}

export class SchedulerHandler {
  /**
   * Generate a report for a specific search preference
   * @param searchPreference - The search preference to generate a report for
   * @returns Promise<ReportData> - The generated report data
   */
  public static async generateReport(searchPreference: ISearchPreferences): Promise<ReportData> {
    try {
      console.log(`[Scheduler] Generating report for search preference: ${searchPreference.name} (ID: ${searchPreference._id})`);

      // TODO: Implement actual search/query logic based on search preferences
      // This would typically involve:
      // 1. Query athletes/players based on search criteria
      // 2. Filter by positions, age range, performance metrics
      // 3. Apply any additional filters from the search preference

      // Mock report data for now - replace with actual search logic
      const mockResults = await this.performSearch(searchPreference);

      const reportData: ReportData = {
        searchPreference,
        results: mockResults,
        generatedAt: new Date(),
        reportId: `report_${searchPreference._id}_${Date.now()}`,
      };

      // Emit event to notify user of new report
      await this.notifyUserOfNewReport(searchPreference, reportData);

      console.log(`[Scheduler] Report generated successfully for preference: ${searchPreference.name}`);
      return reportData;
    } catch (error) {
      console.error(`[Scheduler] Error generating report for preference ${searchPreference._id}:`, error);
      throw error;
    }
  }

  /**
   * Perform the actual search based on search preferences
   */
  private static async performSearch(searchPreference: ISearchPreferences): Promise<AthleteSearchResult[]> {
    // console.log(`[Scheduler] Performing search with preferences:`, {
    //   positions: searchPreference.positions,
    //   ageRange: searchPreference.ageRange,
    //   performanceMetrics: searchPreference.performanceMetrics,
    //   numberOfResults: searchPreference.numberOfResults,
    // });

    // Build the match conditions
    const matchConditions: any[] = [];

    // Filter by positions if specified
    if (searchPreference.positions && searchPreference.positions.length > 0) {
      // positions is an array of objects with a name and abbreviation
      // We need to match against the positions array in the athlete schema
      // so we need to ensure that we are matching against the abbreviation
      matchConditions.push({ 'positions.abbreviation': { $in: searchPreference.positions.map((pos) => pos) } });
    }

    // Filter by age range if specified
    if (searchPreference.ageRange) {
      const ageConditions: any = {};

      if (searchPreference.ageRange.min !== undefined) {
        // Calculate birthdate range from age range
        const maxBirthDate = new Date();
        maxBirthDate.setFullYear(maxBirthDate.getFullYear() - searchPreference.ageRange.min);
        ageConditions.$lte = new Date(maxBirthDate);
      }

      if (searchPreference.ageRange.max !== undefined) {
        const minBirthDate = new Date();
        minBirthDate.setFullYear(minBirthDate.getFullYear() - searchPreference.ageRange.max - 1);
        ageConditions.$gte = new Date(minBirthDate);
      }

      if (Object.keys(ageConditions).length > 0) {
        matchConditions.push({ birthdate: ageConditions });
      }
    }

    // Filter by performance metrics if specified
    if (searchPreference.performanceMetrics) {
      const performanceConditions: any[] = [];

      // Handle the performanceMetrics which is defined as a Map in the schema
      // but might come as a plain object from MongoDB
      const performanceMetrics = searchPreference.performanceMetrics;

      // Convert to entries array regardless of whether it's a Map or object
      let metricsEntries: [string, { min?: number; max?: number }][] = [];

      if (performanceMetrics instanceof Map) {
        metricsEntries = Array.from(performanceMetrics.entries());
      } else if (typeof performanceMetrics === 'object' && performanceMetrics !== null) {
        metricsEntries = Object.entries(performanceMetrics);
      }

      for (const [metricName, metricRange] of metricsEntries) {
        if (metricRange && typeof metricRange === 'object' && (metricRange.min !== undefined || metricRange.max !== undefined)) {
          const metricKey = `metrics.${metricName}`;

          // Build conditions for this specific metric
          const metricRangeCondition: any = {};

          if (metricRange.min !== undefined) {
            metricRangeCondition.$gte = metricRange.min;
          }

          if (metricRange.max !== undefined) {
            metricRangeCondition.$lte = metricRange.max;
          }

          // Add condition for this metric
          const metricCondition: any = {};
          metricCondition[metricKey] = metricRangeCondition;
          performanceConditions.push(metricCondition);
        }
      }

      // Add all performance metric conditions
      if (performanceConditions.length > 0) {
        // needs to be wrapped in an $or to allow any of the metrics to match
        matchConditions.push({ $or: performanceConditions });
      }
    }

    console.log(`[Scheduler] Built match conditions`);

    // Build the aggregation pipeline
    const pipeline: any[] = [];

    // Add match stage if we have conditions
    if (matchConditions.length > 0) {
      pipeline.push({
        $match: {
          $and: matchConditions,
        },
      });
    }

    // Add limit if specified
    if (searchPreference.numberOfResults && searchPreference.numberOfResults > 0) {
      pipeline.push({ $limit: searchPreference.numberOfResults });
    }

    // Sort by creation date (newest first) to get consistent results
    pipeline.push({ $sort: { createdAt: -1 } });

    console.log(`[Scheduler] Executing aggregation in pipeline`);

    try {
      const results = await AthleteModel.aggregate(pipeline);

      console.log(`[Scheduler] Found ${results.length} athletes matching search criteria`);

      // Transform results to include calculated age and formatted data
      const transformedResults = results.map((athlete) => {
        let age = null;
        if (athlete.birthdate) {
          const today = new Date();
          const birthDate = new Date(athlete.birthdate);
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }

        return {
          id: athlete._id.toString(),
          name: athlete.fullName,
          positions: athlete.positions || [],
          age,
          birthdate: athlete.birthdate,
          metrics: athlete.metrics || {},
          college: athlete.college,
          profileImageUrl: athlete.profileImageUrl,
          diamondRating: athlete.diamondRating,
          email: athlete.email,
          experienceYears: athlete.experienceYears,
          graduationYear: athlete.graduationYear,
        };
      });

      return transformedResults;
    } catch (error) {
      console.error(`[Scheduler] Error executing search query:`, error);
      throw new Error(`Failed to perform athlete search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Notify the user that a new report is available
   */
  private static async notifyUserOfNewReport(searchPreference: ISearchPreferences, reportData: ReportData): Promise<void> {
    try {
      // Emit event through event bus for notification system
      eventBus.publish('search.report.generated', {
        userId: searchPreference.ownerId,
        ownerType: searchPreference.ownerType,
        searchPreferenceName: searchPreference.name,
        reportId: reportData.reportId,
        resultCount: reportData.results.length,
        generatedAt: reportData.generatedAt,
      });

      console.log(`[Scheduler] Notification sent for new report: ${reportData.reportId}`);
    } catch (error) {
      console.error(`[Scheduler] Error sending notification for report ${reportData.reportId}:`, error);
      // Don't throw here - report generation should succeed even if notification fails
    }
  }
}
