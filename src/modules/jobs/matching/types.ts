import { IAward, IExperience, IQA } from '../../profiles/resume/models/ResumeProfile';
import { IProfessionalProfile } from '../../profiles/professional/model/ProfessionalProfile';
import { IJobPost } from '../models/JobPost';

export type JobPost = Pick<
  IJobPost,
  'title' | 'department' | 'locationType' | 'location' | 'description' | 'requirements' | 'preferredQualifications' | 'experienceLevel' | 'industries'
>;

export type ProfessionalProfile = Pick<
  IProfessionalProfile,
  | '_id'
  | 'displayName'
  | 'headline'
  | 'bio'
  | 'location'
  | 'desiredRoles'
  | 'industries'
  | 'experienceLevel'
  | 'openToRelocation'
  | 'openToRemote'
  | 'jobSearchStatus'
  | 'visibility'
>;

export type ResumeExperience = Pick<IExperience, 'orgName' | 'position' | 'location' | 'achievements'>;
export type ResumeAward = Pick<IAward, 'title' | 'org' | 'description'>;
export type ResumeQA = Pick<IQA, 'promptId' | 'question' | 'answer'>;

export type ResumeProfile = {
  experiences: ResumeExperience[];
  awards: ResumeAward[];
  qa: ResumeQA[];
};

export type MatchInput = {
  job: JobPost;
  professional: ProfessionalProfile;
  resume?: ResumeProfile | null;
  coverLetter?: string | null;
};

export type MatchResult = {
  score: number;
  reasons: string[];
};
