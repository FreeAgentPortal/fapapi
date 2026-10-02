import { Types } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import JobSourceModel from '../models/JobSource';
import JobPostModel from '../models/JobPost';
import { parseSourceUrl, sourceBody, sourceEnabled, sourceText } from '../utils/jobSourceInput';
import { acquireSource, releaseSource } from './JobSourceLease';

export default class JobSourceService {
  public async create(input: unknown, createdBy: string) {
    const body = sourceBody(input, ['name', 'organizationName', 'provider', 'url', 'enabled']);
    await JobSourceModel.init();
    return JobSourceModel.create({
      name: sourceText(body.name, 'name'), organizationName: sourceText(body.organizationName, 'organizationName'),
      ...parseSourceUrl(body.provider, body.url),
      enabled: body.enabled === undefined ? true : sourceEnabled(body.enabled), createdBy,
    });
  }

  public async list(page: number, limit: number) {
    const [entries, totalCount] = await Promise.all([
      JobSourceModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      JobSourceModel.countDocuments(),
    ]);
    return { entries, totalCount };
  }

  public async get(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new ErrorUtil('Invalid job source ID', 400);
    const source = await JobSourceModel.findById(id).lean();
    if (!source) throw new ErrorUtil('Job source not found', 404);
    return source;
  }

  public async update(id: string, input: unknown) {
    // Provider and board identity are immutable: use another source for another board.
    const body = sourceBody(input, ['name', 'organizationName', 'enabled']);
    const changes: Record<string, unknown> = {};
    if (body.name !== undefined) changes.name = sourceText(body.name, 'name');
    if (body.organizationName !== undefined) changes.organizationName = sourceText(body.organizationName, 'organizationName');
    if (body.enabled !== undefined) changes.enabled = sourceEnabled(body.enabled);
    const { token } = await acquireSource(id, false, false);
    try {
      const jobs = { origin: 'external', 'source.sourceId': new Types.ObjectId(id) };
      if (changes.enabled === false) {
        await JobPostModel.updateMany({ ...jobs, status: 'published' }, { $set: { status: 'closed' } });
      }
      if (changes.organizationName) {
        await JobPostModel.updateMany(jobs, { $set: { organizationName: changes.organizationName } });
      }
      await JobSourceModel.updateOne({ _id: id, lockToken: token }, { $set: { ...changes, nextRunAt: new Date() } }, { runValidators: true });
    } finally {
      await releaseSource(id, token);
    }
    return this.get(id);
  }
}
