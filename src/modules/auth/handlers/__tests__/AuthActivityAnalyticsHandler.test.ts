import { AuthActivityAnalyticsHandler } from '../AuthActivityAnalyticsHandler';
import AuthActivityLog from '../../model/AuthActivityLog';

jest.mock('../../model/AuthActivityLog', () => ({
  __esModule: true,
  default: {
    aggregate: jest.fn(),
  },
}));

const mockedAggregate = AuthActivityLog.aggregate as jest.Mock;

describe('AuthActivityAnalyticsHandler', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-26T12:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns summary metrics grouped for admin dashboards', async () => {
    mockedAggregate
      .mockResolvedValueOnce([
        {
          activeUsers: 3,
          activeSessions: 4,
          totalActivityBuckets: 5,
          approximateRequestCount: 6,
        },
      ])
      .mockResolvedValueOnce([{ date: '2026-05-26', activeUsers: 3 }])
      .mockResolvedValueOnce([{ role: 'athlete', activeUsers: 2 }]);

    const result = await new AuthActivityAnalyticsHandler().getSummary(7);

    expect(result).toEqual(
      expect.objectContaining({
        activeUsers: 3,
        activeSessions: 4,
        totalActivityBuckets: 5,
        approximateRequestCount: 6,
        dailyActiveUsers: [{ date: '2026-05-26', activeUsers: 3 }],
        activeUsersByRole: [{ role: 'athlete', activeUsers: 2 }],
      })
    );
    expect(result.range.days).toBe(7);
    expect(mockedAggregate).toHaveBeenCalledTimes(3);
  });

  it('applies recent activity days and limit to the aggregation', async () => {
    mockedAggregate.mockResolvedValueOnce([
      {
        userId: 'user-id',
        lastSeenAt: new Date('2026-05-26T11:00:00.000Z'),
      },
    ]);

    const result = await new AuthActivityAnalyticsHandler().getRecent(30, 5);
    const pipeline = mockedAggregate.mock.calls[0][0];

    expect(result).toHaveLength(1);
    expect(pipeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $limit: 5,
        }),
      ])
    );
    expect(pipeline[0].$match.lastSeenAt.$gte).toEqual(new Date('2026-04-26T12:00:00.000Z'));
  });
});
