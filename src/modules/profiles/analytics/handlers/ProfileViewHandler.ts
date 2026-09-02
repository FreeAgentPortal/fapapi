import crypto from 'crypto';
import mongoose from 'mongoose';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import { ModelMap } from '../../../../utils/ModelMap';
import { ProfileViewModel } from '../model/ProfileViewModel';
import {
  ProfileSubjectType,
  ProfileViewReport,
  ProfileViewSessionSource,
  ViewerProfileType,
} from '../types';

const VIEWER_TYPES: ViewerProfileType[] = ['team', 'scout', 'agent', 'athlete', 'professional', 'admin'];

const VIEWER_CONTEXTS: Record<
  string,
  { profileRef: string; modelKey: keyof typeof ModelMap; viewerType: ViewerProfileType; ownerField: string; supportsActive: boolean }
> = {
  team: { profileRef: 'team', modelKey: 'team', viewerType: 'team', ownerField: 'linkedUsers.user', supportsActive: true },
  athlete: { profileRef: 'athlete', modelKey: 'athlete', viewerType: 'athlete', ownerField: 'userId', supportsActive: true },
  professional: { profileRef: 'professional', modelKey: 'professional', viewerType: 'professional', ownerField: 'user', supportsActive: true },
  agent: { profileRef: 'agent', modelKey: 'agent', viewerType: 'agent', ownerField: 'user', supportsActive: true },
  admin: { profileRef: 'admin', modelKey: 'admin', viewerType: 'admin', ownerField: 'user', supportsActive: false },
  scout_profile: { profileRef: 'scout', modelKey: 'scout_profile', viewerType: 'scout', ownerField: 'user', supportsActive: true },
};

type TargetProfile = {
  profileId: mongoose.Types.ObjectId;
  ownerUserId: mongoose.Types.ObjectId;
};

type ViewerContext = {
  viewerUserId: mongoose.Types.ObjectId;
  viewerProfileId: mongoose.Types.ObjectId;
  viewerType: ViewerProfileType;
};

export type RecordProfileViewResult =
  | { counted: false; reason: 'duplicate_session' | 'self_view' }
  | {
      counted: true;
      viewId: string;
      recordedAt: string;
      subjectOwnerUserId: string;
      viewerType: ViewerProfileType;
    };

export class ProfileViewHandler {
  public async recordView(subjectType: ProfileSubjectType, subjectProfileId: string, req: AuthenticatedRequest): Promise<RecordProfileViewResult> {
    const viewer = await this.resolveViewerContext(req);
    const target = await this.resolveTargetProfile(subjectType, subjectProfileId);

    if (String(target.ownerUserId) === String(viewer.viewerUserId)) {
      return { counted: false, reason: 'self_view' };
    }

    const session = this.resolveSession(req);

    try {
      const view = await ProfileViewModel.create({
        subjectType,
        subjectProfileId: target.profileId,
        viewerUserId: viewer.viewerUserId,
        viewerProfileId: viewer.viewerProfileId,
        viewerType: viewer.viewerType,
        sessionHash: session.sessionHash,
        sessionSource: session.sessionSource,
      });

      return {
        counted: true,
        viewId: String(view._id),
        recordedAt: view.createdAt.toISOString(),
        subjectOwnerUserId: String(target.ownerUserId),
        viewerType: viewer.viewerType,
      };
    } catch (err: any) {
      if (err?.code === 11000) {
        return { counted: false, reason: 'duplicate_session' };
      }
      throw err;
    }
  }

  public async getReport(
    subjectType: ProfileSubjectType,
    subjectProfileId: string,
    ownerUserId: string,
    ownerProfileId: string | null | undefined,
    days: number
  ): Promise<ProfileViewReport> {
    const target = await this.resolveTargetProfile(subjectType, subjectProfileId);
    if (
      !ownerProfileId ||
      String(target.profileId) !== String(ownerProfileId) ||
      String(target.ownerUserId) !== String(ownerUserId)
    ) {
      throw new ErrorUtil('Only the profile owner can view profile analytics', 403);
    }

    const startDate = this.getUtcStartDate(days);
    const match = {
      subjectType,
      subjectProfileId: target.profileId,
      createdAt: { $gte: startDate },
    };

    const [totalViews, uniqueViewerRows, viewsByTypeRows, dailyRows] = await Promise.all([
      ProfileViewModel.countDocuments(match),
      ProfileViewModel.aggregate([
        { $match: match },
        { $group: { _id: { viewerType: '$viewerType', viewerProfileId: '$viewerProfileId' } } },
        { $count: 'count' },
      ]),
      ProfileViewModel.aggregate([
        { $match: match },
        { $group: { _id: '$viewerType', count: { $sum: 1 } } },
      ]),
      ProfileViewModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
            totalViews: { $sum: 1 },
            uniqueViewers: { $addToSet: { viewerType: '$viewerType', viewerProfileId: '$viewerProfileId' } },
          },
        },
        {
          $project: {
            _id: 1,
            totalViews: 1,
            uniqueViewers: { $size: '$uniqueViewers' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const viewsByType = VIEWER_TYPES.reduce(
      (result, viewerType) => ({ ...result, [viewerType]: 0 }),
      {} as Record<ViewerProfileType, number>
    );
    for (const row of viewsByTypeRows) {
      if (VIEWER_TYPES.includes(row._id)) {
        viewsByType[row._id as ViewerProfileType] = row.count;
      }
    }

    const dailyMap = new Map(dailyRows.map((row: any) => [row._id, row]));
    const dailyViews = Array.from({ length: days }, (_, index) => {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const row: any = dailyMap.get(dateKey);
      return {
        date: dateKey,
        totalViews: row?.totalViews ?? 0,
        uniqueViewers: row?.uniqueViewers ?? 0,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      subjectType,
      subjectProfileId: String(target.profileId),
      days,
      summary: {
        totalViews,
        uniqueViewers: uniqueViewerRows[0]?.count ?? 0,
      },
      viewsByType,
      dailyViews,
    };
  }

  private async resolveTargetProfile(subjectType: ProfileSubjectType, subjectProfileId: string): Promise<TargetProfile> {
    if (!mongoose.isValidObjectId(subjectProfileId)) {
      throw new ErrorUtil('Invalid profile id', 400);
    }

    const model = subjectType === 'athlete' ? ModelMap.athlete : ModelMap.professional;
    const ownerField = subjectType === 'athlete' ? 'userId' : 'user';
    const profile = await model
      .findOne({ _id: subjectProfileId, isActive: { $ne: false } })
      .select(`_id ${ownerField}`)
      .lean();

    const ownerUserId = profile?.[ownerField];
    if (!profile || !ownerUserId) {
      throw new ErrorUtil('Active profile with an owner was not found', 404);
    }

    return {
      profileId: new mongoose.Types.ObjectId(String(profile._id)),
      ownerUserId: new mongoose.Types.ObjectId(String(ownerUserId)),
    };
  }

  private async resolveViewerContext(req: AuthenticatedRequest): Promise<ViewerContext> {
    const serviceName = this.getFirstHeader(req.headers['x-service-name']);
    const context = serviceName ? VIEWER_CONTEXTS[serviceName] : undefined;
    if (!context) {
      throw new ErrorUtil('X-Service-Name must identify a supported viewer profile', 400);
    }

    const userId = req.user?._id;
    const profileId = req.user?.profileRefs?.[context.profileRef];
    if (!userId || !profileId || !mongoose.isValidObjectId(String(profileId))) {
      throw new ErrorUtil('Authenticated user does not have the selected viewer profile', 403);
    }

    const ownershipQuery: Record<string, unknown> = {
      _id: profileId,
      [context.ownerField]: userId,
    };
    if (context.supportsActive) {
      ownershipQuery.isActive = { $ne: false };
    }

    const profileExists = await ModelMap[context.modelKey].exists(ownershipQuery);
    if (!profileExists) {
      throw new ErrorUtil('Selected viewer profile is missing, inactive, or not owned by the authenticated user', 403);
    }

    return {
      viewerUserId: new mongoose.Types.ObjectId(String(userId)),
      viewerProfileId: new mongoose.Types.ObjectId(String(profileId)),
      viewerType: context.viewerType,
    };
  }

  private resolveSession(req: AuthenticatedRequest): { sessionHash: string; sessionSource: ProfileViewSessionSource } {
    const sessionId = this.getFirstHeader(req.headers['x-session-id'])?.trim();
    if (sessionId && sessionId.length > 256) {
      throw new ErrorUtil('X-Session-Id cannot exceed 256 characters', 400);
    }

    const authorization = this.getFirstHeader(req.headers.authorization);
    const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;
    const rawSession = sessionId || bearerToken;
    if (!rawSession) {
      throw new ErrorUtil('A session id or bearer token is required to track a profile view', 400);
    }

    return {
      sessionHash: crypto.createHash('sha256').update(rawSession).digest('hex'),
      sessionSource: sessionId ? 'header' : 'jwt',
    };
  }

  private getUtcStartDate(days: number): Date {
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    return startDate;
  }

  private getFirstHeader(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
