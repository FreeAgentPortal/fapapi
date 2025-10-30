import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import { ActivityModel, IActivity } from '../model/Activity.model';
import { ActivityEnrichmentHandler } from './ActivityEnrichment.handler';
import { ActivityInflationHandler } from './ActivityInflation.handler';

export class ActivityHandler extends CRUDHandler<IActivity> {
  private enrichmentHandler: ActivityEnrichmentHandler;
  private inflationHandler: ActivityInflationHandler;

  constructor() {
    super(ActivityModel);
    this.enrichmentHandler = new ActivityEnrichmentHandler();
    this.inflationHandler = new ActivityInflationHandler();
  }

  async fetchAll(options: PaginationOptions, currentUserId?: string): Promise<{ entries: IActivity[]; metadata: any[] }[]> {
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
      await this.inflationHandler.inflateActivityObjects(results[0].entries);

      // Enrich activities with interaction data if user is authenticated
      if (currentUserId) {
        console.log(`[ActivityHandler]: Enriching activities with interaction data`);
        await this.enrichmentHandler.enrichWithInteractions(results[0].entries, currentUserId);
      }
    }

    return results;
  }
}
