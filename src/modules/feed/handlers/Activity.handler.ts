import mongoose from 'mongoose';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import { ActivityModel, IActivity } from '../model/Activity.model';

export class ActivityHandler extends CRUDHandler<IActivity> {
  constructor() {
    super(ActivityModel);
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: IActivity[]; metadata: any[] }[]> {
    const results = await this.Schema.aggregate([
      {
        $match: {
          $and: [...options.filters],
          ...(options.query.length > 0 && { $or: options.query }),
        },
      },
      {
        $sort: options.sort,
      },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page: options.page, limit: options.limit } }],
          entries: [{ $skip: (options.page - 1) * options.limit }, { $limit: options.limit }],
        },
      },
    ]);

    // Inflate objects for each activity entry
    if (results[0]?.entries?.length > 0) {
      await this.inflateActivityObjects(results[0].entries);
    }

    return results;
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
    };

    return modelMap[collection.toLowerCase()] || null;
  }

  /**
   * Inflates the object reference for each activity by looking up the actual document
   * from the collection specified in object.collection
   */
  private async inflateActivityObjects(activities: IActivity[]): Promise<void> {
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
          console.warn(`Unknown collection type: "${collection}", skipping inflation`);
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

            // If this object has a profile field, inflate it too
            if (objectData.profile?.type && objectData.profile?.id) {
              await this.inflateProfile((activity as any).objectDetails);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to inflate objects from collection "${collection}":`, error);
        // Continue processing other collections even if one fails
      }
    }
  }

  /**
   * Inflates a single profile field on an object
   * Only retrieves specific fields: _id, name, email, profileImageUrl
   */
  private async inflateProfile(obj: any): Promise<void> {
    const profileType = obj.profile.type;
    const profileId = obj.profile.id;

    try {
      // Map profile type to collection name
      const collectionMap: Record<string, string> = {
        athlete: 'athleteprofiles',
        team: 'teamprofiles',
        scout: 'scoutprofiles',
      };

      const collectionName = collectionMap[profileType.toLowerCase()];
      if (!collectionName) {
        console.warn(`Unknown profile type: "${profileType}"`);
        return;
      }

      // Direct collection access
      const db = mongoose.connection.db;
      if (!db) return;

      const collection = db.collection(collectionName);
      const profile = await collection.findOne({ _id: new mongoose.Types.ObjectId(profileId) }, { projection: { _id: 1, fullName: 1, email: 1, profileImageUrl: 1 } });

      if (profile) {
        obj.profile = profile;
      }
    } catch (error) {
      console.error(`Failed to inflate profile of type "${profileType}":`, error);
    }
  }
}
