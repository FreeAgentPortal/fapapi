import { eventBus } from '../../../lib/eventBus';
import SearchReportEventHandler from '../handler/SearchReportEvent.handler';
import Notification from '../model/Notification';

export interface SearchReportEvent {
  userId: string;
  ownerType: 'team' | 'scout' | 'agent';
  searchPreferenceName: string;
  reportId: string;
  resultCount: number;
  generatedAt: Date;
}

export default class SearchReportEventService {
  constructor(private readonly handler: SearchReportEventHandler = new SearchReportEventHandler()) {}
  /**
   * Initialize event listeners
   */
  public init(): void { 
    console.log('[SearchReportEventHandler] Initializing search report event handlers...');

    eventBus.subscribe('search.report.generated', this.handler.onSearchReportGenerated);

    console.log('[SearchReportEventHandler] Event handlers initialized');
  }
}
