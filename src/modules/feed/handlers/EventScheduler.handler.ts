import { ModelKey, ModelMap } from '../../../utils/ModelMap';
import { EventModel } from '../model/Event.model';

interface EventsToProcess {
  eventsToStart: any[];
  eventsToComplete: any[];
}

export class EventSchedulerHandler {
  private modelMap: Record<ModelKey, any> = ModelMap;
  /**
   * @description Process scheduled and past events, scheduled events that need to be triggered and turned "active", and past events that need to be marked "completed"
   */
  public static async processEvents(): Promise<{
    successCount: number;
    errorCount: number;
    skippedCount: number;
    totalProcessed: number;
  }> {
    try {
      // Fetch events that need processing
      const eventsToProcess = await this.fetchEvents();

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      const totalToProcess = eventsToProcess.eventsToStart.length + eventsToProcess.eventsToComplete.length;

      // Only log if there are events to process
      if (totalToProcess > 0) {
        console.info(`[EventSchedulerHandler] Processing ${totalToProcess} scheduled events...`);
      }

      // Process events that should be marked as active (started)
      for (const event of eventsToProcess.eventsToStart) {
        try {
          await this.markEventActive(event);
          successCount++;
          console.info(`[EventSchedulerHandler] Marked event ${event._id} "${event.title}" as active`);
        } catch (error) {
          errorCount++;
          console.error(`[EventSchedulerHandler] Error marking event ${event._id} as active:`, error);
        }
      }

      // Process events that should be marked as completed
      for (const event of eventsToProcess.eventsToComplete) {
        try {
          await this.markEventCompleted(event);
          successCount++;
          console.info(`[EventSchedulerHandler] Marked event ${event._id} "${event.title}" as completed`);
        } catch (error) {
          errorCount++;
          console.error(`[EventSchedulerHandler] Error marking event ${event._id} as completed:`, error);
        }
      }

      const totalProcessed = eventsToProcess.eventsToStart.length + eventsToProcess.eventsToComplete.length;

      // console.info(`[EventSchedulerHandler] Processing completed. Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}, Total: ${totalProcessed}`);

      return {
        successCount,
        errorCount,
        skippedCount,
        totalProcessed,
      };
    } catch (error) {
      console.error('[EventSchedulerHandler] Error in processEvents:', error);
      return {
        successCount: 0,
        errorCount: 1,
        skippedCount: 0,
        totalProcessed: 0,
      };
    }
  }

  /**
   * @description Fetch events that need to be processed - events that should be started or completed
   * @returns Promise<EventsToProcess> Object containing arrays of events to start and complete
   */
  static async fetchEvents(): Promise<EventsToProcess> {
    const now = new Date();

    try {
      // Fetch events that have passed their end time and should be marked as completed
      // This includes both 'scheduled' events that ended without being marked active,
      // and 'active' events that have now ended
      const eventsToComplete = await EventModel.find({
        status: { $in: ['scheduled', 'active'] },
        endsAt: { $lt: now },
      }).lean();

      // Fetch events that have started but not yet ended (should be marked as active)
      const eventsToStart = await EventModel.find({
        status: 'scheduled',
        startsAt: { $lte: now },
        endsAt: { $gt: now },
      }).lean();

      // Only log when events are found to reduce noise
      if (eventsToComplete.length > 0 || eventsToStart.length > 0) {
        console.info(`[EventSchedulerHandler] Found ${eventsToComplete.length} events to complete and ${eventsToStart.length} events that have started`);
      }

      return {
        eventsToStart,
        eventsToComplete,
      };
    } catch (error) {
      console.error('[EventSchedulerHandler] Error fetching events:', error);
      throw error;
    }
  }

  /**
   * @description Mark an event as completed
   * @param event Event to mark as completed
   */
  private static async markEventCompleted(event: any): Promise<void> {
    await ModelMap['event'].findByIdAndUpdate(event._id, { status: 'completed' }, { new: true });
  }

  /**
   * @description Mark an event as active (started)
   * @param event Event to mark as active
   */
  private static async markEventActive(event: any): Promise<void> {
    await ModelMap['event'].findByIdAndUpdate(event._id, { status: 'active' }, { new: true });
  }
}
