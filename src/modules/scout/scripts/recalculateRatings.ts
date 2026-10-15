import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ScoutReport from '../models/ScoutReport';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { aggregateRating } from '../utils/rating';
import { transaction } from '../utils/transaction';

/** Explicit URI prevents accidentally selecting the application's production database. */
async function main() {
  dotenv.config();
  if (!process.env.SCOUT_MAINTENANCE_URI) throw new Error('Set SCOUT_MAINTENANCE_URI to the intended database');
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.SCOUT_MAINTENANCE_URI, { autoIndex: false, autoCreate: false });
  let changed = 0;
  try {
    const cursor = ScoutReport.aggregate<{ _id: mongoose.Types.ObjectId }>([{ $group: { _id: '$athleteId' } }]).cursor();
    for await (const entry of cursor) {
      const result = await transaction(async session => {
        const athlete = apply
          ? await AthleteModel.findOneAndUpdate({ _id: entry._id }, { $inc: { __v: 1 } }, { session, new: true })
          : await AthleteModel.findById(entry._id).session(session);
        if (!athlete) return null;
        const reports = await ScoutReport.find({ athleteId: entry._id, status: 'approved', isFinalized: true }).session(session).lean();
        const next = aggregateRating(reports), previous = athlete.diamondRating;
        if (next === previous) return null;
        if (apply) { athlete.diamondRating = next; await athlete.save({ session }); }
        return { athleteId: entry._id, previous: previous ?? null, next: next ?? null };
      });
      if (result) { changed++; console.log(JSON.stringify(result)); }
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', changed }));
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) void main().catch(() => { console.error('Rating recalculation failed; verify the database URI and replica-set availability.'); process.exitCode = 1; });
