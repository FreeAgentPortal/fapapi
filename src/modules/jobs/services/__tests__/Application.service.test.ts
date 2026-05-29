import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockProfessionalFindOne: any = jest.fn();
const mockProfessionalFindById: any = jest.fn();
const mockResumeFindOne: any = jest.fn();
const mockCreateProfessionalProfile: any = jest.fn();
const mockUserFindById: any = jest.fn();
const mockUserFindByIdAndUpdate: any = jest.fn();

function buildLeanQuery(result: any) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockImplementation(async () => result),
    }),
    lean: jest.fn().mockImplementation(async () => result),
  };
}

jest.mock('../../../profiles/professional/model/ProfessionalProfile', () => ({
  ProfessionalProfileModel: {
    findOne: mockProfessionalFindOne,
    findById: mockProfessionalFindById,
  },
}));

jest.mock('../../../profiles/resume/models/ResumeProfile', () => ({
  ResumeProfile: {
    findOne: mockResumeFindOne,
  },
}));

jest.mock('../../../../service/profile/ProfessionalProfileCreator', () => ({
  ProfessionalProfileCreator: jest.fn().mockImplementation(() => ({
    createProfile: mockCreateProfessionalProfile,
  })),
}));

jest.mock('../../../auth/model/User', () => ({
  __esModule: true,
  default: {
    findById: mockUserFindById,
    findByIdAndUpdate: mockUserFindByIdAndUpdate,
  },
}));

import ApplicationProfileHandler from '../../handlers/ApplicationProfile.handler';

describe('ApplicationProfileHandler professional profile fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfessionalFindById.mockReturnValue(buildLeanQuery(null));
    mockResumeFindOne.mockReturnValue(buildLeanQuery(null));
    mockUserFindById.mockReturnValue(buildLeanQuery(null));
    mockUserFindByIdAndUpdate.mockResolvedValue({ _id: 'user-1' });
  });

  it('creates a minimal professional profile and patches profile refs when they are missing', async () => {
    mockProfessionalFindOne.mockReturnValue(buildLeanQuery(null));
    mockCreateProfessionalProfile.mockResolvedValue({ profileId: 'professional-profile-1' });

    const handler = new ApplicationProfileHandler();
    const user = {
      _id: 'user-1',
      firstName: 'Alex',
      lastName: 'Front',
      fullName: 'Alex Front',
      profileRefs: {},
    } as any;

    const profileId = await handler.ensureProfessionalProfile(user);

    expect(profileId).toBe('professional-profile-1');
    expect(mockCreateProfessionalProfile).toHaveBeenCalledWith('user-1', {
      displayName: 'Alex Front',
    });
    expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith('user-1', {
      $set: {
        'profileRefs.professional': 'professional-profile-1',
        'profileRefs.professionalProfile': 'professional-profile-1',
      },
    });
    expect(user.profileRefs).toEqual({
      professional: 'professional-profile-1',
      professionalProfile: 'professional-profile-1',
    });
  });

  it('reuses an existing professional profile row when refs are missing', async () => {
    mockProfessionalFindOne.mockReturnValue(buildLeanQuery({ _id: 'professional-profile-existing' }));

    const handler = new ApplicationProfileHandler();
    const user = {
      _id: 'user-1',
      fullName: 'Alex Front',
      profileRefs: {},
    } as any;

    const profileId = await handler.ensureProfessionalProfile(user);

    expect(profileId).toBe('professional-profile-existing');
    expect(mockCreateProfessionalProfile).not.toHaveBeenCalled();
    expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith('user-1', {
      $set: {
        'profileRefs.professional': 'professional-profile-existing',
        'profileRefs.professionalProfile': 'professional-profile-existing',
      },
    });
  });

  it('looks up resumes with both professional and athlete ownership when the user has an athlete profile', async () => {
    mockProfessionalFindById.mockReturnValue(buildLeanQuery({ _id: 'professional-profile-1', user: 'user-1' }));
    mockUserFindById.mockReturnValue(buildLeanQuery({ profileRefs: { athlete: 'athlete-profile-1' } }));
    mockResumeFindOne.mockReturnValue(buildLeanQuery({ _id: 'resume-1' }));

    const handler = new ApplicationProfileHandler();
    const resumeId = await handler.findResumeId('professional-profile-1');

    expect(resumeId).toBe('resume-1');
    expect(mockResumeFindOne).toHaveBeenCalledWith({
      $or: [
        {
          'owner.kind': 'ProfessionalProfile',
          'owner.ref': 'professional-profile-1',
        },
        {
          'owner.kind': 'AthleteProfile',
          'owner.ref': 'athlete-profile-1',
        },
      ],
    });
  });

  it('builds application matches from an athlete-owned resume when present', async () => {
    mockProfessionalFindById
      .mockReturnValueOnce(
        buildLeanQuery({
          _id: 'professional-profile-1',
          user: 'user-1',
          desiredRoles: [],
          industries: [],
          openToRelocation: false,
          openToRemote: false,
          jobSearchStatus: 'open',
          visibility: 'public',
        })
      )
      .mockReturnValueOnce(buildLeanQuery({ _id: 'professional-profile-1', user: 'user-1' }));
    mockUserFindById.mockReturnValue(buildLeanQuery({ profileRefs: { athlete: 'athlete-profile-1' } }));
    mockResumeFindOne.mockReturnValue(
      buildLeanQuery({
        experiences: [{ orgName: 'Example Club', position: 'Forward', achievements: [] }],
        awards: [],
        qa: [],
      })
    );

    const handler = new ApplicationProfileHandler();
    const result = await handler.buildApplicationMatch(
      {
        title: 'Forward',
        department: 'Sport',
        locationType: 'remote',
        location: { city: 'Austin', state: 'Texas', country: 'USA' },
        description: 'Role description',
        requirements: [],
        preferredQualifications: [],
        experienceLevel: 'entry',
        industries: [],
      },
      'professional-profile-1'
    );

    expect(result).not.toBeNull();
    expect(mockResumeFindOne).toHaveBeenCalledWith({
      $or: [
        {
          'owner.kind': 'ProfessionalProfile',
          'owner.ref': 'professional-profile-1',
        },
        {
          'owner.kind': 'AthleteProfile',
          'owner.ref': 'athlete-profile-1',
        },
      ],
    });
  });
});
