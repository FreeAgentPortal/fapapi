import ScoutReport from '../models/ScoutReport';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { ScoutModel } from '../../profiles/scout/model/ScoutProfile';
import User from '../../auth/model/User';
import { ScoutAudit } from '../models/Portfolio';
import { PortfolioAccessService } from './PortfolioAccess.service';
import { fail, id, paged, text } from '../utils/portfolioInput';
import { aggregateRating, ratingFromBreakdown } from '../utils/rating';
import { reportInput, validateReportQuery } from '../utils/reportInput';
import { publishScoutEvent, transaction } from '../utils/transaction';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';

export class ScoutReportWorkflowService {
  readonly access = new PortfolioAccessService();

  async visibility(userId: string): Promise<any> {
    if (await this.access.isAdmin(userId)) return {};
    const [athlete, scout] = await Promise.all([
      AthleteModel.findOne({ userId }).select('_id'), ScoutModel.findOne({ user: userId, 
        // isActive: true 
      }),
    ]);
    const clauses: any[] = [];
    if (athlete) clauses.push({ athleteId: athlete._id, status: 'approved', isFinalized: true });
    if (scout?.permissions?.includes('scout.reports.view')) clauses.push({ scoutId: scout._id }, { isPublic: true, status: 'approved', isFinalized: true });
    return clauses.length ? { $or: clauses } : { _id: { $exists: false } };
  }

  async list(userId: string, query: any, page: number, limit: number) {
    validateReportQuery(query);
    const visibility = await this.visibility(userId);
    const filters = AdvFilters.filter(query.filterOptions as string);
    const keyword = (query.keyword ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const search = AdvFilters.query(['tags', 'status', 'scout.name', 'athlete.name'], keyword);
    const include = AdvFilters.filter(query.includeOptions as string);
    const alternatives = [...search, ...include].filter(entry => entry && Object.keys(entry).length);
    const filter = { $and: [visibility, ...filters, ...(alternatives.length ? [{ $or: alternatives }] : [])] };
    const [entries, count] = await Promise.all([
      ScoutReport.find(filter).sort(AdvFilters.sort(query.sortOptions || '-createdAt')).skip((page - 1) * limit).limit(limit).lean(),
      ScoutReport.countDocuments(filter),
    ]);
    // Preserve the existing list cards while keeping permission filters on the reports themselves.
    const [athletes, scouts] = await Promise.all([
      AthleteModel.find({ _id: { $in: entries.map(entry => entry.athleteId) } }).select('fullName profileImageUrl diamondRating').lean(),
      ScoutModel.find({ _id: { $in: entries.map(entry => entry.scoutId) } }).select('user permissions')
        .populate({ path: 'user', select: 'fullName email profileImageUrl', model: User }).lean(),
    ]);
    const athleteMap = new Map(athletes.map(athlete => [String(athlete._id), athlete]));
    const scoutMap = new Map(scouts.map(scout => [String(scout._id), scout]));
    return paged(entries.map(entry => ({ ...entry,
      athlete: { ...entry.athlete, ...athleteMap.get(String(entry.athleteId)) },
      scout: { ...entry.scout, ...scoutMap.get(String(entry.scoutId)) },
    })), count, page, limit);
  }

  async get(userId: string, reportId: string) {
    const report = await ScoutReport.findOne({ $and: [{ _id: id(reportId) }, await this.visibility(userId)] }).lean();
    if (!report) fail('Report not found', 404);
    return report;
  }

  async create(userId: string, data: any) {
    const scout = await this.access.scout(userId, 'scout.reports.create');
    if (data.submissionId || data.reviewId || data.submissionVersion) fail('Use the review report endpoint for portfolio evaluations');
    const athlete = await AthleteModel.findById(id(data.athleteId));
    if (!athlete) fail('Athlete not found', 404);
    // TEMPORARY: disabled for self-review testing; restore after testing.
    // if (String(athlete.userId) === userId) fail('Scouts cannot rate themselves', 403);
    const input = reportInput(data);
    if (!input.sport || !input.league || !input.reportType) fail('Sport, league and report type are required');
    if (input.isDraft === false) ratingFromBreakdown(input.ratingBreakdown);
    const user = await User.findById(userId).select('fullName').lean();
    return ScoutReport.create({ ...input, athleteId: athlete._id, scoutId: scout._id,
      athlete: { name: athlete.fullName }, scout: { name: scout.displayName || user?.fullName || 'Scout' } });
  }

  async update(userId: string, reportId: string, data: any) {
    const scout = await this.access.scout(userId, 'scout.reports.update');
    const input = reportInput(data);
    return transaction(async session => {
      const report = await ScoutReport.findOne({ _id: id(reportId), scoutId: scout._id }).session(session);
      if (!report) fail('Report not found', 404);
      if (report.isFinalized || report.reviewId || report.isDraft === false) fail('Only an unsubmitted standalone draft can be edited', 409);
      report.set(input);
      if (!report.isDraft) ratingFromBreakdown(report.ratingBreakdown);
      return report.save({ session });
    });
  }

  async remove(userId: string, reportId: string) {
    const scout = await this.access.scout(userId, 'scout.reports.delete');
    const result = await ScoutReport.deleteOne({ _id: id(reportId), scoutId: scout._id,
      isFinalized: false, isDraft: true, reviewId: { $exists: false } });
    if (!result.deletedCount) fail('Only an owned standalone draft can be deleted', 409);
    return { deleted: true };
  }

  async decide(userId: string, reportId: string, data: any) {
    await this.access.admin(userId);
    if (!['approve', 'deny'].includes(data.action)) fail('Action must be approve or deny');
    const message = text(data.message ?? '', 'decision message');
    const result = await transaction(async session => {
      const report = await ScoutReport.findById(id(reportId)).session(session);
      if (!report) fail('Report not found', 404);
      if (report.isFinalized) {
        if (report.status !== (data.action === 'approve' ? 'approved' : 'denied')) fail('Report was already processed', 409);
        return { report, changed: false };
      }
      if (report.isDraft) fail('Draft reports cannot be processed', 409);
      // Write the athlete before reading report contributions to serialize concurrent decisions.
      const athlete = await AthleteModel.findOneAndUpdate({ _id: report.athleteId }, { $inc: { __v: 1 } }, { new: true, session });
      if (!athlete) fail('Athlete not found', 404);
      report.status = data.action === 'approve' ? 'approved' : 'denied';
      if (data.action === 'approve') report.diamondRating = ratingFromBreakdown(report.ratingBreakdown);
      report.isFinalized = true;
      report.decidedAt = new Date();
      report.set('decidedBy', userId);
      report.message = message;
      await report.save({ session });
      const approved = await ScoutReport.find({ athleteId: athlete._id, status: 'approved', isFinalized: true }).session(session).lean();
      athlete.diamondRating = aggregateRating(approved);
      await athlete.save({ session });
      await ScoutAudit.create([{ athleteId: athlete._id, actorUserId: userId, entityId: report._id, action: `report.${report.status}` }], { session });
      return { report, changed: true, newDiamondRating: athlete.diamondRating };
    });
    if (result.changed) publishScoutEvent('scout.report.decided', {
      reportId: result.report._id, athleteId: result.report.athleteId,
      scoutId: result.report.scoutId, isApproved: result.report.status === 'approved',
    });
    return result;
  }
}
