import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import User from '../../auth/model/User';
import { ProfessionalProfileModel } from '../../profiles/professional/model/ProfessionalProfile';
import { ResumeProfile } from '../../profiles/resume/models/ResumeProfile';
import { ProfessionalProfileCreator } from '../../../service/profile/ProfessionalProfileCreator';
import scoreProfessionalForJob from '../matching/scoreProfessionalForJob';
import { MatchInput, MatchResult } from '../matching/types';

export default class ApplicationProfileHandler {
  constructor(private readonly professionalProfileCreator: ProfessionalProfileCreator = new ProfessionalProfileCreator()) {}

  getProfessionalProfileId(user: AuthenticatedRequest['user'] | null | undefined): string | null {
    return user?.profileRefs?.professionalProfile || user?.profileRefs?.professional || null;
  }

  async ensureProfessionalProfile(user: AuthenticatedRequest['user'] | null | undefined): Promise<string | null> {
    if (!user?._id) {
      return null;
    }

    const existingProfileId = this.getProfessionalProfileId(user);
    const userId = String(user._id);

    if (existingProfileId) {
      if (!user.profileRefs?.professional || !user.profileRefs?.professionalProfile) {
        await this.persistProfessionalProfileRefs(userId, existingProfileId, user);
      }

      return existingProfileId;
    }

    const existingProfile = await ProfessionalProfileModel.findOne({ user: userId }).select('_id').lean();
    let profileId = existingProfile?._id ? String(existingProfile._id) : null;

    if (!profileId) {
      try {
        const createdProfile = await this.professionalProfileCreator.createProfile(userId, this.buildFallbackProfessionalProfileData(user));
        profileId = createdProfile.profileId;
      } catch (err: any) {
        if (err?.code !== 11000) {
          throw err;
        }

        const duplicateProfile = await ProfessionalProfileModel.findOne({ user: userId }).select('_id').lean();
        profileId = duplicateProfile?._id ? String(duplicateProfile._id) : null;
      }
    }

    if (!profileId) {
      return null;
    }

    await this.persistProfessionalProfileRefs(userId, profileId, user);
    return profileId;
  }

  async findResumeId(professionalProfileId: string): Promise<string | null> {
    const resume = await ResumeProfile.findOne(await this.buildResumeOwnerQuery(professionalProfileId))
      .select('_id')
      .lean();

    return resume?._id ? String(resume._id) : null;
  }

  async buildApplicationMatch(jobPost: MatchInput['job'], professionalProfileId: string): Promise<MatchResult | null> {
    const professional = await ProfessionalProfileModel.findById(professionalProfileId).lean();

    if (!professional) {
      return null;
    }

    const resume = await ResumeProfile.findOne(await this.buildResumeOwnerQuery(professionalProfileId, professional.user ? String(professional.user) : null)).lean();

    return scoreProfessionalForJob({
      job: jobPost,
      professional,
      resume: resume
        ? {
            experiences: resume.experiences || [],
            awards: resume.awards || [],
            qa: resume.qa || [],
          }
        : null,
    });
  }

  private buildFallbackProfessionalProfileData(user: AuthenticatedRequest['user'] | null | undefined): { displayName?: string } {
    const displayName = user?.fullName?.trim() || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    return displayName ? { displayName } : {};
  }

  private async buildResumeOwnerQuery(
    professionalProfileId: string,
    professionalUserId?: string | null
  ): Promise<{
    $or: Array<{
      'owner.kind': 'ProfessionalProfile' | 'AthleteProfile';
      'owner.ref': string;
    }>;
  }> {
    const resumeOwnerCandidates: Array<{
      'owner.kind': 'ProfessionalProfile' | 'AthleteProfile';
      'owner.ref': string;
    }> = [
      {
        'owner.kind': 'ProfessionalProfile',
        'owner.ref': professionalProfileId,
      },
    ];

    const athleteProfileId = await this.findAthleteProfileIdForProfessionalProfile(professionalProfileId, professionalUserId);

    if (athleteProfileId) {
      resumeOwnerCandidates.push({
        'owner.kind': 'AthleteProfile',
        'owner.ref': athleteProfileId,
      });
    }

    return { $or: resumeOwnerCandidates };
  }

  private async findAthleteProfileIdForProfessionalProfile(professionalProfileId: string, professionalUserId?: string | null): Promise<string | null> {
    const userId = professionalUserId || (await this.findProfessionalUserId(professionalProfileId));

    if (!userId) {
      return null;
    }

    const user = await User.findById(userId).select('profileRefs').lean();
    const athleteProfileId = user?.profileRefs?.athlete || user?.profileRefs?.athleteProfile;

    return athleteProfileId ? String(athleteProfileId) : null;
  }

  private async findProfessionalUserId(professionalProfileId: string): Promise<string | null> {
    const professional = await ProfessionalProfileModel.findById(professionalProfileId).select('user').lean();

    return professional?.user ? String(professional.user) : null;
  }

  private async persistProfessionalProfileRefs(userId: string, profileId: string, user: AuthenticatedRequest['user'] | null | undefined): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: {
        'profileRefs.professional': profileId,
        'profileRefs.professionalProfile': profileId,
      },
    });

    if (!user) {
      return;
    }

    user.profileRefs = {
      ...(user.profileRefs || {}),
      professional: profileId,
      professionalProfile: profileId,
    };
  }
}
