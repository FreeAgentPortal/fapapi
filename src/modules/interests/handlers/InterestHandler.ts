import mongoose, { ClientSession, Types } from 'mongoose';
import BillingAccount from '../../auth/model/BillingAccount';
import { ConversationHandler } from '../../messaging/handlers/Conversation.handler';
import { ConversationModel, IConversation } from '../../messaging/models/Conversation';
import { IMessage } from '../../messaging/models/Message';
import { AthleteModel, IAthlete } from '../../profiles/athlete/models/AthleteModel';
import TeamModel, { ITeamProfile } from '../../profiles/team/model/TeamModel';
import { InterestError } from '../InterestError';
import { AthleteTeamInterestModel, IAthleteTeamInterest, InterestStatus } from '../models/AthleteTeamInterest';
import { InterestQuotaUsageModel } from '../models/InterestQuotaUsage';
import { getInterestCooldownEnd, getInterestPeriod } from '../utils/interestPeriod';

type QuotaPayload = {
  period: string;
  limit: number;
  used: number;
  remaining: number;
  resetsAt: Date;
};

type Pagination = { page: number; limit: number };

type ConversationResult = {
  conversation: IConversation;
  newMessage?: IMessage;
  created: boolean;
};

export class InterestHandler {
  constructor(private readonly conversationHandler: ConversationHandler = new ConversationHandler()) {}

  async getQuota(athleteProfileId: string, now: Date = new Date()): Promise<QuotaPayload> {
    const athlete = await this.requireActiveAthlete(athleteProfileId);
    const limit = await this.getMonthlyLimit(athlete._id.toString());
    const period = getInterestPeriod(now);
    const usage = await InterestQuotaUsageModel.findOne({ athleteProfile: athlete._id, period: period.key }).lean();
    const used = Number(usage?.used ?? 0);

    return {
      period: period.key,
      limit,
      used,
      remaining: Math.max(limit - used, 0),
      resetsAt: period.resetsAt,
    };
  }

  async expressInterest(input: {
    athleteProfileId: string;
    initiatedByUserId: string;
    teamId: string;
    note?: unknown;
    now?: Date;
  }): Promise<{ interest: IAthleteTeamInterest; quota: QuotaPayload }> {
    const now = input.now ?? new Date();
    const note = this.normalizeNote(input.note);
    const athlete = await this.requireActiveAthlete(input.athleteProfileId);
    const team = await this.requireEligibleTeam(input.teamId);
    const limit = await this.getMonthlyLimit(athlete._id.toString());

    if (limit <= 0) {
      throw new InterestError('INTEREST_NOT_INCLUDED', 'Express Interest is not included in the current plan.', 403);
    }

    const period = getInterestPeriod(now);
    let interest: IAthleteTeamInterest | null = null;
    let used = 0;

    for (let attempt = 0; attempt < 3; attempt++) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const current = await AthleteTeamInterestModel.findOne({
            athleteProfile: athlete._id,
            teamProfile: team._id,
          }).session(session);

          if (current) {
            const nextEligibleAt = getInterestCooldownEnd(current.lastExpressedAt);
            if (nextEligibleAt.getTime() > now.getTime()) {
              throw new InterestError('INTEREST_COOLDOWN', 'Interest was already expressed in this team during the cooldown period.', 409, {
                nextEligibleAt,
              });
            }
          }

          const usage = await this.reserveQuota(athlete._id, period.key, limit, period.resetsAt, session);
          used = usage.used;

          if (current) {
            current.initiatedByUser = new Types.ObjectId(input.initiatedByUserId);
            current.note = note;
            current.status = 'sent';
            current.lastExpressedAt = now;
            current.viewedAt = undefined;
            current.dismissedAt = undefined;
            current.conversationStartedAt = undefined;
            current.conversation = undefined;
            current.expressions.push({ expressedAt: now, note, quotaPeriod: period.key });
            interest = await current.save({ session });
          } else {
            const created = await AthleteTeamInterestModel.create(
              [
                {
                  athleteProfile: athlete._id,
                  teamProfile: team._id,
                  initiatedByUser: input.initiatedByUserId,
                  note,
                  status: 'sent',
                  lastExpressedAt: now,
                  expressions: [{ expressedAt: now, note, quotaPeriod: period.key }],
                },
              ],
              { session }
            );
            interest = created[0];
          }
        });
        break;
      } catch (err: any) {
        if (err?.code !== 11000 || attempt === 2) throw err;
        interest = null;
        used = 0;
      } finally {
        await session.endSession();
      }
    }

    if (!interest) {
      throw new Error('Interest transaction completed without a persisted interest.');
    }

    return {
      interest,
      quota: {
        period: period.key,
        limit,
        used,
        remaining: Math.max(limit - used, 0),
        resetsAt: period.resetsAt,
      },
    };
  }

  async getAthleteInterests(athleteProfileId: string, pagination: Pagination) {
    await this.requireActiveAthlete(athleteProfileId);
    const filter = { athleteProfile: athleteProfileId };
    const [entries, totalCount] = await Promise.all([
      AthleteTeamInterestModel.find(filter)
        .populate('teamProfile', 'name logoUrl location league openToTryouts isActive')
        .sort({ lastExpressedAt: -1 })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit)
        .lean(),
      AthleteTeamInterestModel.countDocuments(filter),
    ]);

    return {
      entries: entries.map((entry) => this.toAthleteView(entry)),
      metadata: this.paginationMetadata(totalCount, pagination),
    };
  }

  async getAthleteTeamStatuses(athleteProfileId: string, teamIds: string[]) {
    await this.requireActiveAthlete(athleteProfileId);
    if (teamIds.length > 50) {
      throw new InterestError('INTEREST_FORBIDDEN', 'A maximum of 50 team IDs may be requested.', 400);
    }
    if (teamIds.some((teamId) => !Types.ObjectId.isValid(teamId))) {
      throw new InterestError('INTEREST_FORBIDDEN', 'One or more team IDs are invalid.', 400);
    }

    const entries = await AthleteTeamInterestModel.find({
      athleteProfile: athleteProfileId,
      teamProfile: { $in: teamIds },
    }).lean();

    return entries.reduce<Record<string, unknown>>((result, entry) => {
      result[entry.teamProfile.toString()] = this.toAthleteView(entry);
      return result;
    }, {});
  }

  async getTeamInterests(teamId: string, userId: string, pagination: Pagination, status?: string) {
    await this.requireTeamAccess(teamId, userId);
    const filter: Record<string, unknown> = { teamProfile: teamId };
    if (status) {
      if (!['sent', 'viewed', 'dismissed', 'conversation_started'].includes(status)) {
        throw new InterestError('INTEREST_FORBIDDEN', 'Invalid interest status filter.', 400);
      }
      filter.status = status;
    }

    const [entries, totalCount] = await Promise.all([
      AthleteTeamInterestModel.find(filter)
        .populate('athleteProfile', 'fullName profileImageUrl positions college birthPlace sport league agent isActive')
        .sort({ lastExpressedAt: -1 })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit)
        .lean(),
      AthleteTeamInterestModel.countDocuments(filter),
    ]);

    return { entries, metadata: this.paginationMetadata(totalCount, pagination) };
  }

  async getTeamInterest(interestId: string, teamId: string, userId: string) {
    await this.requireTeamAccess(teamId, userId);
    this.requireValidInterestId(interestId);
    const interest = await AthleteTeamInterestModel.findOne({ _id: interestId, teamProfile: teamId })
      .populate('athleteProfile', 'fullName profileImageUrl positions college birthPlace sport league agent isActive')
      .lean();
    if (!interest) {
      throw new InterestError('INTEREST_FORBIDDEN', 'Interest was not found for this team.', 404);
    }
    return interest;
  }

  async markViewed(interestId: string, teamId: string, userId: string) {
    await this.requireTeamAccess(teamId, userId);
    this.requireValidInterestId(interestId);
    const now = new Date();
    const interest = await AthleteTeamInterestModel.findOneAndUpdate(
      { _id: interestId, teamProfile: teamId, status: 'sent' },
      { $set: { status: 'viewed', viewedAt: now } },
      { new: true }
    );
    if (interest) return interest;

    const existing = await AthleteTeamInterestModel.findOne({ _id: interestId, teamProfile: teamId });
    if (!existing) throw new InterestError('INTEREST_FORBIDDEN', 'Interest was not found for this team.', 404);
    return existing;
  }

  async dismiss(interestId: string, teamId: string, userId: string) {
    await this.requireTeamAccess(teamId, userId);
    this.requireValidInterestId(interestId);
    const interest = await AthleteTeamInterestModel.findOne({ _id: interestId, teamProfile: teamId });
    if (!interest) throw new InterestError('INTEREST_FORBIDDEN', 'Interest was not found for this team.', 404);
    if (interest.status === 'conversation_started') {
      throw new InterestError('INTEREST_FORBIDDEN', 'An interest with a conversation cannot be dismissed.', 409);
    }
    if (interest.status !== 'dismissed') {
      const now = new Date();
      interest.status = 'dismissed';
      interest.viewedAt = interest.viewedAt ?? now;
      interest.dismissedAt = now;
      await interest.save();
    }
    return interest;
  }

  async startConversation(input: {
    interestId: string;
    teamId: string;
    userId: string;
    message?: unknown;
  }): Promise<ConversationResult> {
    await this.requireTeamAccess(input.teamId, input.userId);
    this.requireValidInterestId(input.interestId);
    const interest = await AthleteTeamInterestModel.findOne({ _id: input.interestId, teamProfile: input.teamId });
    if (!interest) throw new InterestError('INTEREST_FORBIDDEN', 'Interest was not found for this team.', 404);

    const existing = await ConversationModel.findOne({
      'participants.team': input.teamId,
      'participants.athlete': interest.athleteProfile,
      status: { $ne: 'deleted' },
    });

    if (existing) {
      await this.markConversationStarted(interest, existing._id as Types.ObjectId);
      return { conversation: existing, created: false };
    }

    const message = typeof input.message === 'string' ? input.message.trim() : '';
    if (!message) {
      throw new InterestError('INTEREST_FORBIDDEN', 'An initial message is required to start a conversation.', 400);
    }
    if (message.length > 2000) {
      throw new InterestError('INTEREST_FORBIDDEN', 'The initial message cannot exceed 2000 characters.', 400);
    }

    const created = await this.conversationHandler.startConversation(
      input.teamId,
      interest.athleteProfile.toString(),
      input.userId,
      message
    );
    await this.markConversationStarted(interest, created.conversation._id as Types.ObjectId);
    return { ...created, created: true };
  }

  private async reserveQuota(
    athleteProfileId: Types.ObjectId,
    period: string,
    limit: number,
    resetsAt: Date,
    session: ClientSession
  ) {
    let usage = await InterestQuotaUsageModel.findOne({ athleteProfile: athleteProfileId, period }).session(session);
    if (!usage) {
      const created = await InterestQuotaUsageModel.create(
        [{ athleteProfile: athleteProfileId, period, used: 0, limitSnapshot: limit }],
        { session }
      );
      usage = created[0];
    }

    if (usage.used >= limit) {
      throw new InterestError('INTEREST_LIMIT_REACHED', 'The monthly Express Interest limit has been reached.', 429, {
        limit,
        used: usage.used,
        resetsAt,
      });
    }

    usage.used += 1;
    usage.limitSnapshot = limit;
    return await usage.save({ session });
  }

  private async getMonthlyLimit(athleteProfileId: string): Promise<number> {
    const billing = await BillingAccount.findOne({ profileId: athleteProfileId }).populate('plan').lean();
    if (!billing || !['active', 'trialing'].includes(billing.status) || billing.needsUpdate === true) return 0;

    const billingEntitlement = (billing.entitlements as any)?.teamInterestsPerMonth;
    const planEntitlement = (billing.plan as any)?.entitlements?.teamInterestsPerMonth;
    const resolved = billingEntitlement === null || billingEntitlement === undefined ? Number(planEntitlement) : Number(billingEntitlement);
    return Number.isFinite(resolved) ? Math.max(0, Math.floor(resolved)) : 0;
  }

  private async requireActiveAthlete(athleteProfileId: string): Promise<IAthlete> {
    if (!athleteProfileId || !Types.ObjectId.isValid(athleteProfileId)) {
      throw new InterestError('INTEREST_FORBIDDEN', 'An athlete profile is required.', 403);
    }
    const athlete = await AthleteModel.findById(athleteProfileId);
    if (!athlete || athlete.isActive !== true) {
      throw new InterestError('INTEREST_FORBIDDEN', 'An active athlete profile is required.', 403);
    }
    return athlete;
  }

  private async requireEligibleTeam(teamId: string): Promise<ITeamProfile> {
    if (!teamId || !Types.ObjectId.isValid(teamId)) {
      throw new InterestError('TEAM_NOT_ELIGIBLE', 'A valid team is required.', 400);
    }
    const team = await TeamModel.findById(teamId);
    const claimed = Boolean(team?.linkedUsers?.some((member: any) => member?.user || Types.ObjectId.isValid(member)));
    if (!team || team.openToTryouts !== true || team.isActivelyRecruiting !== true || !claimed) {
      throw new InterestError('TEAM_NOT_ELIGIBLE', 'This team is not currently accepting interest.', 409);
    }
    return team;
  }

  private async requireTeamAccess(teamId: string, userId: string): Promise<ITeamProfile> {
    if (!teamId || !userId || !Types.ObjectId.isValid(teamId) || !Types.ObjectId.isValid(userId)) {
      throw new InterestError('INTEREST_FORBIDDEN', 'A linked team profile is required.', 403);
    }
    const team = await TeamModel.findOne({ _id: teamId, 'linkedUsers.user': userId });
    if (!team) throw new InterestError('INTEREST_FORBIDDEN', 'You do not have access to this team inbox.', 403);
    return team;
  }

  private normalizeNote(note: unknown): string | undefined {
    if (note === undefined || note === null) return undefined;
    if (typeof note !== 'string') throw new InterestError('INTEREST_FORBIDDEN', 'Interest note must be text.', 400);
    const normalized = note.trim();
    if (!normalized) return undefined;
    if (normalized.length > 280) throw new InterestError('INTEREST_FORBIDDEN', 'Interest note cannot exceed 280 characters.', 400);
    return normalized;
  }

  private requireValidInterestId(interestId: string): void {
    if (!interestId || !Types.ObjectId.isValid(interestId)) {
      throw new InterestError('INTEREST_FORBIDDEN', 'A valid interest ID is required.', 400);
    }
  }

  private toAthleteView(entry: any) {
    const status: InterestStatus = entry.status === 'dismissed' ? 'viewed' : entry.status;
    const { dismissedAt: _dismissedAt, ...visible } = entry;
    return { ...visible, status, nextEligibleAt: getInterestCooldownEnd(entry.lastExpressedAt) };
  }

  private paginationMetadata(totalCount: number, pagination: Pagination) {
    const pages = Math.ceil(totalCount / pagination.limit);
    return {
      page: pagination.page,
      pageSize: pagination.limit,
      totalCount,
      pages,
      prevPage: pagination.page > 1 ? pagination.page - 1 : null,
      nextPage: pagination.page < pages ? pagination.page + 1 : null,
    };
  }

  private async markConversationStarted(interest: IAthleteTeamInterest, conversationId: Types.ObjectId) {
    interest.status = 'conversation_started';
    interest.conversation = conversationId;
    interest.viewedAt = interest.viewedAt ?? new Date();
    interest.conversationStartedAt = new Date();
    await interest.save();
  }
}
