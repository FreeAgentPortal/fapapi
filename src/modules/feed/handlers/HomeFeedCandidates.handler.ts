import mongoose from 'mongoose';
import { ActivityModel } from '../model/Activity.model';
import { PostModel } from '../model/Post.model';
import { ActivityInflationHandler } from './ActivityInflation.handler';
import { normalizeFeedProfileType } from '../util/inflateProfiles';
import { HomeCursor } from '../util/homeCursor';

export function isHomeActivityEligible(activity: any): boolean {
  const object = activity.objectDetails;
  return activity.visibility === 'public' && !!object
    && (!object.visibility || object.visibility === 'public')
    && !object.isDeleted && object.moderation?.status !== 'removed';
}

export class HomeFeedCandidates {
  private inflation = new ActivityInflationHandler();

  async organic(state: HomeCursor, count: number): Promise<any[]> {
    const eligible: any[] = [];
    let last = state.last;
    // Scan past stale references and ineligible canonical objects without exposing them.
    while (eligible.length < count) {
      const entries: any[] = await ActivityModel.find({ visibility: 'public', createdAt: { $lte: new Date(state.anchor) },
        ...(last ? { $or: [{ createdAt: { $lt: new Date(last.createdAt) } },
          { createdAt: new Date(last.createdAt), _id: { $lt: new mongoose.Types.ObjectId(last.id) } }] } : {}),
      }).sort({ createdAt: -1, _id: -1 }).limit(Math.max(count, 50)).lean();
      if (!entries.length) break;
      await this.inflation.inflateActivityObjects(entries);
      eligible.push(...entries.filter(isHomeActivityEligible));
      const tail = entries[entries.length - 1];
      last = { createdAt: new Date(tail.createdAt).toISOString(), id: String(tail._id) };
      if (entries.length < Math.max(count, 50)) break;
    }
    return eligible.slice(0, count);
  }

  async teams(anchor: number): Promise<any[]> {
    // Match both canonical "team" and legacy "TeamProfile" profile types.
    const rows = await ActivityModel.aggregate([
      { $match: { visibility: 'public', 'object.collection': { $in: ['posts', 'post'] }, createdAt: { $lte: new Date(anchor) } } },
      { $addFields: { sourceId: { $convert: { input: '$object.id', to: 'objectId', onError: null, onNull: null } } } },
      { $lookup: { from: PostModel.collection.name, localField: 'sourceId', foreignField: '_id', as: 'source' } },
      { $unwind: '$source' },
      { $match: { 'source.profile.type': { $regex: '^team(profile)?$', $options: 'i' }, 'source.visibility': 'public',
        'source.isDeleted': { $ne: true }, 'source.moderation.status': { $ne: 'removed' } } },
      { $sort: { 'source.createdAt': -1, _id: -1 } },
      { $group: { _id: '$source._id', activity: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$activity' } },
      { $sort: { 'source.createdAt': -1, _id: -1 } },
      { $limit: 50 },
      { $project: { source: 0, sourceId: 0 } },
    ]);
    await this.inflation.inflateActivityObjects(rows);
    return rows.filter((row: any) => isHomeActivityEligible(row)
      && normalizeFeedProfileType(row.objectDetails?.profile?.type ?? '') === 'team');
  }
}
