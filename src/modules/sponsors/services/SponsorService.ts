import { Request, Response } from 'express';
import { UploadedFile } from 'express-fileupload';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { CRUDService, PaginationOptions } from '../../../utils/baseCRUD';
import { SponsorHandler } from '../handlers/SponsorHandler';

export class SponsorService extends CRUDService {
  declare protected handler: SponsorHandler;

  constructor() {
    super(SponsorHandler);
    this.queryKeys = ['businessName'];
    this.requiresAuth = { create: true, getResource: true, getResources: true, updateResource: true, removeResource: true };
  }

  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const sponsor = await this.handler.create({ fields: req.body, actorId: req.user?._id, file: this.getLogoFile(req) });
      return res.status(201).json({ success: true, payload: sponsor });
    } catch (err) {
      return error(err, req, res);
    }
  });

  public updateResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const sponsor = await this.handler.update(req.params.id, { fields: req.body, actorId: (req as AuthenticatedRequest).user?._id, file: this.getLogoFile(req) });
      return res.status(200).json({ success: true, payload: sponsor });
    } catch (err) {
      return error(err, req, res);
    }
  };

  public getVisible = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    try {
      return res.status(200).json({ success: true, payload: await this.handler.fetchVisible() });
    } catch (err) {
      return error(err, req, res);
    }
  });

  protected async beforeFetchAll(options: PaginationOptions): Promise<void> {
    if (!Number.isSafeInteger(options.page) || options.page < 1 || !Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100) {
      throw new ErrorUtil('pageNumber must be a positive integer and pageLimit must be between 1 and 100', 400);
    }
  }

  private getLogoFile(req: Request): UploadedFile | undefined {
    const files = req.files || {};
    if (Object.keys(files).some((key) => key !== 'logo') || Array.isArray(files.logo)) {
      throw new ErrorUtil('Upload exactly one file using the logo form field', 400);
    }
    return files.logo;
  }
}
