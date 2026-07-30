import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import TeamModel from '../../team/model/TeamModel';
import { ProfessionalProfileModel } from '../model/ProfessionalProfile';
import {
  createTalentSearchRateLimiter,
  TALENT_SEARCH_RATE_LIMIT,
} from '../route/talentSearchRateLimiter';
import TalentSearchService from '../service/TalentSearch.service';
import {
  buildFlexibleTextPattern,
  parseTalentSearchQuery,
} from '../utils/talentSearchQuery';

describe('professional talent search query parsing', () => {
  it('parses allowlisted AND and OR filters while discarding eligibility hints', () => {
    const parsed = parseTalentSearchQuery({
      filterOptions:
        'isActive;false|visibility;{"$in":"private"}|jobSearchStatus;closed|experienceLevel;mid|desiredRoles;{"$in":"analytics,scout"}|location.city;York',
      includeOptions: 'industries;{"$in":["analytics_data","football_operations"]}|openToRemote;true',
      keyword: '  football operations  ',
      pageNumber: '2',
      limit: '50',
    });

    expect(parsed).toEqual({
      andFilters: [
        { experienceLevel: 'mid' },
        { desiredRoles: { $in: ['analytics', 'scout'] } },
        { 'location.city': { $regex: 'York', $options: 'i' } },
      ],
      includeFilters: [
        { industries: { $in: ['analytics_data', 'football_operations'] } },
        { openToRemote: true },
      ],
      keyword: 'football operations',
      keywordPattern: 'football[\\s_-]+operations',
      page: 2,
      limit: 50,
    });
  });

  it('defaults pagination and treats empty keyword and filters as absent', () => {
    expect(parseTalentSearchQuery({ keyword: ' ', filterOptions: '', includeOptions: '' })).toEqual({
      andFilters: [],
      includeFilters: [],
      keyword: undefined,
      keywordPattern: undefined,
      page: 1,
      limit: 20,
    });
  });

  it('escapes regex metacharacters and keeps slug separators flexible', () => {
    expect(buildFlexibleTextPattern('C++ football_operations')).toBe(
      'C\\+\\+[\\s_-]+football[\\s_-]+operations'
    );

    const parsed = parseTalentSearchQuery({
      filterOptions: 'location.state;New (York).*',
    });

    expect(parsed.andFilters).toEqual([
      { 'location.state': { $regex: 'New \\(York\\)\\.\\*', $options: 'i' } },
    ]);
  });

  it.each([
    [{ filterOptions: 'unknown;value' }, 'Unsupported filter field'],
    [{ filterOptions: 'desiredRoles;{"$where":"evil"}' }, 'only supports the $in operator'],
    [{ filterOptions: 'desiredRoles;{"$in":["valid",{"$gt":""}]}' }, '$in values must be strings'],
    [{ filterOptions: 'openToRemote;yes' }, 'must be true or false'],
    [{ filterOptions: 'location.city;ok|broken' }, 'Malformed filter clause'],
    [{ pageNumber: '1.5' }, 'positive integer'],
    [{ pageNumber: '0' }, 'between 1'],
    [{ limit: '51' }, 'between 1 and 50'],
    [{ keyword: 'x'.repeat(101) }, 'cannot exceed 100'],
    [{ filterOptions: ['experienceLevel;mid'] }, 'single string value'],
  ])('rejects unsafe or malformed query input %#', (query, message) => {
    expect(() => parseTalentSearchQuery(query as any)).toThrow(message);
  });
});

describe('professional talent search authorization and aggregation', () => {
  const service = new TalentSearchService();
  const userId = new mongoose.Types.ObjectId();
  const teamId = new mongoose.Types.ObjectId();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const teamUser = () =>
    ({
      _id: userId,
      isActive: true,
      role: ['team'],
      profileRefs: { team: teamId.toString() },
    }) as any;

  it('requires the team claim, active account, profile reference, and persisted membership', async () => {
    const exists = jest.spyOn(TeamModel, 'exists').mockResolvedValue({ _id: teamId } as any);

    await expect(service.authorizeTeam(teamUser())).resolves.toBe(teamId.toString());
    expect(exists).toHaveBeenCalledWith({
      _id: teamId.toString(),
      isActive: { $ne: false },
      'linkedUsers.user': userId,
    });
  });

  it('does not allow a team service header or profile reference to replace the team role', async () => {
    const exists = jest.spyOn(TeamModel, 'exists');
    const user = { ...teamUser(), role: ['professional'] };

    await expect(service.authorizeTeam(user)).rejects.toMatchObject({ statusCode: 403 });
    expect(exists).not.toHaveBeenCalled();
  });

  it('rejects inactive users and inactive or unlinked teams', async () => {
    await expect(service.authorizeTeam({ ...teamUser(), isActive: false })).rejects.toMatchObject({
      statusCode: 403,
    });

    jest.spyOn(TeamModel, 'exists').mockResolvedValue(null);
    await expect(service.authorizeTeam(teamUser())).rejects.toMatchObject({ statusCode: 403 });
  });

  it('builds mandatory eligibility, owner activity, relevance, stable sorting, and safe projection', () => {
    const options = parseTalentSearchQuery({
      keyword: 'football operations',
      filterOptions: 'experienceLevel;mid',
      includeOptions: 'openToRemote;true|openToRelocation;true',
      pageNumber: '2',
      limit: '10',
    });
    const pipeline = service.buildPipeline(options) as any[];

    expect(pipeline[0]).toEqual({
      $match: {
        $and: [
          { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
          { visibility: { $in: ['public', 'teams_only'] } },
          { jobSearchStatus: { $in: ['open', 'casual'] } },
          { experienceLevel: 'mid' },
          { $or: [{ openToRemote: true }, { openToRelocation: true }] },
        ],
      },
    });
    expect(pipeline[1].$lookup.pipeline[0].$match.$expr).toEqual({
      $and: [{ $eq: ['$_id', '$$ownerId'] }, { $eq: ['$isActive', true] }],
    });
    expect(pipeline).toContainEqual({
      $sort: { _searchScore: -1, updatedAt: -1, _id: 1 },
    });

    const facet = pipeline.find((stage) => stage.$facet).$facet;
    expect(facet.entries[0]).toEqual({ $skip: 10 });
    expect(facet.entries[1]).toEqual({ $limit: 10 });
    expect(facet.entries[2].$project).toMatchObject({
      userId: '$user',
      profileType: { $literal: 'professional' },
      isActive: { $literal: true },
      desiredRoles: { $ifNull: ['$desiredRoles', []] },
      industries: { $ifNull: ['$industries', []] },
      avatarUrl: { $ifNull: ['$_owner.profileImageUrl', null] },
    });
    expect(facet.entries[2].$project).not.toHaveProperty('socialLinks');
    expect(facet.entries[2].$project).not.toHaveProperty('_owner');
    expect(facet.entries[2].$project).not.toHaveProperty('_searchScore');
  });

  it('returns stable recency ordering and accurate empty/out-of-range metadata', async () => {
    const aggregate = jest
      .spyOn(ProfessionalProfileModel, 'aggregate')
      .mockResolvedValue([{ entries: [], metadata: [{ totalCount: 21 }] }] as any);
    const options = parseTalentSearchQuery({ pageNumber: '3', limit: '10' });

    await expect(service.search(options)).resolves.toEqual({
      payload: [],
      metadata: {
        page: 3,
        pages: 3,
        totalCount: 21,
        prevPage: 2,
        nextPage: null,
      },
    });

    const pipeline = aggregate.mock.calls[0][0] as any[];
    expect(pipeline).toContainEqual({ $sort: { updatedAt: -1, _id: 1 } });
  });
});

describe('professional talent search rate limiting and legacy list authorization', () => {
  const request = (
    port: number,
    userId: string
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/search',
          method: 'GET',
          headers: { 'x-test-user': userId },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: raw ? JSON.parse(raw) : null,
            });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });

  it('returns standard headers and a JSON 429 on the sixty-first request per user', async () => {
    const app = express();
    app.get(
      '/search',
      (req, _res, next) => {
        (req as any).user = { _id: req.headers['x-test-user'] };
        next();
      },
      createTalentSearchRateLimiter(),
      (_req, res) => res.status(200).json({ success: true })
    );

    const server = await new Promise<http.Server>((resolve) => {
      const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port');

      let response;
      for (let index = 0; index < TALENT_SEARCH_RATE_LIMIT; index += 1) {
        response = await request(address.port, 'team-user-1');
      }

      expect(response?.status).toBe(200);
      expect(response?.headers.ratelimit).toBeDefined();

      const blocked = await request(address.port, 'team-user-1');
      expect(blocked.status).toBe(429);
      expect(blocked.headers['retry-after']).toBeDefined();
      expect(blocked.body).toEqual({
        success: false,
        message: 'Too many talent search requests. Please try again later.',
      });

      await expect(request(address.port, 'team-user-2')).resolves.toMatchObject({ status: 200 });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it('allows api.read callers and rejects ordinary authenticated callers on the legacy list guard', () => {
    const guard = AuthMiddleware.authorizeRoles(['api.read']);
    const next = jest.fn();
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    guard({ user: { permissions: [] } } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    guard({ user: { permissions: ['api.read'] } } as any, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
