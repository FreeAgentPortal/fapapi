import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { ModelMap } from '../../../utils/ModelMap';

export class ScoutActionsHandler {
  private modelMap: Record<string, any>;

  constructor() {
    this.modelMap = ModelMap;
  }

  /**
   * action comes from admin panel for submission of scout report, this handler
   * processes the action and updates the scout report, as well as updating the athlete's diamond rating
   */
  async handleScoutReportSubmission(data: { action: 'approve' | 'deny'; message?: string }, reportid: string): Promise<{ success: boolean; message: string; data?: any }> {
    console.info('[Scout] Handling Scout Report Submission:', reportid);

    // attempt to locate the report by Id
    const report = await this.modelMap['scout_report'].findById(reportid);
    if (!report) {
      throw new ErrorUtil('Scout report not found', 404);
    }

    // Check if report is already processed
    if (report.isFinalized) {
      throw new ErrorUtil('Scout report has already been processed', 400);
    }

    // Calculate diamond rating from rating breakdown
    const calculatedDiamondRating = this.calculateDiamondRatingFromBreakdown(report.ratingBreakdown);

    // Validate that we have enough data to calculate a meaningful rating
    if (calculatedDiamondRating === null) {
      throw new ErrorUtil('Insufficient rating breakdown data to calculate diamond rating', 400);
    }

    // find the athlete associated with the report
    const athlete = await this.modelMap['athlete'].findById(report.athleteId);
    if (!athlete) {
      throw new ErrorUtil('Athlete not found', 404);
    }

    // If action is deny, we simply mark the report as denied
    if (data.action === 'deny') {
      report.isFinalized = true;
      report.status = 'denied';
      report.denialMessage = data.message || 'Report denied by admin';
      await report.save();
      console.info(`[Scout] Report ${reportid} denied successfully.`);
      return {
        success: true,
        message: 'Scout report denied successfully',
        data: {
          isApproved: false,
          reportId: report._id,
          athleteId: athlete._id,
        },
      };
    }
    try {
      // Get count of already processed reports for this athlete (excluding current report)
      const processedReportsCount = await this.modelMap['scout_report'].countDocuments({
        athleteId: athlete._id,
        isFinalized: true,
        _id: { $ne: report._id }, // Exclude current report
      });

      // Calculate new diamond rating average
      const newDiamondRating = this.calculateNewDiamondRating(
        athlete.diamondRating || 0, // Current rating (0 if none)
        processedReportsCount, // Number of processed reports
        calculatedDiamondRating // Calculated rating from breakdown
      );

      // Update the report - set calculated diamond rating and finalize
      report.diamondRating = calculatedDiamondRating;
      report.isFinalized = true;
      report.status = 'approved';
      await report.save();

      // Update athlete's diamond rating
      athlete.diamondRating = newDiamondRating;
      await athlete.save();

      console.info(`[Scout] Report ${reportid} processed successfully.`);
      console.info(`[Scout] Calculated diamond rating: ${calculatedDiamondRating}`);
      console.info(`[Scout] Athlete ${athlete._id} diamond rating updated from ${athlete.diamondRating} to ${newDiamondRating}`);

      return {
        success: true,
        message: 'Scout report processed successfully',
        data: {
          isApproved: true,
          reportId: report._id,
          scoutId: report.scoutId,
          athleteId: athlete._id,
          newDiamondRating,
          ratingBreakdownDetails: this.getRatingCalculationDetails(report.ratingBreakdown),
        },
      }
    } catch (error) {
      console.error('[Scout] Error processing scout report:', error);
      throw new ErrorUtil('Failed to process scout report', 500);
    }
  }

  /**
   * Calculate diamond rating from rating breakdown scores
   * @param ratingBreakdown - The rating breakdown object from scout report
   * @returns Calculated diamond rating (1-5) or null if insufficient data
   */
  private calculateDiamondRatingFromBreakdown(ratingBreakdown: any): number | null {
    if (!ratingBreakdown) {
      return null;
    }

    const validScores: number[] = [];
    const scoreBreakdown: { [key: string]: number } = {};
    const categoriesProcessed: string[] = []; 
    // Dynamically process all properties in the ratingBreakdown object
    for (const [category, categoryData] of ratingBreakdown.entries()) {
      // const categoryData = ratingBreakdown[category];
      // Check if this category has valid score data
      if (categoryData && typeof categoryData === 'object' && typeof categoryData.score === 'number' && categoryData.score >= 1 && categoryData.score <= 5) {
        console.info(`[Scout] Processing category: ${category} with score: ${categoryData.score}`);
        validScores.push(categoryData.score);
        scoreBreakdown[category] = categoryData.score;
        categoriesProcessed.push(category);
        console.info(`[Scout] Valid score found for category "${category}": ${categoryData.score}`);
      }
    }

    // Require at least 3 categories to be rated for a meaningful evaluation
    if (validScores.length < 3) {
      console.warn(`[Scout] Insufficient rating data: Only ${validScores.length} categories rated (minimum 3 required)`);
      console.warn(`[Scout] Categories processed: [${categoriesProcessed.join(', ')}]`);
      console.warn(`[Scout] Valid scores found:`, scoreBreakdown);
      return null;
    }

    // Calculate average of valid scores
    const average = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;

    // Round to 2 decimal places and ensure it stays within 1-5 range
    const roundedAverage = Math.round(average * 100) / 100;
    const finalRating = Math.max(1, Math.min(5, roundedAverage));

    console.info(`[Scout] Rating calculation breakdown:`, scoreBreakdown);
    console.info(`[Scout] Categories evaluated: [${categoriesProcessed.join(', ')}]`);
    console.info(`[Scout] Average of ${validScores.length} categories: ${average} → Final rating: ${finalRating}`);

    return finalRating;
  }

  /**
   * Get a detailed breakdown of which categories contributed to the rating calculation
   * @param ratingBreakdown - The rating breakdown object from scout report
   * @returns Object with calculation details
   */
  private getRatingCalculationDetails(ratingBreakdown: any): {
    categoriesRated: string[];
    scores: { [key: string]: number };
    averageScore: number;
    totalCategories: number;
    ratedCategories: number;
  } {
    const validScores: number[] = [];
    const scoreBreakdown: { [key: string]: number } = {};
    const categoriesRated: string[] = [];
    const allCategories = Object.keys(ratingBreakdown || {});

    // Dynamically process all properties in the ratingBreakdown object
    allCategories.forEach((category) => {
      const categoryData = ratingBreakdown?.[category];
      if (categoryData && typeof categoryData === 'object' && typeof categoryData.score === 'number' && categoryData.score >= 1 && categoryData.score <= 5) {
        validScores.push(categoryData.score);
        scoreBreakdown[category] = categoryData.score;
        categoriesRated.push(category);
      }
    });

    const averageScore = validScores.length > 0 ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length : 0;

    return {
      categoriesRated,
      scores: scoreBreakdown,
      averageScore: Math.round(averageScore * 100) / 100,
      totalCategories: allCategories.length,
      ratedCategories: validScores.length,
    };
  }

  /**
   * Calculate new diamond rating average when adding a new processed report
   * @param currentRating - Athlete's current diamond rating (average of processed reports)
   * @param processedCount - Number of already processed reports
   * @param newReportRating - Rating from the new report being processed
   * @returns New calculated average rating rounded to 2 decimal places
   */
  private calculateNewDiamondRating(currentRating: number, processedCount: number, newReportRating: number): number {
    // If no processed reports exist, the new rating becomes the athlete's rating
    if (processedCount === 0) {
      return Math.round(newReportRating * 100) / 100;
    }

    // Calculate the sum of all previous ratings
    const previousRatingsSum = currentRating * processedCount;

    // Add the new rating and calculate new average
    const newTotalSum = previousRatingsSum + newReportRating;
    const newTotalCount = processedCount + 1;
    const newAverage = newTotalSum / newTotalCount;

    // Round to 2 decimal places and ensure it stays within 1-5 range
    const roundedAverage = Math.round(newAverage * 100) / 100;
    return Math.max(1, Math.min(5, roundedAverage));
  }
}
