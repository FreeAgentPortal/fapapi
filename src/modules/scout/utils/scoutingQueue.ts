import { PipelineStage } from 'mongoose';
import { SCOUT_FEATURE_ID } from './portfolioInput';

export function scoutingQueuePipeline(scoutId: any): PipelineStage[] {
  return [
    { $match: { withdrawn: false, latestSubmission: { $exists: true } } },
    { $lookup: { from: 'scoutsubmissions', localField: 'latestSubmission', foreignField: '_id', as: 'submission' } },
    { $unwind: '$submission' },
    { $lookup: { from: 'athleteprofiles', localField: 'athleteId', foreignField: '_id', as: 'athlete' } },
    { $unwind: '$athlete' },
    { $match: { 'athlete.isActive': { $ne: false } } },
    { $lookup: { from: 'users', localField: 'athlete.userId', foreignField: '_id', as: 'owner' } },
    { $unwind: '$owner' },
    { $match: { 'owner.isActive': { $ne: false } } },
    {
      $lookup: {
        from: 'billings',
        let: { athleteId: '$athleteId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$profileId', '$$athleteId'] } } },
          { $sort: { updatedAt: -1, _id: -1 } },
          { $limit: 1 },
          { $match: { status: { $in: ['active', 'trialing'] }, needsUpdate: { $ne: true } } },
          { $lookup: { from: 'plans', localField: 'plan', foreignField: '_id', as: 'plan' } },
          {
            $set: {
              effectiveFeatures: {
                $cond: [{ $eq: [{ $type: '$features' }, 'missing'] }, { $ifNull: [{ $arrayElemAt: ['$plan.features', 0] }, []] }, { $ifNull: ['$features', []] }],
              },
            },
          },
          { $match: { effectiveFeatures: SCOUT_FEATURE_ID } },
        ],
        as: 'billing',
      },
    },
    { $match: { 'billing.0': { $exists: true } } },
    {
      $lookup: {
        from: 'scoutreviews',
        let: { submissionId: '$latestSubmission' },
        pipeline: [{ $match: { $expr: { $eq: ['$submissionId', '$$submissionId'] }, scoutId } }],
        as: 'myReview',
      },
    },
    { $match: { 'myReview.0': { $exists: false } } },
    { $sort: { 'submission.submittedAt': 1, _id: 1 } },
    {
      $project: {
        _id: '$athleteId',
        athleteId: 1,
        fullName: '$submission.athlete.fullName',
        sport: '$submission.sport',
        position: '$submission.position',
        league: '$submission.athlete.league',
        profileImageUrl: '$owner.profileImageUrl',
        diamondRating: '$athlete.diamondRating',
        submissionId: '$submission._id',
        version: '$submission.version',
        submittedAt: '$submission.submittedAt',
        context: '$submission.context',
        itemCount: '$submission.itemCount',
        reviewerStatus: { $literal: 'available' },
        needsScouting: { $literal: true },
        scoutingPriority: { $literal: 'plan_included' },
      },
    },
  ];
}
