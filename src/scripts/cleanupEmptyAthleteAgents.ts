/**
 * Remove empty manually entered agent objects from athlete profiles.
 * Preview: npx ts-node src/scripts/cleanupEmptyAthleteAgents.ts --dry-run
 * Write:   npx ts-node src/scripts/cleanupEmptyAthleteAgents.ts --apply
 *
 * Preserve platform links (agent.profile), ObjectId-valued agents, and any
 * nonblank contact information, even if it does not meet registration rules.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { AthleteModel } from '../modules/profiles/athlete/models/AthleteModel';

const emptyContactField = (field: string) => {
  const path = `$agent.${field}`;
  return {
    $cond: [
      { $eq: [{ $type: path }, 'string'] },
      { $regexMatch: { input: path, regex: /^\s*$/ } },
      { $in: [{ $type: path }, ['missing', 'null']] },
    ],
  };
};

export const emptyAthleteAgentFilter = {
  agent: { $exists: true },
  $expr: {
    $and: [
      // Expression $type checks the field itself, not objects inside arrays.
      { $eq: [{ $type: '$agent' }, 'object'] },
      // Preserve every non-null profile reference, including legacy string IDs.
      { $in: [{ $type: '$agent.profile' }, ['missing', 'null']] },
      ...['name', 'email', 'phone'].map(emptyContactField),
    ],
  },
};

export async function cleanupEmptyAthleteAgents(apply = false) {
  // Native access reads the stored values without schema defaults or casting.
  const athletes = mongoose.connection.collection(AthleteModel.collection.name);
  const stats = { matched: 0, removed: 0, skipped: 0 };
  const cursor = athletes.find(emptyAthleteAgentFilter, {
    projection: { _id: 1, fullName: 1 },
  });

  try {
    for await (const athlete of cursor) {
      stats.matched += 1;
      console.info(JSON.stringify({ athleteId: athlete._id, fullName: athlete.fullName }));
      if (!apply) continue;

      // Recheck eligibility atomically so contact details or links added after
      // the initial scan are preserved. Unset only agent; keep timestamps intact.
      const result = await athletes.updateOne(
        { ...emptyAthleteAgentFilter, _id: athlete._id },
        { $unset: { agent: '' } },
      );
      stats.removed += result.modifiedCount;
      if (result.modifiedCount === 0) stats.skipped += 1;
    }
  } finally {
    await cursor.close();
  }

  return { mode: apply ? 'apply' : 'dry-run', ...stats };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.info('Usage: npx ts-node src/scripts/cleanupEmptyAthleteAgents.ts [--dry-run | --apply]');
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
      autoIndex: false,
      autoCreate: false,
    });
    console.info(JSON.stringify(await cleanupEmptyAthleteAgents(args.includes('--apply')), null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(() => {
    // Connection errors can contain credentials; do not print the URI or error.
    console.error('Empty athlete agent cleanup failed. Check arguments and database configuration. A partial apply can be safely rerun.');
    process.exitCode = 1;
  });
}
