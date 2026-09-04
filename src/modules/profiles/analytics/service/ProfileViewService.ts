import { Response } from 'express';
import asyncHandler from '../../../../middleware/asyncHandler';
import error from '../../../../middleware/error';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { eventBus } from '../../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import logger from '../../../../utils/logger';
import { ProfileViewHandler } from '../handlers/ProfileViewHandler';
import { ProfileSubjectType, ProfileViewRecordedEvent } from '../types';

export class ProfileViewService {
  constructor(
    private readonly subjectType: ProfileSubjectType,
    private readonly handler: ProfileViewHandler = new ProfileViewHandler()
  ) {}

  public trackView = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.recordView(this.subjectType, req.params.id!, req);
      if (!result.counted) {
        return res.status(200).json({ success: true, payload: result });
      }

      const event: ProfileViewRecordedEvent = {
        viewId: result.viewId,
        subjectType: this.subjectType,
        subjectProfileId: req.params.id!,
        subjectOwnerUserId: result.subjectOwnerUserId,
        viewerType: result.viewerType,
        occurredAt: result.recordedAt,
      };
      void eventBus.publish('profile.view.recorded', event).catch((err) => {
        logger.error({ err, viewId: result.viewId }, '[ProfileViewService] Failed to publish profile view event.');
      });

      return res.status(201).json({
        success: true,
        payload: {
          counted: true,
          viewId: result.viewId,
          recordedAt: result.recordedAt,
        },
      });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });

  public getReport = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.getReport(
        this.subjectType,
        req.params.id!,
        String(req.user._id),
        req.user.profileRefs?.[this.subjectType],
        this.resolveDays(req.query.days)
      );
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      return error(err, req, res);
    }
  });

  private resolveDays(rawDays: unknown): number {
    if (rawDays === undefined) return 30;
    if (Array.isArray(rawDays) || typeof rawDays !== 'string' || !/^\d+$/.test(rawDays)) {
      throw new ErrorUtil('days must be an integer between 1 and 90', 400);
    }
    const days = Number(rawDays);
    if (!Number.isSafeInteger(days) || days < 1 || days > 90) {
      throw new ErrorUtil('days must be an integer between 1 and 90', 400);
    }
    return days;
  }
}
