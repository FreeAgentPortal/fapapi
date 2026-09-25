import mongoose from 'mongoose';

const mockAggregate = jest.fn();
const mockAthleteLean = jest.fn();
const mockProfessionalLean = jest.fn();
const mockTeamLean = jest.fn();
const mockAthleteSelect = jest.fn(() => ({ lean: mockAthleteLean }));
const mockProfessionalSelect = jest.fn(() => ({ lean: mockProfessionalLean }));
const mockTeamSelect = jest.fn(() => ({ lean: mockTeamLean }));
const mockAthleteFind = jest.fn(() => ({ select: mockAthleteSelect }));
const mockProfessionalFind = jest.fn(() => ({ select: mockProfessionalSelect }));
const mockTeamFind = jest.fn(() => ({ select: mockTeamSelect }));

jest.mock('../../analytics/model/ProfileViewModel', () => ({
  ProfileViewModel: { aggregate: mockAggregate },
}));

jest.mock('../../athlete/models/AthleteModel', () => ({
  AthleteModel: { find: mockAthleteFind },
}));

jest.mock('../../professional/model/ProfessionalProfile', () => ({
  ProfessionalProfileModel: { find: mockProfessionalFind },
}));

jest.mock('../../team/model/TeamModel', () => ({
  __esModule: true,
  default: { find: mockTeamFind },
}));

import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import { RolesConfig } from '../../../../utils/RolesConfig';
import { AdminProfileViewReportHandler } from '../handlers/AdminProfileViewReport.handler';
import { authorizeProfileViewAnalytics } from '../route';
import AdminService from '../service/AdminService';

const athleteId = new mongoose.Types.ObjectId();
const professionalId = new mongoose.Types.ObjectId();
const teamId = new mongoose.Types.ObjectId();

const buildResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('AdminProfileViewReportHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T18:00:00.000Z'));
    mockAthleteLean.mockResolvedValue([{ _id: athleteId, fullName: 'Athlete One', profileImageUrl: 'athlete.jpg' }]);
    mockProfessionalLean.mockResolvedValue([
      { _id: professionalId, displayName: 'Professional One', avatarUrl: 'professional.jpg', headline: 'General Manager' },
    ]);
    mockTeamLean.mockResolvedValue([{ _id: teamId, name: 'Team One', logoUrl: 'team.png' }]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns portfolio totals, UTC trends, top teams, enriched profiles, and pagination', async () => {
    mockAggregate
      .mockResolvedValueOnce([
        {
          summary: [{ totalViews: 6, uniqueViewers: 3, uniqueTeams: 2 }],
          viewsBySubjectType: [
            { _id: 'athlete', count: 4 },
            { _id: 'professional', count: 2 },
          ],
          viewsByViewerType: [{ _id: 'team', count: 6 }],
          viewedProfilesBySubject: [
            { _id: 'athlete', count: 1 },
            { _id: 'professional', count: 1 },
          ],
          dailyViews: [{ _id: '2026-09-02', totalViews: 6, uniqueViewers: 3, profilesViewed: 2 }],
        },
      ])
      .mockResolvedValueOnce([
        {
          entries: [
            {
              _id: { subjectType: 'athlete', subjectProfileId: athleteId },
              totalViews: 4,
              uniqueViewers: 2,
              uniqueTeams: 2,
              lastViewedAt: new Date('2026-09-03T12:00:00.000Z'),
            },
            {
              _id: { subjectType: 'professional', subjectProfileId: professionalId },
              totalViews: 2,
              uniqueViewers: 1,
              uniqueTeams: 1,
              lastViewedAt: new Date('2026-09-02T12:00:00.000Z'),
            },
          ],
          metadata: [{ totalCount: 2 }],
        },
      ])
      .mockResolvedValueOnce([
        {
          _id: teamId,
          totalViews: 6,
          uniqueProfilesViewed: 2,
          lastViewedAt: new Date('2026-09-03T12:00:00.000Z'),
        },
      ]);

    const result = await new AdminProfileViewReportHandler().generateReport({
      days: 3,
      subjectType: 'all',
      viewerType: 'team',
      page: 1,
      limit: 25,
    });

    expect(result.summary).toEqual({
      totalViews: 6,
      uniqueViewers: 3,
      uniqueTeams: 2,
      viewedProfiles: 2,
      viewedAthletes: 1,
      viewedProfessionals: 1,
    });
    expect(result.viewsBySubjectType).toEqual({ athlete: 4, professional: 2 });
    expect(result.viewsByViewerType).toEqual({ team: 6, scout: 0, agent: 0, athlete: 0, professional: 0, admin: 0 });
    expect(result.dailyViews).toEqual([
      { date: '2026-09-01', totalViews: 0, uniqueViewers: 0, profilesViewed: 0 },
      { date: '2026-09-02', totalViews: 6, uniqueViewers: 3, profilesViewed: 2 },
      { date: '2026-09-03', totalViews: 0, uniqueViewers: 0, profilesViewed: 0 },
    ]);
    expect(result.profiles).toEqual([
      expect.objectContaining({ subjectType: 'athlete', displayName: 'Athlete One', isAvailable: true }),
      expect.objectContaining({ subjectType: 'professional', displayName: 'Professional One', headline: 'General Manager', isAvailable: true }),
    ]);
    expect(result.topTeams).toEqual([
      expect.objectContaining({ teamProfileId: teamId.toString(), name: 'Team One', uniqueProfilesViewed: 2 }),
    ]);
    expect(result.metadata).toEqual({ page: 1, limit: 25, pages: 1, totalCount: 2, prevPage: null, nextPage: null });

    const overviewPipeline = mockAggregate.mock.calls[0][0] as any[];
    expect(overviewPipeline[0].$match).toMatchObject({ viewerType: 'team' });
    expect(overviewPipeline[0].$match).not.toHaveProperty('subjectType');
  });

  it('returns zero-filled empty results and omits top-team work for a non-team filter', async () => {
    mockAggregate.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{ entries: [], metadata: [] }]);

    const result = await new AdminProfileViewReportHandler().generateReport({
      days: 1,
      subjectType: 'professional',
      viewerType: 'scout',
      page: 2,
      limit: 10,
    });

    expect(mockAggregate).toHaveBeenCalledTimes(2);
    expect(mockTeamFind).not.toHaveBeenCalled();
    expect(result.summary).toEqual({
      totalViews: 0,
      uniqueViewers: 0,
      uniqueTeams: 0,
      viewedProfiles: 0,
      viewedAthletes: 0,
      viewedProfessionals: 0,
    });
    expect(result.dailyViews).toEqual([{ date: '2026-09-03', totalViews: 0, uniqueViewers: 0, profilesViewed: 0 }]);
    expect(result.topTeams).toEqual([]);
    expect(result.metadata).toEqual({ page: 2, limit: 10, pages: 0, totalCount: 0, prevPage: 1, nextPage: null });
  });
});

describe('admin profile view report service and authorization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to team activity and emits pagination as top-level metadata', async () => {
    const generateReport = jest.spyOn(AdminProfileViewReportHandler.prototype, 'generateReport').mockResolvedValue({
      generatedAt: '2026-09-03T18:00:00.000Z',
      days: 30,
      filters: { subjectType: 'all', viewerType: 'team' },
      summary: { totalViews: 0, uniqueViewers: 0, uniqueTeams: 0, viewedProfiles: 0, viewedAthletes: 0, viewedProfessionals: 0 },
      viewsBySubjectType: { athlete: 0, professional: 0 },
      viewsByViewerType: { team: 0, scout: 0, agent: 0, athlete: 0, professional: 0, admin: 0 },
      dailyViews: [],
      topTeams: [],
      profiles: [],
      metadata: { page: 1, limit: 25, pages: 0, totalCount: 0, prevPage: null, nextPage: null },
    });
    const service = new AdminService();
    const res = buildResponse();

    service.getProfileViewReport({ query: {} } as any, res as any, jest.fn());
    await flushPromises();

    expect(generateReport).toHaveBeenCalledWith({ days: 30, subjectType: 'all', viewerType: 'team', page: 1, limit: 25 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        payload: expect.not.objectContaining({ metadata: expect.anything() }),
        metadata: expect.objectContaining({ page: 1, limit: 25 }),
      })
    );
  });

  it.each([
    [{ days: '0' }, 'days'],
    [{ days: '91' }, 'days'],
    [{ subjectType: 'team' }, 'subjectType'],
    [{ viewerType: 'resume' }, 'viewerType'],
    [{ pageNumber: '1.5' }, 'pageNumber'],
    [{ pageLimit: '101' }, 'pageLimit'],
  ])('returns 400 for invalid query input %#', async (query, expectedMessage) => {
    const generateReport = jest.spyOn(AdminProfileViewReportHandler.prototype, 'generateReport');
    const service = new AdminService();
    const res = buildResponse();

    service.getProfileViewReport({ query } as any, res as any, jest.fn());
    await flushPromises();

    expect(generateReport).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining(expectedMessage) }));
  });

  it('assigns and enforces the dedicated permission only for administrators', () => {
    expect(RolesConfig.getDefaultPermissionsForRole('admin')).toContain('analytics.profileViews');
    expect(RolesConfig.getDefaultPermissionsForRole('developer')).not.toContain('analytics.profileViews');
    expect(RolesConfig.getDefaultPermissionsForRole('support')).not.toContain('analytics.profileViews');
    expect(RolesConfig.getDefaultPermissionsForRole('scout')).not.toContain('analytics.profileViews');

    const guard = AuthMiddleware.authorizeRoles(['analytics.profileViews']);
    const next = jest.fn();
    const res = buildResponse();
    guard({ user: { permissions: ['analytics.read'] } } as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    guard({ user: { permissions: ['analytics.profileViews'] } } as any, res as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps existing persisted admin roles authorized without opening access to other admin-profile roles', () => {
    const next = jest.fn();
    const res = buildResponse();

    authorizeProfileViewAnalytics({ user: { permissions: ['analytics.read'], roles: ['developer'] } } as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    authorizeProfileViewAnalytics({ user: { permissions: ['analytics.read'], roles: ['admin'] } } as any, res as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
