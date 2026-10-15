import { Portfolio, Submission, SubmittedItem, Review, ItemFeedback, ScoutAudit } from '../models/Portfolio';
import ScoutReport from '../models/ScoutReport';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import User from '../../auth/model/User';
import { PortfolioService } from './Portfolio.service';
import { fail, id, paged, revision, text } from '../utils/portfolioInput';
import { reportInput } from '../utils/reportInput';
import { ratingFromBreakdown } from '../utils/rating';
import { publishScoutEvent, transaction } from '../utils/transaction';
import { scoutingQueuePipeline } from '../utils/scoutingQueue';

export class PortfolioReviewService {
  readonly portfolios = new PortfolioService();
  readonly access = this.portfolios.access;

  async queue(userId: string, page: number, limit: number) {
    if (!Number.isSafeInteger(page * limit)) fail('Invalid pagination');
    const scout = await this.access.scout(userId, 'scout.reports.create');
    const ownAthlete = await AthleteModel.findOne({ userId }).select('_id');
    console.log(ownAthlete);
    const [result] = await Portfolio.aggregate([
      ...(ownAthlete ? [{ $match: { athleteId: { $ne: ownAthlete._id } } }] : []),
      ...scoutingQueuePipeline(scout._id),
      { $facet: { entries: [{ $skip: (page - 1) * limit }, { $limit: limit }], metadata: [{ $count: 'count' }] } },
    ]);
    console.log(result);
    return paged(result?.entries ?? [], result?.metadata?.[0]?.count ?? 0, page, limit);
  }

  async start(userId: string, submissionId: string) {
    const scout = await this.access.scout(userId, 'scout.reports.create');
    return transaction(async (session) => {
      const submission = await Submission.findById(id(submissionId)).session(session);
      if (!submission) fail('Submission not found', 404);
      const portfolio = await this.portfolios.lock(submission.athleteId, session);
      const existing = await Review.findOne({ submissionId, scoutId: scout._id }).session(session);
      if (existing) return existing;
      if (portfolio.withdrawn || String(portfolio.latestSubmission) !== submissionId) fail('Submission is no longer available for new reviews', 409);
      await this.access.requireEntitled(submission.athleteId, session);
      // TEMPORARY: disabled for self-review testing; restore after testing.
      // if (await AthleteModel.exists({ _id: submission.athleteId, userId }).session(session)) fail('Scouts cannot evaluate themselves', 403);
      const [review] = await Review.create([{ submissionId, athleteId: submission.athleteId, scoutId: scout._id }], { session });
      return review;
    });
  }

  async mine(userId: string, state: string, page: number, limit: number) {
    const scout = await this.access.scout(userId);
    if (!['in_progress', 'completed'].includes(state)) fail('State must be in_progress or completed');
    const filter = { scoutId: scout._id, status: state === 'completed' ? { $in: ['submitted', 'declined', 'cancelled'] } : 'in_progress' };
    const [entries, count] = await Promise.all([
      Review.find(filter)
        .sort({ updatedAt: -1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);
    return paged(entries, count, page, limit);
  }

  async visibleReview(userId: string, reviewId: string) {
    const review = await Review.findById(id(reviewId)).lean();
    if (!review) fail('Review not found', 404);
    if (await this.access.isAdmin(userId)) return review;
    const athlete = await AthleteModel.exists({ _id: review.athleteId, userId });
    if (athlete && ['submitted', 'declined'].includes(review.status)) return review;
    const scout = await this.access.scout(userId);
    if (String(review.scoutId) !== String(scout._id)) fail('Review not found', 404);
    return review;
  }

  async detail(userId: string, reviewId: string, page: number, limit: number) {
    const review = await this.visibleReview(userId, reviewId);
    const [items, count] = await Promise.all([
      ItemFeedback.find({ reviewId })
        .sort({ _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ItemFeedback.countDocuments({ reviewId }),
    ]);
    // The athlete learns that a report was submitted, but reads its content only after approval.
    return { review, itemFeedback: paged(items, count, page, limit) };
  }

  async feedback(userId: string, submissionId: string, page: number, limit: number) {
    const submission = await this.access.submission(userId, submissionId);
    const owner = await AthleteModel.exists({ _id: submission.athleteId, userId });
    if (!owner && !(await this.access.isAdmin(userId))) fail('Only the athlete or an administrator may list feedback', 403);
    const filter = { submissionId, status: { $in: ['submitted', 'declined'] } };
    const [entries, count] = await Promise.all([
      Review.find(filter)
        .sort({ completedAt: -1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);
    return paged(entries, count, page, limit);
  }

  async readItemFeedback(userId: string, reviewId: string, itemId: string) {
    const review = await this.visibleReview(userId, reviewId);
    if (!(await SubmittedItem.exists({ submissionId: review.submissionId, itemId: id(itemId) }))) fail('Item not found in this submission', 404);
    return ItemFeedback.findOne({ reviewId: review._id, itemId }).lean();
  }

  async mutate(userId: string, reviewId: string, data: any, action: 'save' | 'item' | 'decline' | 'report', itemId?: string) {
    const scout = await this.access.scout(userId, 'scout.reports.create');
    const result = await transaction(async (session) => {
      const review = await Review.findOne({ _id: id(reviewId), scoutId: scout._id }).session(session);
      if (!review) fail('Review not found', 404);
      const portfolio = await this.portfolios.lock(review.athleteId, session);
      if (action === 'report' && review.status === 'submitted') {
        return { review, report: await ScoutReport.findById(review.reportId).session(session), changed: false };
      }
      if (action === 'decline' && review.status === 'declined') return { review, changed: false };
      if (portfolio.withdrawn || review.status !== 'in_progress') fail('Review is no longer editable', 409);
      if (review.revision !== revision(data.revision)) fail('Review changed; reload before retrying', 409);
      if (data.feedback !== undefined) review.feedback = text(data.feedback, 'feedback', 20000);
      if (action === 'item') {
        id(itemId);
        if (!(await SubmittedItem.exists({ submissionId: review.submissionId, itemId }).session(session))) fail('Item does not belong to this submission');
        if (typeof data.unusable !== 'boolean') fail('unusable must be a boolean');
        const reason = text(data.reason ?? '', 'reason', 5000, data.unusable);
        await ItemFeedback.findOneAndUpdate(
          { reviewId, itemId },
          {
            $set: {
              comment: text(data.comment ?? '', 'comment', 10000),
              unusable: data.unusable,
              reason,
            },
          },
          { upsert: true, new: true, session }
        );
      }
      let report;
      if (action === 'decline') {
        review.declineReason = text(data.reason, 'decline reason', 10000, true);
        review.status = 'declined';
      }
      if (action === 'report') {
        const submission = await Submission.findById(review.submissionId).session(session);
        if (!submission) fail('Submission not found', 404);
        const input = reportInput(data.report ?? {});
        ratingFromBreakdown(input.ratingBreakdown);
        const user = await User.findById(userId).select('fullName').session(session).lean();
        [report] = await ScoutReport.create(
          [
            {
              ...input,
              athleteId: review.athleteId,
              scoutId: scout._id,
              submissionId: submission._id,
              submissionVersion: submission.version,
              reviewId: review._id,
              sport: submission.sport,
              league: input.league || submission.athlete.league || 'unspecified',
              reportType: 'evaluation',
              isDraft: false,
              isFinalized: false,
              status: 'pending',
              athlete: { name: submission.athlete.fullName },
              scout: { name: scout.displayName || user?.fullName || 'Scout' },
            },
          ],
          { session }
        );
        review.reportId = report._id;
        review.status = 'submitted';
      }
      review.revision++;
      if (['decline', 'report'].includes(action)) {
        review.completedAt = new Date();
        await ScoutAudit.create([{ athleteId: review.athleteId, actorUserId: userId, entityId: review._id, action: `review.${review.status}` }], { session });
      }
      await review.save({ session });
      return { review, report, changed: true };
    });
    if (result.changed && ['decline', 'report'].includes(action))
      publishScoutEvent('scout.review.completed', {
        athleteId: result.review.athleteId,
        scoutId: result.review.scoutId,
        reviewId: result.review._id,
        status: result.review.status,
      });
    return result;
  }
}
