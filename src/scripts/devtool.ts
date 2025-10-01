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

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      // 1. Count conversations started by teams in the last 30 days
      const conversationsStarted = await this.modelMap['conversation'].countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });
      console.log(`- Conversations started by teams in last 30 days: ${conversationsStarted}`);
      const messagesSent = await this.modelMap['message'].countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });
      console.log(`- Messages sent in last 30 days: ${messagesSent}`);
      // 2. Count recent athlete profiles created in the last 30 days
      const recentAthleteProfiles = await this.modelMap['athlete'].countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });
      console.log(`- Recent athlete profiles created in last 30 days: ${recentAthleteProfiles}`);

      // 3. Total projected revenue from active subscriptions
      const activeSubscriptions = await this.modelMap['billing']
        .find({
          status: 'active',
          plan: { $ne: null },
        })
        .populate('plan');
      const totalProjectedRevenue = activeSubscriptions.reduce((acc, sub) => {
        return acc + sub.plan.price;
      }, 0);
      console.log(`- Total projected revenue from active subscriptions: $${totalProjectedRevenue}`);
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
    try {
      const billingIds = [
        '68c95faa524f90e9db9ac148',
        '68c97238524f90e9db9ac2f2',
        '68c98891524f90e9db9ac72e',
        '68c98a74524f90e9db9ac796',
        '68c99562524f90e9db9ac8ee',
        '68c99564524f90e9db9ac8f9',
        '68c99726524f90e9db9ac983',
        '68c9aba0c4f0c9e9de3d6242',
        '68c9abf7c4f0c9e9de3d6278',
        '68c9b722c4f0c9e9de3d6702',
        '68c9c347c4f0c9e9de3d6b75',
        '68caf2e8e06cea57c8d12f1e',
        '68caf397e06cea57c8d12f53',
        '68cbfc77caf06215964089c1',
        '68cc4ff0caf06215964145a2',
        '68cde5efef18254423ae08f1',
        '68ceb5d8ef18254423ae13d6',
        '68d13642ef18254423ae326f',
        '68d1ca79ef18254423aea5fd',
        '68d20856ef18254423aec0e8',
        '68d221f6ef18254423aec5fa',
        '68d468ccd8fe6b66edbcdaa2',
        '68d49002a2de6f99ba3efc37',
        '68d53fa0a2de6f99ba3f063a',
        '68d61ac9d8ea2cd28452344b',
        '68d6ae3679b64bae368b284e',
        '68d9bd8479b64bae368b4eb7',
        '68dab1cb79b64bae368b58ce',
      ];
      for (const id of billingIds) {
        const billing = await this.modelMap['billing'].findById(id);
        if (billing) {
          billing.needsUpdate = false;
          await billing.save();
          console.log(`- Updated billing ${id}`);
        }
      }
    } catch (error) {
      console.log('❌ Error in custom task:', error);
    }

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
