import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Portfolio, PortfolioItem, PortfolioAsset, Submission, SubmittedItem, Review, ItemFeedback, ScoutAudit } from '../models/Portfolio';
import ScoutReport from '../models/ScoutReport';
import { PortfolioAssetService } from '../services/PortfolioAsset.service';

async function main() {
  dotenv.config();
  if (!process.env.SCOUT_MAINTENANCE_URI) throw new Error('Set SCOUT_MAINTENANCE_URI to the intended database');
  const command = process.argv[2];
  if (!['indexes', 'cleanup'].includes(command)) throw new Error('Specify indexes or cleanup');
  await mongoose.connect(process.env.SCOUT_MAINTENANCE_URI, { autoCreate: false, autoIndex: false });
  try {
    if (command === 'indexes') {
      // createIndexes is additive; never syncIndexes/drop existing indexes during rollout.
      for (const model of [Portfolio, PortfolioItem, PortfolioAsset, Submission, SubmittedItem, Review, ItemFeedback, ScoutAudit, ScoutReport]) await model.createIndexes();
      console.log('Portfolio indexes created.');
    } else {
      const result = await new PortfolioAssetService().cleanup(undefined, 1000);
      console.log(JSON.stringify(result));
      if (result.failed) process.exitCode = 1;
    }
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) void main().catch(() => { console.error('Portfolio maintenance failed; verify database/storage configuration.'); process.exitCode = 1; });
