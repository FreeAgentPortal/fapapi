import { Post, PostModel } from '../model/Post.model';
import { CRUDHandler } from '../../../utils/baseCRUD';
import { processPostData } from '../util/extractPostMetadata';

export class PostHandler extends CRUDHandler<Post> {
  constructor() {
    super(PostModel);
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
