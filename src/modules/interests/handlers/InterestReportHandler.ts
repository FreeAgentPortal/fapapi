import { PipelineStage, Types } from 'mongoose';
import TeamModel from '../../profiles/team/model/TeamModel';
import { AthleteTeamInterestModel, INTEREST_STATUSES, InterestStatus } from '../models/AthleteTeamInterest';

type CountRow = { count: number };
type DailyRow = { _id: string; totalExpressions: number };
type OutcomeRow = { _id: InterestStatus; count: number };
type TopTeamRow = {
  _id: Types.ObjectId;
  totalExpressions: number;
  uniqueAthletes: number;
  lastExpressedAt: Date;
};

type ReportFacets = {
  totalExpressions: CountRow[];
  uniqueAthletes: CountRow[];
  uniqueTeams: CountRow[];
  interestPairs: CountRow[];
  currentOutcomes: OutcomeRow[];
  dailyExpressions: DailyRow[];
  topTeams: TopTeamRow[];
};

export class InterestReportHandler {
  async generateReport(days: number, now: Date = new Date()) {
    const startDate = new Date(now);
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const dateFilter = { $gte: startDate, $lte: now };
    const pipeline: PipelineStage[] = [
      { $match: { 'expressions.expressedAt': dateFilter } },
      { $unwind: '$expressions' },
      { $match: { 'expressions.expressedAt': dateFilter } },
      {
        $facet: {
          totalExpressions: [{ $count: 'count' }],
          uniqueAthletes: [{ $group: { _id: '$athleteProfile' } }, { $count: 'count' }],
          uniqueTeams: [{ $group: { _id: '$teamProfile' } }, { $count: 'count' }],
          interestPairs: [{ $group: { _id: '$_id' } }, { $count: 'count' }],
          currentOutcomes: [
            { $group: { _id: '$_id', status: { $first: '$status' } } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          dailyExpressions: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$expressions.expressedAt', timezone: 'UTC' } },
                totalExpressions: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          topTeams: [
            {
              $group: {
                _id: { teamProfile: '$teamProfile', athleteProfile: '$athleteProfile' },
                totalExpressions: { $sum: 1 },
                lastExpressedAt: { $max: '$expressions.expressedAt' },
              },
            },
            {
              $group: {
                _id: '$_id.teamProfile',
                totalExpressions: { $sum: '$totalExpressions' },
                uniqueAthletes: { $sum: 1 },
                lastExpressedAt: { $max: '$lastExpressedAt' },
              },
            },
            { $sort: { totalExpressions: -1, lastExpressedAt: -1, _id: 1 } },
            { $limit: 10 },
          ],
        },
      },
    ];

    const [result] = await AthleteTeamInterestModel.aggregate<ReportFacets>(pipeline);
    const facets = result ?? {
      totalExpressions: [],
      uniqueAthletes: [],
      uniqueTeams: [],
      interestPairs: [],
      currentOutcomes: [],
      dailyExpressions: [],
      topTeams: [],
    };

    const counts = INTEREST_STATUSES.reduce(
      (record, status) => ({ ...record, [status]: 0 }),
      {} as Record<InterestStatus, number>
    );
    for (const row of facets.currentOutcomes) {
      if (INTEREST_STATUSES.includes(row._id)) counts[row._id] = row.count;
    }

    const dailyMap = new Map(facets.dailyExpressions.map((row) => [row._id, row.totalExpressions]));
    const dailyExpressions = Array.from({ length: days }, (_, index) => {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      return { date: dateKey, totalExpressions: dailyMap.get(dateKey) ?? 0 };
    });

    const teamIds = facets.topTeams.map((row) => row._id);
    const teams = teamIds.length
      ? await TeamModel.find({ _id: { $in: teamIds } }).select('_id name logoUrl').lean()
      : [];
    const teamMap = new Map(teams.map((team) => [String(team._id), team]));
    const topTeams = facets.topTeams.map((row) => {
      const teamProfileId = String(row._id);
      const team = teamMap.get(teamProfileId);
      return {
        teamProfileId,
        name: team?.name ?? 'Unavailable team',
        logoUrl: team?.logoUrl ?? null,
        isAvailable: Boolean(team),
        totalExpressions: row.totalExpressions,
        uniqueAthletes: row.uniqueAthletes,
        lastExpressedAt: row.lastExpressedAt,
      };
    });

    return {
      generatedAt: now.toISOString(),
      range: { days, startDate, endDate: now },
      summary: {
        totalExpressions: facets.totalExpressions[0]?.count ?? 0,
        uniqueAthletes: facets.uniqueAthletes[0]?.count ?? 0,
        uniqueTeams: facets.uniqueTeams[0]?.count ?? 0,
        interestPairs: facets.interestPairs[0]?.count ?? 0,
      },
      currentOutcomes: {
        basis: 'current status of athlete/team pairs with an expression in range',
        asOf: now.toISOString(),
        counts,
      },
      dailyExpressions,
      topTeams,
    };
  }
}
