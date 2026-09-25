const mockInterestFindById = jest.fn();
const mockAthleteFindById = jest.fn();
const mockTeamFindById = jest.fn();
const mockUserFind = jest.fn();
const mockInsertNotification = jest.fn();
const mockSendEmail = jest.fn();

jest.mock('../../../interests/models/AthleteTeamInterest', () => ({
  AthleteTeamInterestModel: { findById: mockInterestFindById },
}));
jest.mock('../../../profiles/athlete/models/AthleteModel', () => ({
  AthleteModel: { findById: mockAthleteFindById },
}));
jest.mock('../../../profiles/team/model/TeamModel', () => ({
  __esModule: true,
  default: { findById: mockTeamFindById },
}));
jest.mock('../../../auth/model/User', () => ({
  __esModule: true,
  default: { find: mockUserFind },
}));
jest.mock('../../model/Notification', () => ({
  __esModule: true,
  default: { insertNotification: mockInsertNotification },
}));
jest.mock('../../email/EmailService', () => ({ EmailService: { sendEmail: mockSendEmail } }));

import InterestEventsHandler from '../InterestEvents.handler';

describe('InterestEventsHandler', () => {
  const event = {
    interestId: 'interest-1',
    athleteProfileId: 'athlete-1',
    teamProfileId: 'team-1',
    initiatedByUserId: 'athlete-user-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInterestFindById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'interest-1', note: '<b>Hello</b>' }) });
    mockAthleteFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'athlete-1',
        fullName: 'Alex Athlete',
        positions: [{ abbreviation: 'QB' }],
        college: 'State University',
      }),
    });
    mockTeamFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'team-1',
        name: 'Test Team',
        alertsEnabled: true,
        linkedUsers: [{ user: 'user-1' }, { user: 'user-2' }],
      }),
    });
    mockUserFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: 'user-1', email: 'one@example.com', isActive: true, notificationSettings: {} },
        { _id: 'user-2', email: 'two@example.com', isActive: true, notificationSettings: { accountNotificationEmail: false } },
      ]),
    });
    mockInsertNotification.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);
  });

  it('fans out in-app notifications and respects per-user email preferences', async () => {
    await new InterestEventsHandler().interestExpressed(event);

    expect(mockInsertNotification).toHaveBeenCalledTimes(2);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'one@example.com',
        text: expect.stringContaining('Alex Athlete'),
        html: expect.stringContaining('&lt;b&gt;Hello&lt;/b&gt;'),
      })
    );
  });

  it('does not deliver alerts when the team disables them', async () => {
    mockTeamFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ name: 'Test Team', alertsEnabled: false, linkedUsers: [{ user: 'user-1' }] }),
    });

    await new InterestEventsHandler().interestExpressed(event);

    expect(mockInsertNotification).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('does not reject the event when an email delivery fails', async () => {
    mockSendEmail.mockRejectedValue(new Error('sendgrid unavailable'));

    await expect(new InterestEventsHandler().interestExpressed(event)).resolves.toBeUndefined();
    expect(mockInsertNotification).toHaveBeenCalledTimes(2);
  });
});
