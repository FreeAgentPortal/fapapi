import axios from 'axios';
import JobPostModel from '../models/JobPost';
import JobSourceModel from '../models/JobSource';
import { fetchExternalJobs } from '../providers/externalJobProviders';
import { acquireSource, releaseSource, renewSource } from './JobSourceLease';

const REFRESH_MS = 6 * 60 * 60_000;
const MISSING_GRACE_MS = 48 * 60 * 60_000;

export interface IngestionResult {
  sourceId: string;
  status: 'success' | 'failed' | 'skipped';
  fetched: number;
  created: number;
  updated: number;
  closed: number;
  error?: string;
}

function failureMessage(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response ? `Provider returned HTTP ${error.response.status}` : `Provider request failed (${error.code || 'network error'})`;
  return error instanceof Error ? error.message.slice(0, 500) : 'Job ingestion failed';
}

export default class JobIngestionService {
  public async runSource(id: string, dueOnly = false): Promise<IngestionResult> {
    const { source, token } = await acquireSource(id, dueOnly);
    const result: IngestionResult = { sourceId: id, status: 'success', fetched: 0, created: 0, updated: 0, closed: 0 };
    const seenAt = new Date();
    try {
      await JobPostModel.init();
      await JobSourceModel.updateOne({ _id: id, lockToken: token }, { $set: { lastCheckedAt: seenAt } });
      // Fetch and validate the entire snapshot before touching any listings.
      const jobs = await fetchExternalJobs(source);
      result.fetched = jobs.length;
      for (let offset = 0; offset < jobs.length; offset += 100) {
        await renewSource(id, token);
        const writes = jobs.slice(offset, offset + 100).map((job) => {
          const { externalId, sourceUrl, employmentType, locationType, sourceUpdatedAt, ...fields } = job;
          return { updateOne: {
            filter: { origin: 'external', 'source.sourceId': source._id, 'source.externalId': externalId },
            update: {
              $set: {
                ...fields, organizationName: source.organizationName, status: 'published', lastSeenAt: seenAt,
                source: { sourceId: source._id, provider: source.provider, externalId, sourceUrl },
                ...(employmentType ? { employmentType } : {}),
                ...(locationType ? { locationType } : {}),
                ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
              },
              $unset: {
                missingSince: 1,
                ...(!employmentType ? { employmentType: 1 } : {}),
                ...(!locationType ? { locationType: 1 } : {}),
                ...(!sourceUpdatedAt ? { sourceUpdatedAt: 1 } : {}),
              },
              $setOnInsert: { origin: 'external', createdBy: source.createdBy, firstSeenAt: seenAt },
            },
            upsert: true,
          } };
        });
        const writeResult = await JobPostModel.bulkWrite(writes, { ordered: true });
        result.created += writeResult.upsertedCount;
        result.updated += writeResult.matchedCount;
      }

      await renewSource(id, token);
      const missing = { origin: 'external', 'source.sourceId': source._id, status: 'published', lastSeenAt: { $lt: seenAt } };
      // Close only jobs already missing from an earlier successful snapshot.
      const closed = await JobPostModel.updateMany(
        { ...missing, missingSince: { $lte: new Date(seenAt.getTime() - MISSING_GRACE_MS) } },
        { $set: { status: 'closed' } }
      );
      result.closed = closed.modifiedCount;
      await renewSource(id, token);
      await JobPostModel.updateMany({ ...missing, missingSince: { $exists: false } }, { $set: { missingSince: seenAt } });
      await JobSourceModel.updateOne({ _id: id, lockToken: token }, {
        $set: {
          lastSuccessfulAt: new Date(), consecutiveFailures: 0, nextRunAt: new Date(Date.now() + REFRESH_MS),
          lastResult: { fetched: result.fetched, created: result.created, updated: result.updated, closed: result.closed },
        },
        $unset: { lastError: 1 },
      });
    } catch (error) {
      result.status = 'failed';
      result.error = failureMessage(error);
      await JobSourceModel.updateOne({ _id: id, lockToken: token }, {
        $set: { lastError: result.error, nextRunAt: new Date(Date.now() + REFRESH_MS) },
        $inc: { consecutiveFailures: 1 },
      });
    } finally {
      await releaseSource(id, token);
    }
    return result;
  }

  public async runDueSources(): Promise<IngestionResult[]> {
    const sources = await JobSourceModel.find({ enabled: true, nextRunAt: { $lte: new Date() } }).select('_id').lean();
    const results: IngestionResult[] = [];
    // Sequential sources bound outbound traffic; one failed source never stops the rest.
    for (const source of sources) {
      const id = String(source._id);
      try {
        results.push(await this.runSource(id, true));
      } catch (error) {
        results.push({ sourceId: id, status: (error as any)?.statusCode === 409 ? 'skipped' : 'failed',
          fetched: 0, created: 0, updated: 0, closed: 0, error: failureMessage(error) });
      }
    }
    return results;
  }
}
