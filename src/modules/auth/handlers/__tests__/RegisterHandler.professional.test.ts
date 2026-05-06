const mockJwtSign = jest.fn();
const mockUserModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findByIdAndDelete: jest.fn(),
};
const mockAdminModel = {
  find: jest.fn(),
};
const mockBillingCreate = jest.fn();
const mockBillingDelete = jest.fn();
const mockInsertNotification = jest.fn();
const mockCreateAthleteProfile = jest.fn();
const mockCreateTeamProfile = jest.fn();
const mockCreateAdminProfile = jest.fn();
const mockCreateProfessionalProfile = jest.fn();

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: { sign: mockJwtSign },
  sign: mockJwtSign,
}));

jest.mock('../../../../utils/ModelMap', () => ({
  ModelMap: {
    user: mockUserModel,
    admin: mockAdminModel,
  },
}));

jest.mock('../../model/BillingAccount', () => ({
  __esModule: true,
  default: {
    create: mockBillingCreate,
    findByIdAndDelete: mockBillingDelete,
  },
}));

jest.mock('../../../notification/model/Notification', () => ({
  __esModule: true,
  default: {
    insertNotification: mockInsertNotification,
  },
}));

jest.mock('../../../../service/profile/AthleteProfileCreator', () => ({
  AthleteProfileCreator: jest.fn().mockImplementation(() => ({
    createProfile: mockCreateAthleteProfile,
  })),
}));

jest.mock('../../../../service/profile/TeamProfileCreator', () => ({
  TeamProfileCreator: jest.fn().mockImplementation(() => ({
    createProfile: mockCreateTeamProfile,
  })),
}));

jest.mock('../../../../service/profile/AdminProfileCreator', () => ({
  AdminProfileCreator: jest.fn().mockImplementation(() => ({
    createProfile: mockCreateAdminProfile,
  })),
}));

jest.mock('../../../../service/profile/ProfessionalProfileCreator', () => ({
  ProfessionalProfileCreator: jest.fn().mockImplementation(() => ({
    createProfile: mockCreateProfessionalProfile,
  })),
}));

import { ProfileCreationFactory } from '../../factory/ProfileCreationFactory';
import { RegisterHandler } from '../RegisterHandler';

describe('RegisterHandler professional registration', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    jest.clearAllMocks();

    mockUserModel.findOne.mockResolvedValue(null);
    mockUserModel.create.mockImplementation(async (data: any) => ({
      _id: 'user-123456',
      email: data.email,
      role: data.role,
      profileRefs: {},
      save: jest.fn().mockResolvedValue(undefined),
    }));
    mockAdminModel.find.mockResolvedValue([]);
    mockCreateProfessionalProfile.mockResolvedValue({ profileId: 'professional-profile-id' });
    mockBillingCreate.mockResolvedValue({ _id: 'billing-id' });
    mockJwtSign.mockReturnValue('signed-token');
  });

  it('creates a professional profile ref, billing account, and JWT payload', async () => {
    const handler = new RegisterHandler();

    const result = await handler.execute({
      email: 'frontoffice@example.com',
      password: 'password1234',
      phoneNumber: '5555555555',
      firstName: 'Front',
      lastName: 'Office',
      roles: ['professional'],
      profileData: {
        professional: {
          displayName: 'Front Office',
          organization: 'Example Club',
          title: 'General Manager',
        },
      },
    });

    expect(mockUserModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'frontoffice@example.com',
        roles: ['professional'],
        role: ['professional'],
      })
    );
    expect(mockCreateProfessionalProfile).toHaveBeenCalledWith('user-123456', {
      displayName: 'Front Office',
      organization: 'Example Club',
      title: 'General Manager',
    });
    expect(result.profileRefs).toEqual({
      professional: 'professional-profile-id',
    });
    expect(mockBillingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'professional-profile-id',
        profileType: 'professional',
        email: 'frontoffice@example.com',
        status: 'active',
        vaulted: false,
        payor: 'user-123456',
      })
    );
    expect(mockJwtSign).toHaveBeenCalledWith(
      {
        userId: 'user-123456',
        roles: ['professional'],
        profileRefs: {
          professional: 'professional-profile-id',
        },
      },
      'test-secret',
      { expiresIn: '7d' }
    );
    expect(result.token).toBe('signed-token');
  });

  it('keeps professional, athlete, and team creator wiring available', () => {
    expect(ProfileCreationFactory.getProfileCreator('professional')).toEqual(
      expect.objectContaining({ createProfile: expect.any(Function) })
    );
    expect(ProfileCreationFactory.getProfileCreator('athlete')).toEqual(
      expect.objectContaining({ createProfile: expect.any(Function) })
    );
    expect(ProfileCreationFactory.getProfileCreator('team')).toEqual(
      expect.objectContaining({ createProfile: expect.any(Function) })
    );
  });
});
