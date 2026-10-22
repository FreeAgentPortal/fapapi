import 'dotenv/config';
import mongoose from 'mongoose';
import { MonthlyRevenueForecastService } from '../services/MonthlyRevenueForecastService';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--dry-run', '--apply'].includes(args[0])) {
    throw new Error('Usage: npx ts-node src/modules/payment/scripts/initializeRevenueForecasts.ts --dry-run|--apply');
  }
  const dryRun = args[0] === '--dry-run';
  const { MONGO_USER, MONGO_PASS, CLUSTER_STRING, MONGO_DBNAME } = process.env;
  if (!MONGO_USER || !MONGO_PASS || !CLUSTER_STRING || !MONGO_DBNAME) {
    throw new Error('Database configuration is required; use the same environment as the API.');
  }
  const uri = `mongodb+srv://${MONGO_USER}:${MONGO_PASS}@${CLUSTER_STRING}/?retryWrites=true&w=majority`;
  try {
    await mongoose.connect(uri, { dbName: MONGO_DBNAME, autoCreate: !dryRun, autoIndex: !dryRun });
    console.info(JSON.stringify(await MonthlyRevenueForecastService.initialize(new Date(), dryRun), null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch(() => {
  // Connection errors can contain credentials; do not print the connection URI.
  console.error('Forecast initialization failed. Check the command arguments, database configuration, and connectivity.');
  process.exitCode = 1;
});
