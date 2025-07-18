import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { CRUDHandler, PaginationOptions } from '../../../../utils/baseCRUD';
import ClaimSchema, { ClaimType } from '../../model/ClaimSchema'; 
import { ClaimPipeline } from '../../pipelines/ClaimPipeline';

export class ClaimHandler extends CRUDHandler<ClaimType> {
  private claimPipeline: ClaimPipeline;
  constructor() {
    super(ClaimSchema);
    this.claimPipeline = new ClaimPipeline();
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: ClaimType[]; metadata: any[] }[]> {
    return await this.Schema.aggregate(this.claimPipeline.getFullPipeline(options.filters, options.query, options.sort, options.page, options.limit, 'complete'));
  }

  async fetch(id: string): Promise<ClaimType | null> {
    const result = await this.Schema.aggregate(this.claimPipeline.getSimplePipeline(id, 'detailed'));
    return result.length > 0 ? result[0] : null;
  }
}
