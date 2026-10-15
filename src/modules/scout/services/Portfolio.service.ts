import { ClientSession } from 'mongoose';
import { Portfolio, PortfolioItem, PortfolioAsset, Submission, SubmittedItem, Review, ScoutAudit } from '../models/Portfolio';
import { PortfolioAccessService } from './PortfolioAccess.service';
import { fail, id, itemInput, paged, revision, text } from '../utils/portfolioInput';
import { transaction } from '../utils/transaction';

export class PortfolioService {
  readonly access = new PortfolioAccessService();

  async ensure(athleteId: any) {
    try {
      return await Portfolio.findOneAndUpdate({ athleteId }, { $setOnInsert: { athleteId } }, { upsert: true, new: true });
    } catch (error: any) {
      if (error.code !== 11000) throw error;
      return (await Portfolio.findOne({ athleteId }))!;
    }
  }

  async lock(athleteId: any, session: ClientSession, expectedRevision?: number) {
    const filter: any = { athleteId };
    if (expectedRevision !== undefined) filter.revision = revision(expectedRevision);
    const portfolio = await Portfolio.findOneAndUpdate(filter, { $inc: { lock: 1 } }, { new: true, session });
    if (!portfolio) fail('Portfolio changed; reload before retrying', 409);
    return portfolio;
  }

  async draft(userId: string, page: number, limit: number) {
    const athlete = await this.access.athlete(userId);
    const portfolio = await Portfolio.findOne({ athleteId: athlete._id }).lean();
    const filter = { athleteId: athlete._id };
    const [items, count, canEdit] = await Promise.all([
      PortfolioItem.find(filter).sort({ order: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      PortfolioItem.countDocuments(filter), this.access.hasAccess(athlete._id),
    ]);
    return { portfolio: portfolio ?? { athleteId: athlete._id, revision: 0, version: 0, storageBytes: 0 }, canEdit: canEdit && athlete.isActive !== false, items: paged(items, count, page, limit) };
  }

  async edit(userId: string, data: any) {
    const athlete = await this.access.athlete(userId);
    await this.access.requireEntitled(athlete._id);
    await this.ensure(athlete._id);
    return transaction(async session => {
      const portfolio = await this.lock(athlete._id, session, revision(data.revision));
      await this.access.requireEntitled(athlete._id, session);
      for (const key of ['sport', 'position', 'context'] as const) {
        if (data[key] !== undefined) portfolio[key] = text(data[key], key, key === 'context' ? 10000 : 200);
      }
      portfolio.revision++;
      return portfolio.save({ session });
    });
  }

  async saveItem(userId: string, data: any, itemId?: string) {
    const athlete = await this.access.athlete(userId);
    await this.access.requireEntitled(athlete._id);
    const input = itemInput(data);
    if (itemId) id(itemId);
    await this.ensure(athlete._id);
    return transaction(async session => {
      const portfolio = await this.lock(athlete._id, session, revision(data.revision));
      await this.access.requireEntitled(athlete._id, session);
      if (input.assetId) {
        const asset = await PortfolioAsset.findOne({ _id: input.assetId, athleteId: athlete._id, state: 'ready' }).session(session);
        if (!asset || (input.kind === 'pdf') !== (asset.contentType === 'application/pdf')) fail('Completed matching upload required');
      }
      let item;
      if (itemId) {
        item = await PortfolioItem.findOne({ _id: itemId, athleteId: athlete._id }).session(session);
        if (!item) fail('Item not found', 404);
        // Full item replacement avoids retaining an obsolete asset or video URL after a kind change.
        for (const key of ['text', 'url', 'assetId', 'startSeconds', 'endSeconds']) item.set(key, undefined);
        item.set(input);
        await item.save({ session });
      } else {
        [item] = await PortfolioItem.create([{ ...input, athleteId: athlete._id }], { session });
      }
      portfolio.revision++;
      await portfolio.save({ session });
      return { item, revision: portfolio.revision };
    });
  }

  async removeItem(userId: string, itemId: string, expected: unknown) {
    const athlete = await this.access.athlete(userId);
    return transaction(async session => {
      const portfolio = await this.lock(athlete._id, session, revision(expected));
      await this.access.requireEntitled(athlete._id, session);
      const result = await PortfolioItem.deleteOne({ _id: id(itemId), athleteId: athlete._id }, { session });
      if (!result.deletedCount) fail('Item not found', 404);
      portfolio.revision++;
      await portfolio.save({ session });
      return { revision: portfolio.revision };
    });
  }

  async submit(userId: string, expected: unknown) {
    const athlete = await this.access.athlete(userId);
    return transaction(async session => {
      const portfolio = await this.lock(athlete._id, session, revision(expected));
      await this.access.requireEntitled(athlete._id, session);
      const existing = await Submission.findOne({ athleteId: athlete._id, draftRevision: portfolio.revision }).session(session);
      if (existing) {
        if (portfolio.withdrawn) fail('Edit the draft before submitting again after withdrawal', 409);
        return existing;
      }
      if (!portfolio.sport || !portfolio.position || !portfolio.context) fail('Sport, position and evaluation context are required');
      if (!(await PortfolioItem.exists({ athleteId: athlete._id, kind: 'video' }).session(session))) fail('At least one video link is required');
      const snapshot = {
        fullName: athlete.fullName, sport: portfolio.sport, position: portfolio.position,
        league: athlete.league, college: athlete.college, highSchool: athlete.highSchool,
        graduationYear: athlete.graduationYear, measurements: athlete.measurements, metrics: athlete.metrics,
      };
      const [submission] = await Submission.create([{
        athleteId: athlete._id, version: portfolio.version + 1, draftRevision: portfolio.revision,
        sport: portfolio.sport, position: portfolio.position, context: portfolio.context,
        athlete: snapshot, submittedAt: new Date(), itemCount: await PortfolioItem.countDocuments({ athleteId: athlete._id }).session(session),
      }], { session });
      // Copy bounded batches; snapshots must not be one unbounded BSON document.
      let after: any;
      while (true) {
        const batch = await PortfolioItem.find({ athleteId: athlete._id, ...(after ? { _id: { $gt: after } } : {}) })
          .sort({ _id: 1 }).limit(100).session(session).lean();
        if (!batch.length) break;
        await SubmittedItem.insertMany(batch.map(({ _id, createdAt, updatedAt, __v, ...item }: any) => ({
          ...item, itemId: _id, submissionId: submission._id,
        })), { session });
        after = batch[batch.length - 1]._id;
      }
      portfolio.version = submission.version;
      portfolio.latestSubmission = submission._id;
      portfolio.withdrawn = false;
      portfolio.withdrawnAt = undefined;
      await portfolio.save({ session });
      await ScoutAudit.create([{ athleteId: athlete._id, actorUserId: userId, entityId: submission._id, action: 'portfolio.submitted' }], { session });
      return submission;
    });
  }

  async withdraw(userId: string) {
    const athlete = await this.access.athlete(userId);
    return transaction(async session => {
      const portfolio = await this.lock(athlete._id, session);
      if (portfolio.withdrawn) return portfolio;
      portfolio.withdrawn = true;
      portfolio.withdrawnAt = new Date();
      await portfolio.save({ session });
      await Review.updateMany({ athleteId: athlete._id, status: 'in_progress' }, {
        $set: { status: 'cancelled', completedAt: new Date() }, $inc: { revision: 1 },
      }, { session });
      await ScoutAudit.create([{ athleteId: athlete._id, actorUserId: userId, entityId: portfolio._id, action: 'portfolio.withdrawn' }], { session });
      return portfolio;
    });
  }

  async history(userId: string, page: number, limit: number) {
    const athlete = await this.access.athlete(userId);
    const filter = { athleteId: athlete._id };
    const [entries, count] = await Promise.all([
      Submission.find(filter).sort({ version: -1 }).skip((page - 1) * limit).limit(limit).lean(), Submission.countDocuments(filter),
    ]);
    return paged(entries, count, page, limit);
  }

  async submitted(userId: string, submissionId: string, page: number, limit: number) {
    const submission = await this.access.submission(userId, submissionId);
    const [items, count] = await Promise.all([
      SubmittedItem.find({ submissionId }).sort({ order: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      SubmittedItem.countDocuments({ submissionId }),
    ]);
    return { submission, items: paged(items, count, page, limit) };
  }

  async submittedItem(userId: string, submissionId: string, itemId: string) {
    await this.access.submission(userId, submissionId);
    const item = await SubmittedItem.findOne({ submissionId: id(submissionId), itemId: id(itemId) }).lean();
    if (!item) fail('Item not found in this submission', 404);
    return item;
  }
}
