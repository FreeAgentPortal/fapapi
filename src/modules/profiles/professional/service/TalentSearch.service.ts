import mongoose, { PipelineStage } from 'mongoose';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import TeamModel from '../../team/model/TeamModel';
import { ProfessionalProfileModel } from '../model/ProfessionalProfile';
import { ParsedTalentSearchQuery } from '../utils/talentSearchQuery';

export interface TalentSearchResult {
  payload: Record<string, unknown>[];
  metadata: {
    page: number;
    pages: number;
    totalCount: number;
    prevPage: number | null;
    nextPage: number | null;
  };
}

export default class TalentSearchService {
  public async authorizeTeam(user: AuthenticatedRequest['user'] | null | undefined): Promise<string> {
    const teamId = user?.profileRefs?.team;
    const userId = user?._id;

    if (
      !user ||
      user.isActive === false ||
      !Array.isArray(user.role) ||
     
      !teamId ||
      !userId ||
      !mongoose.Types.ObjectId.isValid(String(teamId))
    ) {
      console.log('Authorization failed for user:', user);
      console.trace();
      throw new ErrorUtil('Only active team users can search professional profiles', 403);
    }

    const team = await TeamModel.exists({
      _id: teamId,
      // isActive: { $ne: false },
      'linkedUsers.user': userId,
    });

    if (!team) {
      console.log('Team not found or user not linked to team:', { teamId, userId });
      console.trace();
      throw new ErrorUtil('Only active team users can search professional profiles', 403);
    }

    return String(team._id);
  }

  public async search(options: ParsedTalentSearchQuery): Promise<TalentSearchResult> {
    const pipeline = this.buildPipeline(options);
    const [result] = await ProfessionalProfileModel.aggregate(pipeline);
    const totalCount = result?.metadata?.[0]?.totalCount ?? 0;
    const pages = Math.ceil(totalCount / options.limit);

    return {
      payload: result?.entries ?? [],
      metadata: {
        page: options.page,
        pages,
        totalCount,
        prevPage: options.page > 1 ? options.page - 1 : null,
        nextPage: options.page < pages ? options.page + 1 : null,
      },
    };
  }

  public buildPipeline(options: ParsedTalentSearchQuery): PipelineStage[] {
    const mandatoryFilters: Record<string, unknown>[] = [
      { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
      { visibility: { $in: ['public', 'teams_only'] } },
      { jobSearchStatus: { $in: ['open', 'casual'] } },
      ...options.andFilters,
    ];

    if (options.includeFilters.length > 0) {
      mandatoryFilters.push({ $or: options.includeFilters });
    }

    const pipeline: PipelineStage[] = [
      { $match: { $and: mandatoryFilters } },
      {
        $lookup: {
          from: 'users',
          let: { ownerId: '$user' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$ownerId'] }, { $eq: ['$isActive', true] }],
                },
              },
            },
            { $project: { _id: 1, profileImageUrl: 1 } },
          ],
          as: '_owner',
        },
      },
      { $match: { '_owner.0': { $exists: true } } },
      { $set: { _owner: { $first: '$_owner' } } },
    ];

    if (options.keywordPattern) {
      const regexCondition = { $regex: options.keywordPattern, $options: 'i' };
      pipeline.push(
        {
          $match: {
            $or: [
              { displayName: regexCondition },
              { headline: regexCondition },
              { bio: regexCondition },
              { desiredRoles: regexCondition },
              { industries: regexCondition },
            ],
          },
        },
        {
          $addFields: {
            _searchScore: {
              $add: [
                this.regexScore('$displayName', options.keywordPattern, 5),
                this.regexScore('$headline', options.keywordPattern, 4),
                this.arrayRegexScore('$desiredRoles', options.keywordPattern, 3),
                this.arrayRegexScore('$industries', options.keywordPattern, 2),
                this.regexScore('$bio', options.keywordPattern, 1),
              ],
            },
          },
        },
        { $sort: { _searchScore: -1, updatedAt: -1, _id: 1 } }
      );
    } else {
      pipeline.push({ $sort: { updatedAt: -1, _id: 1 } });
    }

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'totalCount' }],
        entries: [
          { $skip: (options.page - 1) * options.limit },
          { $limit: options.limit },
          {
            $project: {
              _id: 1,
              user: 1,
              userId: '$user',
              profileType: { $literal: 'professional' },
              isActive: { $literal: true },
              displayName: 1,
              headline: 1,
              bio: 1,
              location: 1,
              desiredRoles: { $ifNull: ['$desiredRoles', []] },
              industries: { $ifNull: ['$industries', []] },
              experienceLevel: 1,
              openToRelocation: 1,
              openToRemote: 1,
              jobSearchStatus: 1,
              visibility: 1,
              avatarUrl: { $ifNull: ['$_owner.profileImageUrl', null] },
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
      },
    });

    return pipeline;
  }

  private regexScore(input: string, pattern: string, weight: number): Record<string, unknown> {
    return {
      $cond: [
        {
          $regexMatch: {
            input: { $ifNull: [input, ''] },
            regex: pattern,
            options: 'i',
          },
        },
        weight,
        0,
      ],
    };
  }

  private arrayRegexScore(input: string, pattern: string, weight: number): Record<string, unknown> {
    return {
      $cond: [
        {
          $anyElementTrue: [
            {
              $map: {
                input: { $ifNull: [input, []] },
                as: 'entry',
                in: {
                  $regexMatch: {
                    input: '$$entry',
                    regex: pattern,
                    options: 'i',
                  },
                },
              },
            },
          ],
        },
        weight,
        0,
      ],
    };
  }
}
