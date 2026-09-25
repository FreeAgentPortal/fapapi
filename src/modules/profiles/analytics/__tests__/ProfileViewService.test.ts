const mockRecordView = jest.fn();
const mockGetReport = jest.fn();
const mockPublish = jest.fn();

jest.mock('../../../../lib/eventBus', () => ({
  eventBus: { publish: mockPublish },
}));

import { ProfileViewService } from '../service/ProfileViewService';

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

const buildResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('ProfileViewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPublish.mockResolvedValue(undefined);
  });

  it('publishes exactly one generic event for a counted view', async () => {
    mockRecordView.mockResolvedValue({
      counted: true,
      viewId: 'view-1',
      recordedAt: '2026-09-02T12:00:00.000Z',
      subjectOwnerUserId: 'owner-1',
      viewerType: 'team',
    });
    const service = new ProfileViewService('athlete', {
      recordView: mockRecordView,
      getReport: mockGetReport,
    } as any);
    const res = buildResponse();

    service.trackView({ params: { id: 'athlete-1' } } as any, res as any, jest.fn());
    await flushPromises();

    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledWith('profile.view.recorded', {
      viewId: 'view-1',
      subjectType: 'athlete',
      subjectProfileId: 'athlete-1',
      subjectOwnerUserId: 'owner-1',
      viewerType: 'team',
      occurredAt: '2026-09-02T12:00:00.000Z',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('does not publish for a duplicate session', async () => {
    mockRecordView.mockResolvedValue({ counted: false, reason: 'duplicate_session' });
    const service = new ProfileViewService('professional', {
      recordView: mockRecordView,
      getReport: mockGetReport,
    } as any);
    const res = buildResponse();

    service.trackView({ params: { id: 'professional-1' } } as any, res as any, jest.fn());
    await flushPromises();

    expect(mockPublish).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('keeps the tracking response successful when event delivery rejects', async () => {
    mockRecordView.mockResolvedValue({
      counted: true,
      viewId: 'view-1',
      recordedAt: '2026-09-02T12:00:00.000Z',
      subjectOwnerUserId: 'owner-1',
      viewerType: 'team',
    });
    mockPublish.mockRejectedValue(new Error('notification unavailable'));
    const service = new ProfileViewService('athlete', {
      recordView: mockRecordView,
      getReport: mockGetReport,
    } as any);
    const res = buildResponse();

    service.trackView({ params: { id: 'athlete-1' } } as any, res as any, jest.fn());
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it.each(['0', '91', '1.5', 'not-a-number'])('rejects invalid report days: %s', async (days) => {
    const service = new ProfileViewService('athlete', {
      recordView: mockRecordView,
      getReport: mockGetReport,
    } as any);
    const res = buildResponse();

    service.getReport(
      { params: { id: 'athlete-1' }, query: { days }, user: { _id: 'owner-1' } } as any,
      res as any,
      jest.fn()
    );
    await flushPromises();

    expect(mockGetReport).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
