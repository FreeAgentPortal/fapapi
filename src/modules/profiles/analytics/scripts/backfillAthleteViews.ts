import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { ResumeProfile } from '../../resume/models/ResumeProfile';
import { ProfileViewModel } from '../model/ProfileViewModel';
import { ProfileViewSessionSource, ViewerProfileType } from '../types';

dotenv.config();

const RETENTION_DAYS = 90;
const SUPPORTED_LEGACY_VIEWERS = new Set<ViewerProfileType>([
  'team',
  'scout',
  'agent',
  'athlete',
  'professional',
  'admin',
]);

export interface LegacyAthleteView {
  _id: mongoose.Types.ObjectId;
  athleteId: mongoose.Types.ObjectId;
  viewerId: mongoose.Types.ObjectId;
  viewerProfileId: mongoose.Types.ObjectId;
  viewerType: string;
  sessionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BackfillProfileView {
  _id: mongoose.Types.ObjectId;
  subjectType: 'athlete';
  subjectProfileId: mongoose.Types.ObjectId;
  viewerUserId: mongoose.Types.ObjectId;
  viewerProfileId: mongoose.Types.ObjectId;
  viewerType: ViewerProfileType;
  sessionHash: string;
  sessionSource: ProfileViewSessionSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackfillStats {
  scanned: number;
  inserted: number;
  duplicate: number;
  expired: number;
  skipped: number;
}

export const hashLegacySession = (view: LegacyAthleteView): string => {
  const sessionKey = view.sessionId?.trim() || String(view._id);
  return crypto.createHash('sha256').update(`legacy:${sessionKey}`).digest('hex');
};

export const transformLegacyAthleteView = async (view: LegacyAthleteView): Promise<BackfillProfileView | null> => {
  if (
    !mongoose.isValidObjectId(view._id) ||
    !mongoose.isValidObjectId(view.athleteId) ||
    !mongoose.isValidObjectId(view.viewerId) ||
    !mongoose.isValidObjectId(view.viewerProfileId) ||
    !(view.createdAt instanceof Date) ||
    Number.isNaN(view.createdAt.getTime())
  ) {
    return null;
  }

  let viewerType: ViewerProfileType;
  let viewerProfileId = view.viewerProfileId;

  if (view.viewerType === 'resume') {
    const resume = (await ResumeProfile.findById(view.viewerProfileId).select('owner').lean()) as any;
    if (resume?.owner?.kind === 'AthleteProfile') {
      viewerType = 'athlete';
      viewerProfileId = resume.owner.ref;
    } else if (resume?.owner?.kind === 'ProfessionalProfile') {
      viewerType = 'professional';
      viewerProfileId = resume.owner.ref;
    } else {
      return null;
    }
  } else if (SUPPORTED_LEGACY_VIEWERS.has(view.viewerType as ViewerProfileType)) {
    viewerType = view.viewerType as ViewerProfileType;
  } else {
    return null;
  }

  if (!mongoose.isValidObjectId(viewerProfileId)) {
    return null;
  }

  return {
    _id: new mongoose.Types.ObjectId(String(view._id)),
    subjectType: 'athlete',
    subjectProfileId: new mongoose.Types.ObjectId(String(view.athleteId)),
    viewerUserId: new mongoose.Types.ObjectId(String(view.viewerId)),
    viewerProfileId: new mongoose.Types.ObjectId(String(viewerProfileId)),
    viewerType,
    sessionHash: hashLegacySession(view),
    sessionSource: 'legacy',
    createdAt: view.createdAt,
    updatedAt: view.updatedAt instanceof Date && !Number.isNaN(view.updatedAt.getTime()) ? view.updatedAt : view.createdAt,
  };
};

const buildDestinationLookup = (view: BackfillProfileView) => ({
  $or: [
    { _id: view._id },
    {
      subjectType: view.subjectType,
      subjectProfileId: view.subjectProfileId,
      viewerType: view.viewerType,
      viewerProfileId: view.viewerProfileId,
      sessionHash: view.sessionHash,
    },
  ],
});

export const backfillAthleteViews = async (apply: boolean, now = new Date()): Promise<BackfillStats> => {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);

  const stats: BackfillStats = { scanned: 0, inserted: 0, duplicate: 0, expired: 0, skipped: 0 };
  const legacyCollection = mongoose.connection.collection('athlete_views');
  const cursor = legacyCollection.find({});

  if (apply) {
    await ProfileViewModel.createIndexes();
  }

  for await (const rawView of cursor) {
    stats.scanned += 1;
    const view = rawView as unknown as LegacyAthleteView;

    if (!(view.createdAt instanceof Date) || Number.isNaN(view.createdAt.getTime())) {
      stats.skipped += 1;
      continue;
    }
    if (view.createdAt < cutoff) {
      stats.expired += 1;
      continue;
    }

    const transformed = await transformLegacyAthleteView(view);
    if (!transformed) {
      stats.skipped += 1;
      continue;
    }

    if (await ProfileViewModel.exists(buildDestinationLookup(transformed))) {
      stats.duplicate += 1;
      continue;
    }

    if (!apply) {
      stats.inserted += 1;
      continue;
    }

    try {
      await ProfileViewModel.collection.insertOne(transformed as any);
      stats.inserted += 1;
    } catch (err: any) {
      if (err?.code === 11000) {
        stats.duplicate += 1;
        continue;
      }
      throw err;
    }
  }

  return stats;
};

const getMongoUri = (): string => {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const { MONGO_USER, MONGO_PASS, CLUSTER_STRING } = process.env;
  if (!MONGO_USER || !MONGO_PASS || !CLUSTER_STRING) {
    throw new Error('MONGO_URI or MONGO_USER, MONGO_PASS, and CLUSTER_STRING are required');
  }
  return `mongodb+srv://${MONGO_USER}:${MONGO_PASS}@${CLUSTER_STRING}/?retryWrites=true&w=majority`;
};

const main = async (): Promise<void> => {
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run');
  if (apply && dryRun) {
    throw new Error('Choose either --dry-run or --apply, not both');
  }

  await mongoose.connect(getMongoUri(), process.env.MONGO_DBNAME ? { dbName: process.env.MONGO_DBNAME } : undefined);
  try {
    const stats = await backfillAthleteViews(apply);
    console.info(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...stats }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((err) => {
    console.error('[ProfileViewBackfill] Backfill failed:', err);
    process.exitCode = 1;
  });
}
