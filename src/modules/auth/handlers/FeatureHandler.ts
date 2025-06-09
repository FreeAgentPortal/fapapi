import mongoose from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import FeatureSchema from '../model/FeatureSchema';
import User from '../model/User';

export class FeatureHandler {
  async create(data: any): Promise<any> {
    return await FeatureSchema.create(data);
  }

  async fetchAll(options: {
    filters: Array<Object>;
    sort: Record<string, 1 | -1>;
    query: Array<Object>;
    page: Number;
    limit: Number;
  }): Promise<{ entries: any[]; metadata: any[] }[]> {
    return await FeatureSchema.aggregate([
      {
        $match: {
          $and: [
            ...options.filters, // Apply user filter here
          ],
          ...options.query, // Only include `$or` if it has conditions
        },
      },
      {
        $sort: {
          ...options.sort,
        },
      },
      {
        $facet: {
          metadata: [
            { $count: 'totalCount' }, // Count the total number of documents
            { $addFields: { page: options.page, limit: options.limit } }, // Add metadata for the page and page size
          ],
          entries: [{ $skip: (Number(options.page) - 1) * Number(options.limit) }, { $limit: Number(options.limit) }],
        },
      },
    ]);
  }

  async fetch(featureId: string): Promise<any[]> {
    return await FeatureSchema.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(featureId),
        },
      },
    ]);
  }

  async update(featureId: string, data: any): Promise<any> {
    return await FeatureSchema.findByIdAndUpdate(
      featureId,
      {
        ...data,
      },
      {
        new: true,
        runValidators: true,
      }
    );
  }

  async delete(featureId: string): Promise<{ success: boolean }> {
    const data = await FeatureSchema.findById(featureId);
    // check if it exists
    if (!data) {
      throw new ErrorUtil(`No feature found with the id of: ${featureId}`, 404);
    }

    // run an aggregation to see if there are any users with this feature, if there is throw an error
    const users = await User.aggregate([
      {
        $match: {
          features: {
            $in: [data._id],
          },
        },
      },
    ]);
    if (users.length > 0) {
      throw new ErrorUtil(`Feature is being used by users and cannot be removed`, 400);
    }

    await FeatureSchema.findByIdAndDelete(featureId);

    return { success: true };
  }
}
