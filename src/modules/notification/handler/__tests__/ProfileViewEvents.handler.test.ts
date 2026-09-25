const mockInsertNotification = jest.fn();

jest.mock('../../model/Notification', () => ({
  __esModule: true,
  default: { insertNotification: mockInsertNotification },
}));

import ProfileViewEventsHandler from '../ProfileViewEvents.handler';

describe('ProfileViewEventsHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsertNotification.mockResolvedValue({});
  });

  it('creates a non-identifying notification for the subject owner', async () => {
    await new ProfileViewEventsHandler().profileViewRecorded({
      viewId: 'view-1',
      subjectType: 'professional',
      subjectProfileId: 'professional-1',
      subjectOwnerUserId: 'owner-1',
      viewerType: 'team',
      occurredAt: '2026-09-02T12:00:00.000Z',
    });

    expect(mockInsertNotification).toHaveBeenCalledWith(
      'owner-1',
      undefined,
      'Your profile is getting noticed.',
      'Someone viewed your profile.',
      'profile.view.recorded',
      'view-1'
    );
    expect(JSON.stringify(mockInsertNotification.mock.calls[0])).not.toContain('team');
  });

  it('swallows notification persistence failures', async () => {
    mockInsertNotification.mockRejectedValue(new Error('database unavailable'));

    await expect(
      new ProfileViewEventsHandler().profileViewRecorded({
        viewId: 'view-1',
        subjectType: 'athlete',
        subjectProfileId: 'athlete-1',
        subjectOwnerUserId: 'owner-1',
        viewerType: 'scout',
        occurredAt: '2026-09-02T12:00:00.000Z',
      })
    ).resolves.toBeUndefined();
  });
});
