import { ClientSession } from 'mongoose';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { ScoutModel } from '../../profiles/scout/model/ScoutProfile';
import Admin from '../../profiles/admin/model/AdminModel';
import Billing from '../../auth/model/BillingAccount';
import Plan from '../../auth/model/PlanSchema';
import User from '../../auth/model/User';
import { Portfolio, Review, Submission } from '../models/Portfolio';
import { fail, id, SCOUT_FEATURE_ID } from '../utils/portfolioInput';

export class PortfolioAccessService {
  async athlete(userId: string) {
    const athlete = await AthleteModel.findOne({ userId });
    if (!athlete) fail('An athlete profile is required', 403);
    return athlete;
  }

  async entitled(athleteId: any, session?: ClientSession) {
    // Lean preserves the distinction between an absent legacy snapshot and an empty one.
    const billing = await Billing.findOne({ profileId: athleteId })
      .sort({ updatedAt: -1, _id: -1 })
      .populate({ path: 'plan', select: 'features', model: Plan })
      .session(session ?? null)
      .lean();
    if (!billing || !['active', 'trialing'].includes(billing.status) || billing.needsUpdate) return false;
    const features = Object.prototype.hasOwnProperty.call(billing, 'features') ? billing.features : (billing.plan as any)?.features;
    return Array.isArray(features) && features.some((feature: any) => String(feature?._id ?? feature) === String(SCOUT_FEATURE_ID));
  }

  async hasAccess(athleteId: any, session?: ClientSession) {
    const athlete = await AthleteModel.findOne({ _id: athleteId, isActive: { $ne: false } }).session(session ?? null);
    const owner = athlete && (await User.exists({ _id: athlete.userId, isActive: { $ne: false } }).session(session ?? null));
    return Boolean(owner) && (await this.entitled(athleteId, session));
  }

  async requireEntitled(athleteId: any, session?: ClientSession) {
    if (!(await this.hasAccess(athleteId, session))) fail('Scouting access is required', 403);
  }

  async scout(userId: string, permission = 'scout.reports.view') {
    const scout = await ScoutModel.findOne({ user: userId, isActive: true });
    const owner = await User.exists({ _id: userId, isActive: { $ne: false } });
    if (!owner || !scout?.permissions?.includes(permission)) fail('Scout permission required', 403);
    return scout;
  }

  async isAdmin(userId: string) {
    return Boolean(await User.exists({ _id: userId, isActive: { $ne: false } })) && Boolean(await Admin.exists({ user: userId, roles: 'admin' }));
  }

  async admin(userId: string) {
    if (!(await this.isAdmin(userId))) fail('Administrator access required', 403);
  }

  async submission(userId: string, submissionId: string) {
    const submission = await Submission.findById(id(submissionId)).lean();
    if (!submission) fail('Submission not found', 404);
    if (await this.isAdmin(userId)) return submission;
    if (await AthleteModel.exists({ _id: submission.athleteId, userId })) return submission;
    const scout = await this.scout(userId);
    const review = await Review.findOne({ submissionId, scoutId: scout._id }).lean();
    if (review && review.status !== 'cancelled') return submission;
    const portfolio = await Portfolio.findOne({ athleteId: submission.athleteId, withdrawn: false, latestSubmission: submission._id });
    if (!portfolio) fail('Submission not available', 403);
    await this.requireEntitled(submission.athleteId);
    return submission;
  }
}
