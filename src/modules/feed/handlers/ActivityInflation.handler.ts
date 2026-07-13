import mongoose from 'mongoose';
import { IActivity } from '../model/Activity.model';
import logger from '../../../utils/logger';

/**
 * Handler for inflating activity objects and their associated profiles
 * Handles batch lookups and profile resolution for different entity types
 */
export class ActivityInflationHandler {
  /**
   * Inflates the object reference for each activity by looking up the actual document
   * from the collection specified in object.collection
   */
  async inflateActivityObjects(activities: IActivity[]): Promise<void> {
    // Group activities by their object collection for batch lookups
    const collectionGroups = new Map<string, IActivity[]>();

    for (const activity of activities) {
      if (!activity.object?.collection || !activity.object?.id) continue;

      const collection = activity.object.collection;
      if (!collectionGroups.has(collection)) {
        collectionGroups.set(collection, []);
      }
      collectionGroups.get(collection)!.push(activity);
    }

    // Perform batch lookups for each collection
    for (const [collection, groupActivities] of collectionGroups) {
      const ids = groupActivities.map((a) => a.object.id);

      try {
        // Get the Mongoose model name from the collection name
        const modelName = this.getModelName(collection);
        if (!modelName) {
          logger.warn({ collection }, '[ActivityInflationHandler] Unknown collection type, skipping inflation.');
          continue;
        }

        // Get the model for this collection
        const CollectionModel = mongoose.model(modelName);

        // Batch fetch all objects
        const objects = await CollectionModel.find({ _id: { $in: ids } }).lean();

        // Create a map for quick lookup
        const objectMap = new Map(objects.map((obj: any) => [obj._id.toString(), obj]));

        // Attach the inflated objects to activities
        for (const activity of groupActivities) {
          const objectData = objectMap.get(activity.object.id);
          if (objectData) {
            (activity as any).objectDetails = objectData;

            // Inflate profile based on object type
            await this.inflateObjectProfile((activity as any).objectDetails, collection);
          }
        }
      } catch (error) {
        logger.error({ err: error, collection }, '[ActivityInflationHandler] Failed to inflate objects from collection.');
        // Continue processing other collections even if one fails
      }
    }
  }

  /**
   * Inflates profile for an object based on its type/collection
   * Handles different profile reference patterns:
   * - Posts: { profile: { type: string, id: string } }
   * - Events: { teamProfileId: string }
   * - Add more patterns as needed
   */
  private async inflateObjectProfile(obj: any, collection: string): Promise<void> {
    try {
      let profileType: string | null = null;
      let profileId: string | null = null;

      // Determine profile type and ID based on object structure
      if (obj.profile?.type && obj.profile?.id) {
        // Social post pattern: { profile: { type, id } }
        profileType = obj.profile.type;
        profileId = obj.profile.id;
      } else if (obj.teamProfileId) {
        // Event pattern: { teamProfileId: string }
        profileType = 'team';
        profileId = obj.teamProfileId;
      } else if (obj.athleteProfileId) {
        // Athlete-specific event pattern (if exists)
        profileType = 'athlete';
        profileId = obj.athleteProfileId;
      } else if (obj.scoutProfileId) {
        // Scout-specific pattern (if exists)
        profileType = 'scout';
        profileId = obj.scoutProfileId;
      }

      // If we found a profile reference, inflate it
      if (profileType && profileId) {
        await this.inflateProfile(obj, profileType, profileId);
      }
    } catch (error) {
      logger.error({ err: error, collection }, '[ActivityInflationHandler] Failed to determine profile for collection.');
    }
  }

  /**
   * Inflates a profile and attaches it to the object
   * Only retrieves specific fields: _id, fullName, email, profileImageUrl
   * For admin profiles, creates a static profile object instead
   */
  private async inflateProfile(obj: any, profileType: string, profileId: string): Promise<void> {
    try {
      // Handle admin profiles differently - use static data
      if (profileType.toLowerCase() === 'admin') {
        obj.profile = {
          _id: profileId,
          fullName: 'FreeAgentPortal',
          profileImageUrl: 'https://res.cloudinary.com/dsltlng97/image/upload/v1752863629/placeholder-logo_s7jg3y.png',
          isAdmin: true,
        };
        return;
      }

      // Map profile type to collection name
      const collectionMap: Record<string, string> = {
        athlete: 'athleteprofiles',
        team: 'teamprofiles',
        scout: 'scoutprofiles',
      };

      const collectionName = collectionMap[profileType.toLowerCase()];
      if (!collectionName) {
        logger.warn({ profileType }, '[ActivityInflationHandler] Unknown profile type.');
        return;
      }

      // Direct collection access
      const db = mongoose.connection.db;
      if (!db) return;

      const collection = db.collection(collectionName);
      const profile = await collection.findOne(
        { _id: new mongoose.Types.ObjectId(profileId) },
        { projection: { _id: 1, fullName: 1, email: 1, profileImageUrl: 1, name: 1, logoUrl: 1 } }
      );

      // Map team-specific fields to standard fields
      if (profile?.name) {
        profile.fullName = profile.name;
      }
      if (profile?.logoUrl) {
        profile.profileImageUrl = profile.logoUrl;
      }

      if (profile) {
        obj.profile = profile;
      }
    } catch (error) {
      logger.error({ err: error, profileType, profileId }, '[ActivityInflationHandler] Failed to inflate profile.');
    }
  }

  /**
   * Maps collection names to Mongoose model names
   * Handles both singular and plural forms
   */
  private getModelName(collection: string): string | null {
    const modelMap: Record<string, string> = {
      posts: 'Post',
      post: 'Post',
      events: 'Event',
      event: 'Event',
      users: 'User',
      user: 'User',
      teams: 'Team',
      team: 'Team',
      admin: 'Admin',
      admins: 'Admin',
    };

    return modelMap[collection.toLowerCase()] || null;
  }
}
