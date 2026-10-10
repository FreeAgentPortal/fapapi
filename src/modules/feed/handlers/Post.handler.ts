import { Post, PostModel } from '../model/Post.model';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import { processPostData } from '../util/extractPostMetadata';
import { ActivityInflationHandler } from './ActivityInflation.handler';

export class PostHandler extends CRUDHandler<Post> {
  private inflationHandler = new ActivityInflationHandler();

  constructor() {
    super(PostModel);
  }

  async fetch(id: string): Promise<any | null> {
    const post = await super.fetch(id);
    if (post) await this.inflationHandler.inflateObjectProfiles([post]);
    return post;
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: Post[]; metadata: any[] }[]> {
    const results = await super.fetchAll(options);
    for (const result of results) await this.inflationHandler.inflateObjectProfiles(result.entries);
    return results;
  }

  async beforeCreate(data: any): Promise<void> {
    // Process the post data to extract hashtags, mentions, etc.
    const processedData = processPostData(data);

    // Apply processed data back to the original data object
    Object.assign(data, processedData);

    // Ensure required fields have defaults
    data.userId = data.user;
    data.visibility = data.visibility || 'public';
    data.allowComments = data.allowComments ?? true;
    data.isEdited = false;
    data.isDeleted = false;
    data.counts = {
      reactions: 0,
      comments: 0,
      shares: 0,
      views: 0,
    };
  }
}
