#!/usr/bin/env ts-node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { AthleteModel } from '../../athlete/models/AthleteModel';
import { MONGO_URI } from '../../../config/mongouri';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting Search Preferences Scheduler Tests...\n');

  try {
    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    const mongoUri = MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // we want to query the AthleteModel for a specific search query and see what data we get back
    console.log('🔍 Running test query on AthleteModel...');
    const results = await AthleteModel.aggregate([
      {
        $match: {
          $and: [
            {
              'positions.abbreviation': {
                $in: ['QB'],
              },
            },
            {
              birthdate: {
                $lte: new Date('2007-07-08T19:34:52.282Z'),
                $gte: new Date('1994-07-08T19:34:52.282Z'),
              },
            },
            {
              $or: [
                {
                  'metrics.dash40': {
                    $gte: 4.5,
                    $lte: 5.5,
                  },
                },
                {
                  'metrics.benchPress': {
                    $gte: 18,
                    $lte: 24,
                  },
                },
                {
                  'metrics.verticalJump': {
                    $gte: 30,
                    $lte: 36,
                  },
                },
                {
                  'metrics.broadJump': {
                    $gte: 98,
                    $lte: 112,
                  },
                },
                {
                  'metrics.threeCone': {
                    $gte: 6.2,
                    $lte: 7,
                  },
                },
                {
                  'metrics.shuttle': {
                    $gte: 4,
                    $lte: 4.5,
                  },
                },
              ],
            },
          ],
        },
      },
    ]);

    console.log(`✅ Found ${results.length} athletes matching search criteria:\n`);
    results.forEach((athlete: any) => {
      console.log(`- ${athlete.fullName} (ID: ${athlete._id})`);
    });

    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('📦 MongoDB connection closed');
    process.exit(0);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}
