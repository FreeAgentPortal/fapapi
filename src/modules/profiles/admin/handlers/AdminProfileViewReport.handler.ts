import { AthleteModel } from '../../athlete/models/AthleteModel';
import { ProfileViewModel } from '../../analytics/model/ProfileViewModel';
import { ProfileSubjectType, ViewerProfileType } from '../../analytics/types';
import { ProfessionalProfileModel } from '../../professional/model/ProfessionalProfile';
import TeamModel from '../../team/model/TeamModel';

export type AdminProfileViewSubjectFilter = ProfileSubjectType | 'all';
export type AdminProfileViewViewerFilter = ViewerProfileType | 'all';

export interface AdminProfileViewReportOptions {
  days: number;
  subjectType: AdminProfileViewSubjectFilter;
  viewerType: AdminProfileViewViewerFilter;
  page: number;
  limit: number;
}

type AdminProfileViewEntry = {
  subjectType: ProfileSubjectType;
  subjectProfileId: string;
  displayName: string;
  profileImageUrl?: string;
  headline?: string;
  isAvailable: boolean;
  totalViews: number;
  uniqueViewers: number;
  uniqueTeams: number;
  lastViewedAt: Date;
};

type AdminTopTeamEntry = {
  teamProfileId: string;
  name: string;
  logoUrl?: string;
  isAvailable: boolean;
  totalViews: number;
  uniqueProfilesViewed: number;
  lastViewedAt: Date;
};

export interface AdminProfileViewReport {
  generatedAt: string;
  days: number;
  filters: {
    subjectType: AdminProfileViewSubjectFilter;
    viewerType: AdminProfileViewViewerFilter;
  };
  summary: {
    totalViews: number;
    uniqueViewers: number;
    uniqueTeams: number;
    viewedProfiles: number;
    viewedAthletes: number;
    viewedProfessionals: number;
  };
  viewsBySubjectType: Record<ProfileSubjectType, number>;
  viewsByViewerType: Record<ViewerProfileType, number>;
  dailyViews: Array<{
    date: string;
    totalViews: number;
    uniqueViewers: number;
    profilesViewed: number;
  }>;
  topTeams: AdminTopTeamEntry[];
  profiles: AdminProfileViewEntry[];
  metadata: {
    page: number;
    limit: number;
    pages: number;
    totalCount: number;
    prevPage: number | null;
    nextPage: number | null;
  };
}

const SUBJECT_TYPES: ProfileSubjectType[] = ['athlete', 'professional'];
const VIEWER_TYPES: ViewerProfileType[] = ['team', 'scout', 'agent', 'athlete', 'professional', 'admin'];

export class AdminProfileViewReportHandler {
  public async generateReport(options: AdminProfileViewReportOptions): Promise<AdminProfileViewReport> {
    const startDate = this.getUtcStartDate(options.days);
    const match: Record<string, unknown> = { createdAt: { $gte: startDate } };
    if (options.subjectType !== 'all') match.subjectType = options.subjectType;
    if (options.viewerType !== 'all') match.viewerType = options.viewerType;

    const [overviewResults, profileResults, topTeamRows] = await Promise.all([
      ProfileViewModel.aggregate(this.buildOverviewPipeline(match)),
      ProfileViewModel.aggregate(this.buildProfilesPipeline(match, options.page, options.limit)),
      options.viewerType === 'all' || options.viewerType === 'team'
        ? ProfileViewModel.aggregate(this.buildTopTeamsPipeline({ ...match, viewerType: 'team' }))
        : Promise.resolve([]),
    ]);

    const overview = overviewResults[0] ?? {};
    const profileResult = profileResults[0] ?? { entries: [], metadata: [] };
    const rawProfileEntries = profileResult.entries ?? [];
    const profiles = await this.enrichProfiles(rawProfileEntries);
    const topTeams = await this.enrichTeams(topTeamRows);

    const viewsBySubjectType = this.zeroFilledRecord(SUBJECT_TYPES);
    for (const row of overview.viewsBySubjectType ?? []) {
      if (SUBJECT_TYPES.includes(row._id)) viewsBySubjectType[row._id as ProfileSubjectType] = row.count;
    }

    const viewsByViewerType = this.zeroFilledRecord(VIEWER_TYPES);
    for (const row of overview.viewsByViewerType ?? []) {
      if (VIEWER_TYPES.includes(row._id)) viewsByViewerType[row._id as ViewerProfileType] = row.count;
    }

    const viewedProfilesBySubject = this.zeroFilledRecord(SUBJECT_TYPES);
    for (const row of overview.viewedProfilesBySubject ?? []) {
      if (SUBJECT_TYPES.includes(row._id)) viewedProfilesBySubject[row._id as ProfileSubjectType] = row.count;
    }

    const dailyMap = new Map((overview.dailyViews ?? []).map((row: any) => [row._id, row]));
    const dailyViews = Array.from({ length: options.days }, (_, index) => {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const row: any = dailyMap.get(dateKey);
      return {
        date: dateKey,
        totalViews: row?.totalViews ?? 0,
        uniqueViewers: row?.uniqueViewers ?? 0,
        profilesViewed: row?.profilesViewed ?? 0,
      };
    });

    const summaryRow = overview.summary?.[0] ?? {};
    const totalCount = profileResult.metadata?.[0]?.totalCount ?? 0;
    const pages = Math.ceil(totalCount / options.limit);

    return {
      generatedAt: new Date().toISOString(),
      days: options.days,
      filters: {
        subjectType: options.subjectType,
        viewerType: options.viewerType,
      },
      summary: {
        totalViews: summaryRow.totalViews ?? 0,
        uniqueViewers: summaryRow.uniqueViewers ?? 0,
        uniqueTeams: summaryRow.uniqueTeams ?? 0,
        viewedProfiles: viewedProfilesBySubject.athlete + viewedProfilesBySubject.professional,
        viewedAthletes: viewedProfilesBySubject.athlete,
        viewedProfessionals: viewedProfilesBySubject.professional,
      },
      viewsBySubjectType,
      viewsByViewerType,
      dailyViews,
      topTeams,
      profiles,
      metadata: {
        page: options.page,
        limit: options.limit,
        pages,
        totalCount,
        prevPage: options.page > 1 ? options.page - 1 : null,
        nextPage: options.page < pages ? options.page + 1 : null,
      },
    };
  }

  private buildOverviewPipeline(match: Record<string, unknown>): any[] {
    return [
      { $match: match },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalViews: { $sum: 1 },
                uniqueViewers: { $addToSet: { type: '$viewerType', profileId: '$viewerProfileId' } },
                uniqueTeams: {
                  $addToSet: { $cond: [{ $eq: ['$viewerType', 'team'] }, '$viewerProfileId', null] },
                },
              },
            },
            {
              $project: {
                _id: 0,
                totalViews: 1,
                uniqueViewers: { $size: '$uniqueViewers' },
                uniqueTeams: { $size: { $setDifference: ['$uniqueTeams', [null]] } },
              },
            },
          ],
          viewsBySubjectType: [{ $group: { _id: '$subjectType', count: { $sum: 1 } } }],
          viewsByViewerType: [{ $group: { _id: '$viewerType', count: { $sum: 1 } } }],
          viewedProfilesBySubject: [
            { $group: { _id: { subjectType: '$subjectType', subjectProfileId: '$subjectProfileId' } } },
            { $group: { _id: '$_id.subjectType', count: { $sum: 1 } } },
          ],
          dailyViews: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
                totalViews: { $sum: 1 },
                uniqueViewers: { $addToSet: { type: '$viewerType', profileId: '$viewerProfileId' } },
                profilesViewed: { $addToSet: { type: '$subjectType', profileId: '$subjectProfileId' } },
              },
            },
            {
              $project: {
                _id: 1,
                totalViews: 1,
                uniqueViewers: { $size: '$uniqueViewers' },
                profilesViewed: { $size: '$profilesViewed' },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ];
  }

  private buildProfilesPipeline(match: Record<string, unknown>, page: number, limit: number): any[] {
    return [
      { $match: match },
      {
        $group: {
          _id: { subjectType: '$subjectType', subjectProfileId: '$subjectProfileId' },
          totalViews: { $sum: 1 },
          uniqueViewers: { $addToSet: { type: '$viewerType', profileId: '$viewerProfileId' } },
          uniqueTeams: { $addToSet: { $cond: [{ $eq: ['$viewerType', 'team'] }, '$viewerProfileId', null] } },
          lastViewedAt: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          _id: 1,
          totalViews: 1,
          uniqueViewers: { $size: '$uniqueViewers' },
          uniqueTeams: { $size: { $setDifference: ['$uniqueTeams', [null]] } },
          lastViewedAt: 1,
        },
      },
      { $sort: { totalViews: -1, lastViewedAt: -1, '_id.subjectProfileId': 1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          entries: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        },
      },
    ];
  }

  private buildTopTeamsPipeline(match: Record<string, unknown>): any[] {
    return [
      { $match: match },
      {
        $group: {
          _id: '$viewerProfileId',
          totalViews: { $sum: 1 },
          uniqueProfilesViewed: { $addToSet: { type: '$subjectType', profileId: '$subjectProfileId' } },
          lastViewedAt: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          totalViews: 1,
          uniqueProfilesViewed: { $size: '$uniqueProfilesViewed' },
          lastViewedAt: 1,
        },
      },
      { $sort: { totalViews: -1, lastViewedAt: -1, _id: 1 } },
      { $limit: 10 },
    ];
  }

  private async enrichProfiles(rows: any[]): Promise<AdminProfileViewEntry[]> {
    const athleteIds = rows.filter((row) => row._id.subjectType === 'athlete').map((row) => row._id.subjectProfileId);
    const professionalIds = rows.filter((row) => row._id.subjectType === 'professional').map((row) => row._id.subjectProfileId);

    const [athletes, professionals] = await Promise.all([
      AthleteModel.find({ _id: { $in: athleteIds } }).select('_id fullName profileImageUrl').lean(),
      ProfessionalProfileModel.find({ _id: { $in: professionalIds } }).select('_id displayName avatarUrl headline').lean(),
    ]);
    const athleteMap = new Map(athletes.map((profile: any) => [String(profile._id), profile]));
    const professionalMap = new Map(professionals.map((profile: any) => [String(profile._id), profile]));

    return rows.map((row) => {
      const subjectType = row._id.subjectType as ProfileSubjectType;
      const subjectProfileId = String(row._id.subjectProfileId);
      const profile = subjectType === 'athlete' ? athleteMap.get(subjectProfileId) : professionalMap.get(subjectProfileId);
      return {
        subjectType,
        subjectProfileId,
        displayName: profile?.fullName ?? profile?.displayName ?? `Unavailable ${subjectType}`,
        profileImageUrl: profile?.profileImageUrl ?? profile?.avatarUrl,
        headline: profile?.headline,
        isAvailable: Boolean(profile),
        totalViews: row.totalViews,
        uniqueViewers: row.uniqueViewers,
        uniqueTeams: row.uniqueTeams,
        lastViewedAt: row.lastViewedAt,
      };
    });
  }

  private async enrichTeams(rows: any[]): Promise<AdminTopTeamEntry[]> {
    if (rows.length === 0) return [];
    const teams = await TeamModel.find({ _id: { $in: rows.map((row) => row._id) } }).select('_id name logoUrl').lean();
    const teamMap = new Map(teams.map((team: any) => [String(team._id), team]));

    return rows.map((row) => {
      const teamProfileId = String(row._id);
      const team = teamMap.get(teamProfileId);
      return {
        teamProfileId,
        name: team?.name ?? 'Unavailable team',
        logoUrl: team?.logoUrl,
        isAvailable: Boolean(team),
        totalViews: row.totalViews,
        uniqueProfilesViewed: row.uniqueProfilesViewed,
        lastViewedAt: row.lastViewedAt,
      };
    });
  }

  private zeroFilledRecord<T extends string>(keys: readonly T[]): Record<T, number> {
    return keys.reduce((result, key) => ({ ...result, [key]: 0 }), {} as Record<T, number>);
  }

  private getUtcStartDate(days: number): Date {
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    return startDate;
  }
}
