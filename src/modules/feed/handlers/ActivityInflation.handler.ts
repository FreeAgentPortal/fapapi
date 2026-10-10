import mongoose from 'mongoose';
import { IActivity } from '../model/Activity.model';
import logger from '../../../utils/logger';
import { inflateProfiles } from '../util/inflateProfiles';

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

        // Inflate each object once, including objects referenced by multiple activities.
        await this.inflateObjectProfiles(objects);

        // Create a map for quick lookup
        const objectMap = new Map(objects.map((obj: any) => [obj._id.toString(), obj]));

        // Attach the inflated objects to activities
        for (const activity of groupActivities) {
          const objectData = objectMap.get(activity.object.id.toString());
          if (objectData) {
            (activity as any).objectDetails = objectData;
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
  async inflateObjectProfiles(objects: any[]): Promise<void> {
    const targets = objects.map((object) => {
      if (object.profile?.id) {
        return { object, type: typeof object.profile.type === 'string' ? object.profile.type : '', id: object.profile.id.toString() };
      }
      for (const type of ['team', 'athlete', 'scout', 'professional', 'agent', 'admin']) {
        const id = object[`${type}ProfileId`];
        if (id) return { object, type, id: id.toString() };
      }
      if (typeof object.authorId === 'string') {
        const profileId = object.authorId.split(';').find((part: string) => part.startsWith('profile:'))?.slice('profile:'.length);
        return { object, type: '', id: profileId ?? '' };
      }
      return null;
    }).filter((target): target is { object: any; type: string; id: string } => target !== null);

    await inflateProfiles(targets);
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
