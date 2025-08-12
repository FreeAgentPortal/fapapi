import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ModelMap } from '../utils/ModelMap';

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
  private modelMap: Record<string, mongoose.Model<any>> = ModelMap;
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

    const teams = await this.modelMap['team'].find({});
    // for every team currently in the database we want to set their logoUrl field to the first logo in the logos array
    for (const team of teams) {
      if (team.logos && team.logos.length > 0) {
        team.logoUrl = team.logos[0].href;
        await team.save();
        console.log(`Updated team ${team._id} logoUrl to ${team.logoUrl}`);
      }
    }

    console.log('✅ Custom task completed');
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
