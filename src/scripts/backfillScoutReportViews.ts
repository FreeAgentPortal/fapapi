/**
 * Backfill report-derived scout engagement, not randomly generated traffic.
 * Preview: npx ts-node src/scripts/backfillScoutReportViews.ts --dry-run
 * Write:   npx ts-node src/scripts/backfillScoutReportViews.ts --apply
 *
 * A report establishes scout activity, but does not establish a browser session.
 * Conservatively count at most one view per scout/athlete/UTC day, using the
 * earliest report's original creation time. Skip days with an existing view.
 * No notification events are emitted. Run while historical imports are paused.
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ScoutReport from '../modules/scout/models/ScoutReport';
import { ScoutModel } from '../modules/profiles/scout/model/ScoutProfile';
import { ProfileViewModel } from '../modules/profiles/analytics/model/ProfileViewModel';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function backfillScoutReportViews(apply = false, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid reference date');
  const cutoff = new Date(now.getTime() - 90 * DAY_MS);
  const stats = { scanned: 0, eligible: 0, inserted: 0, duplicate: 0, skipped: 0 };
  const seen = new Set<string>();
  // Native collections avoid implicit index/collection creation during previews.
  const reports = mongoose.connection.collection(ScoutReport.collection.name);
  const scouts = mongoose.connection.collection(ScoutModel.collection.name);
  const views = mongoose.connection.collection(ProfileViewModel.collection.name);
  const athletes = mongoose.connection.collection('athleteprofiles');
  const users = mongoose.connection.collection('users');
  const cursor = reports.find({ createdAt: { $gte: cutoff, $lte: now } }).sort({ createdAt: 1, _id: 1 });

  try {
    for await (const report of cursor) {
      stats.scanned += 1;
      if (
        !(report.createdAt instanceof Date) || !Number.isFinite(report.createdAt.getTime()) ||
        !mongoose.isObjectIdOrHexString(report.athleteId) ||
        !mongoose.isObjectIdOrHexString(report.scoutId)
      ) {
        stats.skipped += 1;
        continue;
      }
      const athleteId = new mongoose.Types.ObjectId(String(report.athleteId));
      const scoutId = new mongoose.Types.ObjectId(String(report.scoutId));
      const day = report.createdAt.toISOString().slice(0, 10);
      const key = `scout-report-view:v1:${scoutId}:${athleteId}:${day}`;
      if (seen.has(key)) {
        stats.duplicate += 1;
        continue;
      }
      seen.add(key);

      const [scout, athlete] = await Promise.all([
        scouts.findOne({ _id: scoutId }, { projection: { user: 1 } }),
        athletes.findOne({ _id: athleteId }, { projection: { userId: 1 } }),
      ]);
      if (!athlete || !mongoose.isObjectIdOrHexString(scout?.user)) {
        stats.skipped += 1;
        continue;
      }
      const viewerUserId = new mongoose.Types.ObjectId(String(scout!.user));
      if (
        String(athlete.userId) === String(viewerUserId) ||
        !(await users.findOne({ _id: viewerUserId }, { projection: { _id: 1 } }))
      ) {
        stats.skipped += 1;
        continue;
      }

      const start = new Date(`${day}T00:00:00.000Z`);
      const sessionHash = crypto.createHash('sha256').update(key).digest('hex');
      // Stable IDs also prevent duplicates between concurrent script runs,
      // without requiring an index migration or altering existing records.
      const viewId = new mongoose.Types.ObjectId(sessionHash.slice(0, 24));
      const existing = await views.findOne({
        $or: [
          { _id: viewId },
          {
            subjectType: 'athlete', subjectProfileId: athleteId,
            viewerType: 'scout', viewerProfileId: scoutId,
            createdAt: { $gte: start, $lt: new Date(start.getTime() + DAY_MS) },
          },
        ],
      }, { projection: { _id: 1 } });
      if (existing) {
        stats.duplicate += 1;
        continue;
      }
      stats.eligible += 1;
      if (!apply) continue;

      const view = new ProfileViewModel({
        _id: viewId,
        subjectType: 'athlete', subjectProfileId: athleteId,
        viewerUserId, viewerProfileId: scoutId, viewerType: 'scout',
        sessionHash, sessionSource: 'legacy',
        createdAt: report.createdAt, updatedAt: report.createdAt,
      });
      await view.validate();
      try {
        // Bypass timestamp middleware to preserve the original 90-day expiry.
        await views.insertOne(view.toObject());
        stats.inserted += 1;
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        stats.eligible -= 1;
        stats.duplicate += 1;
      }
    }
  } finally {
    await cursor.close();
  }
  return { mode: apply ? 'apply' : 'dry-run', cutoff, through: now, ...stats };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.info('Usage: npx ts-node src/scripts/backfillScoutReportViews.ts [--dry-run | --apply]');
    return;
  }
  if (args.some(arg => !['--dry-run', '--apply'].includes(arg)) ||
      (args.includes('--dry-run') && args.includes('--apply'))) {
    throw new Error('Choose --dry-run (default) or --apply');
  }
  dotenv.config();
  const { MONGO_URI, MONGO_USER, MONGO_PASS, CLUSTER_STRING, MONGO_DBNAME } = process.env;
  if (!MONGO_URI && (!MONGO_USER || !MONGO_PASS || !CLUSTER_STRING)) {
    throw new Error('Set MONGO_URI or MONGO_USER, MONGO_PASS, and CLUSTER_STRING');
  }
  const uri = MONGO_URI || `mongodb+srv://${encodeURIComponent(MONGO_USER!)}:${encodeURIComponent(MONGO_PASS!)}@${CLUSTER_STRING}/?retryWrites=true&w=majority`;
  try {
    await mongoose.connect(uri, {
      ...(MONGO_DBNAME ? { dbName: MONGO_DBNAME } : {}),
      autoIndex: false, autoCreate: false,
    });
    console.info(JSON.stringify(await backfillScoutReportViews(args.includes('--apply')), null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(() => {
    // Connection errors may contain credentials; do not print the URI or error.
    console.error('Scout report backfill failed. Check arguments and database configuration. A partial apply can be safely rerun.');
    process.exitCode = 1;
  });
}
