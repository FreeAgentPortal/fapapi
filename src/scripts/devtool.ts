import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ModelKey, ModelMap } from '../utils/ModelMap';

// Add other models as needed

dotenv.config();

/**
 * Development Tool Script
 * Use this script for database maintenance, testing, and debugging
 *
 * Usage: npm run devtool
 *
 * Add your custom logic in the main() function below
 */

class DevTool {
  private isConnected = false;
  private modelMap: Record<ModelKey, mongoose.Model<any>> = ModelMap;
  /**
   * Connect to MongoDB database
   */
  async connect(): Promise<void> {
    try {
      if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI environment variable is not set');
      }

      await mongoose.connect(process.env.MONGO_URI);
      this.isConnected = true;
      console.log('🔗 Connected to MongoDB');
      console.log(`📊 Database: ${mongoose.connection.name}`);
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB database
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<void> {
    console.log('\n📈 Database Statistics:');
    console.log('------------------------');

    try {
      const athleteCount = await this.modelMap['athlete'].countDocuments();
      const adminCount = await this.modelMap['admin'].countDocuments();
      const scoutReportCount = await this.modelMap['scout_report'].countDocuments();

      console.log(`Athletes: ${athleteCount}`);
      console.log(`Admins: ${adminCount}`);
      console.log(`Scout Reports: ${scoutReportCount}`);

      // Add more stats as needed
      console.log('------------------------\n');
    } catch (error) {
      console.error('❌ Error getting stats:', error);
    }
  }

  /**
   * ===================================
   * ADD YOUR CUSTOM LOGIC BELOW
   * ===================================
   */
  async customTask(): Promise<void> {
    console.log('🛠️  Running custom task...');

    const reports = await this.modelMap['scout_report'].find({}).populate({
      path: 'athleteId',
      select: 'fullName',
    });

    console.log(`Found ${reports.length} scout reports to process...`);

    let successCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      console.log(`\nProcessing report ${i + 1}/${reports.length}:`, r._id);
      console.log(`   🔍 Scout User ID: ${r.scoutId}`);

      try {
        let athleteName = 'Unknown Athlete';
        let scoutName = 'Unknown Scout';
        let shouldUpdate = false;

        // Get athlete name if available
        if (r.athleteId && r.athleteId.fullName) {
          athleteName = r.athleteId.fullName;
          console.log(`   📋 Athlete: ${athleteName}`);
        } else {
          console.log('   ⚠️  Athlete not found or missing fullName');
        }

        // Get scout name if available
        if (r.scoutId) {
          console.log(`   🔍 Scout User ID: ${r.scoutId}`);

          // Find the scout admin profile
          const scout = await this.modelMap['scout_profile'].findOne({ _id: r.scoutId }).populate({
            path: 'user',
            select: 'fullName',
          }); 
          if (scout && scout.user && scout.user.fullName) {
            scoutName = scout.user.fullName;
            console.log(`   👤 Scout: ${scoutName}`);
          } else {
            console.log('   ⚠️  Scout admin profile or user not found');
          }
        } else {
          console.log('   ⚠️  Scout not found or missing user reference');
        }

        // Update the report with denormalized data (even if some data is missing)
        r.scout = { name: scoutName };
        r.athlete = { name: athleteName };

        await r.save();
        successCount++;
        console.log(`   ✅ Updated report: Scout="${scoutName}", Athlete="${athleteName}"`);
      } catch (error) {
        skippedCount++;
        console.error(`   ❌ Error processing report ${r._id}:`, error instanceof Error ? error.message : error);
        continue; // Continue with next report
      }
    }

    console.log(`\n📊 Results Summary:`);
    console.log(`   ✅ Successfully updated: ${successCount} reports`);
    console.log(`   ❌ Skipped due to errors: ${skippedCount} reports`);
    console.log('\n✅ Custom task completed');
  }

  /**
   * Main execution function
   * Customize this to run whatever tasks you need
   */
  async main(): Promise<void> {
    console.log('🚀 DevTool Starting...\n');

    try {
      // Connect to database
      await this.connect();

      // Get basic stats
      await this.getStats();

      // Run custom task
      await this.customTask();
    } catch (error) {
      console.error('❌ DevTool error:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
      console.log('🏁 DevTool completed');
    }
  }
}

// Execute the devtool
const devTool = new DevTool();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  await devTool.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
  await devTool.disconnect();
  process.exit(0);
});

// Run the tool
devTool.main().catch(console.error);
