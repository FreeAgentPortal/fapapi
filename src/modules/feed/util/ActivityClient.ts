// services/ActivityClient.ts

import { ActivityModel, ActivityRef } from '../model/Activity.model';

export interface PublishActivityInput {
  verb: string; // e.g., "created", "joined", "liked"
  actorId: string; // e.g., "team:abc" or "user:123"
  object: ActivityRef; // pointer to canonical doc
  visibility?: 'public' | 'private' | 'friends-only' | 'athletes-only' | 'team-only'; // MVP
  summary?: string;
  thumbUrl?: string;
  sport?: string;
  tags?: string[];

  // optional dedupe key (e.g., `${verb}:${object.collection}:${object.id}:${stamp}`)
  idempotencyKey?: string;

  // override only for special backfills/time-travel
  createdAt?: Date;
  updatedAt?: Date;
}

export class ActivityClient {
  /**
   * Fire-and-forget insert of a new Activity.
   * - If idempotencyKey is provided, uses an upsert with $setOnInsert.
   * - Returns the _id of the created (or existing) activity.
   */
  static async publish(input: PublishActivityInput): Promise<string> {
    const doc = {
      verb: input.verb,
      actorId: input.actorId,
      object: input.object,
      visibility: input.visibility ?? 'public',
      summary: input.summary,
      thumbUrl: input.thumbUrl,
      sport: input.sport,
      tags: input.tags,
      idempotencyKey: input.idempotencyKey,
      updatedAt: input.updatedAt ?? new Date(),
    };

    if (input.idempotencyKey) {
      // Idempotent path
      const res = await ActivityModel.findOneAndUpdate({ idempotencyKey: input.idempotencyKey }, { $setOnInsert: doc }, { upsert: true, new: true }).lean();

      // Normalize possible typings where res might be an array or a single document.
      if (!res) {
        throw new Error('Failed to upsert activity');
      }
      const docResult = Array.isArray(res) ? res[0] : res;
      return String((docResult as any)._id);
    }

    // Non-idempotent path
    const created = await ActivityModel.create(doc);
    return String(created._id);
  }
}
