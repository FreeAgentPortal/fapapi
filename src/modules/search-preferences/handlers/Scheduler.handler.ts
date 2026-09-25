import { ISearchPreferences } from '../models/SearchPreferences';
import { eventBus } from '../../../lib/eventBus';
import { AthleteModel, IAthlete } from '../../profiles/athlete/models/AthleteModel';
import SearchReport, { ISearchReport } from '../models/SearchReport';

type PerformanceMetricRange = { min?: number; max?: number };

interface AthleteSearchResult {
  athlete: IAthlete;
  matchScore: number;
}

export class SchedulerHandler {
  /**
   * Generate a report for a specific search preference
   * @param searchPreference - The search preference to generate a report for
   * @returns Promise<ReportData> - The generated report data
   */
  public static async generateReport(searchPreference: ISearchPreferences): Promise<ISearchReport> {
    try {
      // console.info(`[Scheduler] Generating report for search preference: ${searchPreference.name} (ID: ${searchPreference._id})`);

      // Mock report data for now - replace with actual search logic
      const searchResults = await this.performSearch(searchPreference);
      if (!searchResults || searchResults.length === 0) {
        // console.warn(`[Scheduler] No athletes found for search preference: ${searchPreference.name}`);
      }
      const reportData = {
        searchPreference: searchPreference._id as any,
        results: searchResults.map(({ athlete }) => athlete._id),
        scoredResults: searchResults.map(({ athlete, matchScore }) => ({
          athlete: athlete._id,
          matchScore,
        })),
        generatedAt: new Date(),
        reportId: `report_${searchPreference._id}_${searchPreference.name.replace(/\s+/g, '_')}_${Date.now()}`,
        ownerId: searchPreference.ownerId,
        ownerType: searchPreference.ownerType,
      } as ISearchReport;

      // We want to upsert the report to avoid duplicates if a report already exists for this search
      let report: any;
      report = await SearchReport.findOneAndUpdate(
        { searchPreference: searchPreference._id, ownerId: searchPreference.ownerId },
        { $set: reportData },
        { upsert: true, new: true }
      );

      reportData._id = report._id;

      // Emit event to notify user of new report
      await this.notifyUserOfNewReport(searchPreference, report!);

      // console.info(`[Scheduler] Report generated successfully for preference: ${searchPreference.name}`);
      return reportData;
    } catch (error: Error | any) {
      console.error(`[Scheduler] Error generating report for preference ${searchPreference._id}:`, error);
      throw error;
    }
  }

  /**
   * Perform the actual search based on search preferences
   */
  private static async performSearch(searchPreference: ISearchPreferences): Promise<AthleteSearchResult[]> {
    // console.info(`[Scheduler] Performing search with preferences:`, {
    //   positions: searchPreference.positions,
    //   ageRange: searchPreference.ageRange,
    //   performanceMetrics: searchPreference.performanceMetrics,
    //   numberOfResults: searchPreference.numberOfResults,
    // });

    // Build the match conditions
    const matchConditions: any[] = [];
    let performanceMetricCriteria: [string, PerformanceMetricRange][] = [];

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
      if (performanceMetrics instanceof Map) {
        performanceMetricCriteria = Array.from(performanceMetrics.entries());
      } else if (typeof performanceMetrics === 'object' && performanceMetrics !== null) {
        performanceMetricCriteria = Object.entries(performanceMetrics);
      }

      performanceMetricCriteria = performanceMetricCriteria.filter(
        ([, metricRange]) => metricRange && typeof metricRange === 'object' && (metricRange.min !== undefined || metricRange.max !== undefined)
      );

      for (const [metricName, metricRange] of performanceMetricCriteria) {
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

      // Add all performance metric conditions
      if (performanceConditions.length > 0) {
        // needs to be wrapped in an $or to allow any of the metrics to match
        matchConditions.push({ $or: performanceConditions });
      }
    }

    // Build the aggregation pipeline
    const pipeline: any[] = [];

    // Only include active athletes, along with any requested search filters.
    pipeline.push({
      $match: {
        isActive: true,
        ...(matchConditions.length > 0 && { $and: matchConditions }),
      },
    });

    // Ranked athletes appear first from highest to lowest rating. Creation date
    // and ID provide deterministic ordering for athletes with the same rating.
    pipeline.push({ $sort: { diamondRating: -1, createdAt: -1, _id: 1 } });

    // Limit only after ranking so the report contains the highest-rated matches.
    if (searchPreference.numberOfResults && searchPreference.numberOfResults > 0) {
      pipeline.push({ $limit: searchPreference.numberOfResults });
    }

    try {
      const results = await AthleteModel.aggregate(pipeline);
      return results.map((athlete) => ({
        athlete,
        matchScore: this.calculateMatchScore(athlete, performanceMetricCriteria),
      }));
    } catch (error) {
      console.error(`[Scheduler] Error executing search query:`, error);
      throw new Error(`Failed to perform athlete search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate the percentage of requested performance metrics an athlete matches.
   * Position and age are hard filters and are not included in this score.
   */
  private static calculateMatchScore(athlete: IAthlete, criteria: [string, PerformanceMetricRange][]): number {
    if (criteria.length === 0) {
      return 100;
    }

    const matchedCriteria = criteria.reduce((total, [metricName, range]) => {
      const metricValue = athlete.metrics instanceof Map ? athlete.metrics.get(metricName) : (athlete.metrics as any)?.[metricName];

      if (typeof metricValue !== 'number') {
        return total;
      }

      const meetsMinimum = range.min === undefined || metricValue >= range.min;
      const meetsMaximum = range.max === undefined || metricValue <= range.max;

      return meetsMinimum && meetsMaximum ? total + 1 : total;
    }, 0);

    return Math.round((matchedCriteria / criteria.length) * 100);
  }

  /**
   * Notify the user that a new report is available
   */
  private static async notifyUserOfNewReport(searchPreference: ISearchPreferences, reportData: ISearchReport): Promise<void> {
    try {
      // Emit event through event bus for notification system
      eventBus.publish('search.report.generated', {
        _id: reportData._id,
        userId: searchPreference.ownerId,
        ownerType: searchPreference.ownerType,
        searchPreferenceName: searchPreference.name,
        reportId: reportData.reportId,
        resultCount: reportData.results.length,
        generatedAt: reportData.generatedAt,
      });
    } catch (error) {
      console.error(`[Scheduler] Error sending notification for report ${reportData.reportId}:`, error);
      // Don't throw here - report generation should succeed even if notification fails
    }
  }
}
