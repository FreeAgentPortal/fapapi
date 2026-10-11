import mongoose from 'mongoose';
import { SponsorFeedEventModel } from '../models/SponsorFeedEvent';
import { SponsorFeedImpressionStateModel } from '../models/SponsorFeedImpressionState';
import { PlacementClaim } from '../utils/placementToken';

export const SPONSOR_IMPRESSION_COOLDOWN_MS = 30 * 60 * 1000;

export class SponsorFeedMeasurementService {
  async recordImpression(claim: PlacementClaim): Promise<{ recorded: boolean }> {
    const receivedAt = new Date();
    await SponsorFeedEventModel.init();
    await SponsorFeedImpressionStateModel.init();
    const stateId = `${claim.userId}:${claim.sponsorId}`;
    const session = await mongoose.startSession();

    try {
      // Concurrent first upserts can produce E11000 rather than a retriable write conflict.
      // Retry the transaction so the loser reads the state committed by the winner.
      for (let attempt = 0; ; attempt += 1) {
        try {
          const recorded = await session.withTransaction(
            async () => {
              const state = await SponsorFeedImpressionStateModel.findOneAndUpdate(
                { _id: stateId },
                { $inc: { sequence: 1 }, $setOnInsert: { lastCountedAt: null } },
                { upsert: true, new: true, session }
              );
              // The write above serializes all impressions for this viewer/sponsor.
              const existing = await SponsorFeedEventModel.findOne({ placementId: claim.placementId, type: 'impression' }).session(session).lean();
              if (existing) return false;

              let lastCountedAt: Date | null = state!.lastCountedAt ?? null;
              if (!lastCountedAt) {
                // Honor impressions recorded before the cooldown was introduced, without a backfill.
                const latest = await SponsorFeedEventModel.findOne({ userId: claim.userId, sponsorId: claim.sponsorId, type: 'impression', counted: { $ne: false } })
                  .sort({ receivedAt: -1 })
                  .session(session)
                  .lean();
                lastCountedAt = latest?.receivedAt ?? null;
              }
              const counted = !lastCountedAt || receivedAt.getTime() - lastCountedAt.getTime() >= SPONSOR_IMPRESSION_COOLDOWN_MS;
              const result = await SponsorFeedEventModel.updateOne(
                { placementId: claim.placementId, type: 'impression' },
                {
                  $setOnInsert: {
                    sponsorId: claim.sponsorId,
                    businessName: claim.businessName,
                    revision: claim.revision,
                    userId: claim.userId,
                    receivedAt,
                    counted,
                  },
                },
                { upsert: true, session }
              );
              if (result.upsertedCount !== 1) return false;

              if (counted || lastCountedAt) {
                await SponsorFeedImpressionStateModel.updateOne({ _id: stateId }, { $set: { lastCountedAt: counted ? receivedAt : lastCountedAt } }, { session });
              }
              // Suppressed placements are retained too: a delayed retry cannot become a new impression.
              return counted;
            },
            { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }
          );
          return { recorded: recorded === true };
        } catch (err: any) {
          if (err.code !== 11000 || attempt >= 2) throw err;
        }
      }
    } finally {
      await session.endSession();
    }
  }
}
