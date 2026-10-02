import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import JobSourceService from '../services/JobSourceService';
import JobIngestionService, { IngestionResult } from '../services/JobIngestionService';

export default class JobSourceHandler {
  private sources = new JobSourceService();
  private ingestion = new JobIngestionService();

  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const source = await this.sources.create(req.body, String(req.user._id));
      // Source creation remains successful when the upstream board is temporarily down.
      let ingestion: IngestionResult | null = null;
      if (source.enabled) {
        try {
          ingestion = await this.ingestion.runSource(String(source._id));
        } catch (err) {
          // A scheduler may claim a newly created source before this request does.
          ingestion = { sourceId: String(source._id), status: (err as ErrorUtil)?.statusCode === 409 ? 'skipped' : 'failed',
            fetched: 0, created: 0, updated: 0, closed: 0, error: 'Initial ingestion could not complete; check source status or retry ingestion' };
        }
      }
      return res.status(201).json({ success: true, payload: await this.sources.get(String(source._id)), ingestion });
    } catch (err) { return error(err, req, res); }
  });

  public list = asyncHandler(async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.pageNumber ?? 1);
      const limit = Number(req.query.pageLimit ?? 20);
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new ErrorUtil('pageNumber must be positive and pageLimit must be between 1 and 100', 400);
      }
      const { entries, totalCount } = await this.sources.list(page, limit);
      return res.json({ success: true, payload: entries, metadata: { page, totalCount, pages: Math.ceil(totalCount / limit) } });
    } catch (err) { return error(err, req, res); }
  });

  public get = asyncHandler(async (req: Request, res: Response) => {
    try { return res.json({ success: true, payload: await this.sources.get(req.params.id) }); }
    catch (err) { return error(err, req, res); }
  });

  public update = asyncHandler(async (req: Request, res: Response) => {
    try { return res.json({ success: true, payload: await this.sources.update(req.params.id, req.body) }); }
    catch (err) { return error(err, req, res); }
  });

  public ingest = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.ingestion.runSource(req.params.id);
      return res.status(result.status === 'failed' ? 502 : 200).json({ success: result.status === 'success', payload: result });
    } catch (err) { return error(err, req, res); }
  });
}
