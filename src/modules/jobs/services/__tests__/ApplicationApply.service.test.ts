import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCreate: any = jest.fn();
const mockHasAppliedToJob: any = jest.fn();
const mockFetchJob: any = jest.fn();
const mockEnsureProfessionalProfile: any = jest.fn();
const mockFindResumeId: any = jest.fn();
const mockBuildApplicationMatch: any = jest.fn();
const mockGetProfessionalProfileId: any = jest.fn();
const mockPublish: any = jest.fn();

jest.mock('../../handlers/Applications.handler', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    create: mockCreate,
    fetchAll: jest.fn(),
    updateStatus: jest.fn(),
    withdraw: jest.fn(),
    hasAppliedToJob: mockHasAppliedToJob,
  })),
}));

jest.mock('../../handlers/JobPostHandler', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    fetch: mockFetchJob,
  })),
}));

jest.mock('../../handlers/ApplicationProfile.handler', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    ensureProfessionalProfile: mockEnsureProfessionalProfile,
    findResumeId: mockFindResumeId,
    buildApplicationMatch: mockBuildApplicationMatch,
    getProfessionalProfileId: mockGetProfessionalProfileId,
  })),
}));

jest.mock('../../../../lib/eventBus', () => ({
  eventBus: {
    publish: mockPublish,
  },
}));

import ApplicationService from '../Application.service';

describe('ApplicationService applyToJob duplicate prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureProfessionalProfile.mockResolvedValue('professional-1');
    mockFetchJob.mockResolvedValue({
      _id: 'job-1',
      status: 'published',
      team: 'team-1',
    });
    mockFindResumeId.mockResolvedValue(null);
    mockBuildApplicationMatch.mockResolvedValue({ score: 80, reasons: ['Strong fit'] });
  });

  it('returns a conflict response when the applicant already applied to the job', async () => {
    mockHasAppliedToJob.mockResolvedValue(true);

    const service = new ApplicationService();
    const req = {
      params: { jobId: 'job-1' },
      user: { _id: 'user-1', profileRefs: {} },
      body: {},
    } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;
    const next = jest.fn();

    service.applyToJob(req, res, next);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockHasAppliedToJob).toHaveBeenCalledWith('job-1', 'professional-1');
    expect(mockBuildApplicationMatch).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'User has already applied to this job',
    });
  });
});
