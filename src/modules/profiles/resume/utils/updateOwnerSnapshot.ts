// services/resume/updateOwnerSnapshot.ts
import { deriveSummary } from './derive';
import { ModelMap } from '../../../../utils/ModelMap';
import { Types } from 'mongoose';
import { IResumeProfile } from '../models/ResumeProfile';

type Updater = (id: Types.ObjectId, summary: ReturnType<typeof deriveSummary>) => Promise<void>;

const updaters: Record<string, Updater> = {
  AthleteProfile: async (id, summary) => {
    await ModelMap['athlete'].findByIdAndUpdate(id, { resumeSummary: summary });
  },
  User: async () => {
    /* no-op by default */
  },
};

export const refreshOwnerSnapshot = async (resumeId: Types.ObjectId) => {
  const resume = await ModelMap['resume'].findById(resumeId).lean() as IResumeProfile | null;
  if (!resume) return;
  const summary = deriveSummary({ updatedAt: resume.updatedAt, experiences: resume.experiences });
  const fn = updaters[resume.owner.kind];
  if (fn) await fn(resume.owner.ref, summary);
};
