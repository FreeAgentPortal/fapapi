import { eventBus } from '../../../../lib/eventBus';
import { ManagedAthleteOutboxEventModel } from '../model/ManagedAthleteOutboxEvent';

export interface ManagedAthleteNotificationRequestedEvent {
  outboxId: string;
  notificationType: 'agent.athlete-profile.updated' | 'agent.athlete-resume.updated';
  userTo: string;
  userFrom: string;
  entityId: string;
  message: string;
  description: string;
}

const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export class ManagedAthleteOutboxService {
  static async dispatchById(outboxId: string): Promise<boolean> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
    const event = await ManagedAthleteOutboxEventModel.findOneAndUpdate(
      {
        _id: outboxId,
        $or: [
          { status: 'pending', availableAt: { $lte: now } },
          { status: 'processing', processingStartedAt: { $lte: staleBefore } },
        ],
      },
      {
        $set: {
          status: 'processing',
          processingStartedAt: now,
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    );

    if (!event) {
      return false;
    }

    try {
      await eventBus.publish<ManagedAthleteNotificationRequestedEvent>(event.eventType, {
        outboxId: event._id.toString(),
        notificationType: event.payload.notificationType,
        userTo: event.payload.userTo.toString(),
        userFrom: event.payload.userFrom.toString(),
        entityId: event.payload.entityId.toString(),
        message: event.payload.message,
        description: event.payload.description,
      });

      await ManagedAthleteOutboxEventModel.updateOne(
        { _id: event._id, status: 'processing' },
        {
          $set: {
            status: 'published',
            publishedAt: new Date(),
          },
          $unset: {
            processingStartedAt: 1,
            lastError: 1,
          },
        }
      );
      return true;
    } catch (error) {
      const retryDelayMs = Math.min(60_000 * Math.max(event.attempts, 1), 15 * 60_000);
      await ManagedAthleteOutboxEventModel.updateOne(
        { _id: event._id, status: 'processing' },
        {
          $set: {
            status: 'pending',
            availableAt: new Date(Date.now() + retryDelayMs),
            lastError: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
          },
          $unset: { processingStartedAt: 1 },
        }
      );
      throw error;
    }
  }

  static async dispatchPending(limit = 50): Promise<{ attempted: number; published: number }> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
    const events = await ManagedAthleteOutboxEventModel.find({
      $or: [
        { status: 'pending', availableAt: { $lte: now } },
        { status: 'processing', processingStartedAt: { $lte: staleBefore } },
      ],
    })
      .select('_id')
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    let published = 0;
    for (const event of events) {
      try {
        if (await this.dispatchById(event._id.toString())) {
          published += 1;
        }
      } catch (error) {
        console.error(`[ManagedAthleteOutbox] Failed to publish event ${event._id}:`, error);
      }
    }
    return { attempted: events.length, published };
  }
}
