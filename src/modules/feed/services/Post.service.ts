import { CRUDService } from '../../../utils/baseCRUD';
import { ActivityHandler } from '../handlers/Activity.handler';
import { PostHandler } from '../handlers/Post.handler';
import { ActivityModel } from '../model/Activity.model';
import { ActivityClient, PublishActivityInput } from '../util/ActivityClient';
import { mapPostCreated } from '../util/mapPostCreated';

export class PostService extends CRUDService {
  constructor() {
    super(PostHandler);
    this.requiresAuth = {
      create: true,
      updateResource: true,
      removeResource: true,
    };
    this.queryKeys = ['authorId', 'body'];
  }

  protected async afterCreate(doc: any): Promise<void> {
    try {
      // Create activity event here for the new post only if Visibility is public
      if (doc.visibility === 'public') {
        const input = await mapPostCreated(doc);
        await ActivityClient.publish(input as PublishActivityInput);
      }

      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  protected afterUpdate(doc: any | null): Promise<void> {
    // we need to fire off an activity event here for post update if the post is public
    // if the post moves from private to public, we fire off a new post.created event
    // because of idempotency keys, this should be safe to retry even if it was already published
    // since itll simply update the existing activity event
    if (doc && doc.visibility === 'public') {
      return ActivityClient.publish(mapPostCreated(doc) as PublishActivityInput)
        .then(() => Promise.resolve())
        .catch((err) => Promise.reject(err));
    }
    return Promise.resolve();
  }

  protected async afterRemove(doc: any | null): Promise<void> {
    // we need to fire off an activity event here for post deletion
    if (doc) {
      await ActivityModel.findOneAndDelete({
        'object.id': doc._id.toString(),
      });
    }
    return Promise.resolve();
  }
}
