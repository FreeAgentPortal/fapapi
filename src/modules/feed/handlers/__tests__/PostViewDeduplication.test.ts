import mongoose from 'mongoose';
import { PostInteractionHandler } from '../PostInteraction.handler';
import { PostViewModel } from '../../model/PostInteraction.model';
import { PostModel } from '../../model/Post.model';

const postId = 'abcdef0123456789abcdef01';
const userId = '0123456789abcdef01234567';

describe('ordinary post view deduplication', () => {
  let session: any;
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-10T10:00:00Z') });
    session = { withTransaction: jest.fn(async (callback: () => Promise<boolean>) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    jest.spyOn(PostViewModel, 'init').mockResolvedValue(undefined as any);
    jest.spyOn(PostModel, 'findByIdAndUpdate').mockResolvedValue(undefined as any);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('increments only for an actual insertion, including repeated requests within the same millisecond', async () => {
    const update = jest.spyOn(PostViewModel, 'updateOne').mockResolvedValueOnce({ upsertedCount: 1 } as any)
      .mockResolvedValue({ upsertedCount: 0 } as any);
    const handler = new PostInteractionHandler();
    const results = await Promise.all(Array.from({ length: 10 }, () => handler.recordView(postId, userId, 5000)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(PostModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(PostModel.findByIdAndUpdate).toHaveBeenCalledWith(postId, { $inc: { 'counts.views': 1 } }, { session });
    expect(update).toHaveBeenCalledWith({ postId: new mongoose.Types.ObjectId(postId), userId: new mongoose.Types.ObjectId(userId) },
      { $set: { viewDurationMs: 5000 }, $setOnInsert: { createdAt: expect.any(Date) } }, { upsert: true, session });
    expect(PostViewModel.schema.indexes()).toContainEqual([
      { postId: 1, userId: 1 }, expect.objectContaining({ unique: true }),
    ]);
  });

  it('treats a racing duplicate-key insertion as an already recorded view', async () => {
    jest.spyOn(PostViewModel, 'updateOne').mockRejectedValue({ code: 11000 });
    expect(await new PostInteractionHandler().recordView(postId, userId)).toBe(false);
    expect(PostModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the view insertion and counter update in the same transaction and surfaces write failures', async () => {
    jest.spyOn(PostViewModel, 'updateOne').mockResolvedValue({ upsertedCount: 1 } as any);
    jest.mocked(PostModel.findByIdAndUpdate).mockRejectedValue(new Error('counter write failed'));
    await expect(new PostInteractionHandler().recordView(postId, userId)).rejects.toThrow('counter write failed');
    expect(session.withTransaction).toHaveBeenCalledWith(expect.any(Function),
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
