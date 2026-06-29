import { CRUDHandler, PaginationOptions } from '../../../../utils/baseCRUD'; 
import { AgentAthleteAssignmentModel } from '../model/AgentAthleteAssignment'; 
import { IAgentAthleteAssignment } from '../model/AgentAthleteAssignment';

export class AthleteAssignmentCRUDHandler extends CRUDHandler<IAgentAthleteAssignment> {
  constructor() {
    super(AgentAthleteAssignmentModel);
  } 

  async fetchAll(options: PaginationOptions): Promise<{ entries: IAgentAthleteAssignment[]; metadata: any[] }[]> {
    return await this.Schema.aggregate([
      {
        $match: {
          $and: [...options.filters],
          ...(options.query.length > 0 && { $or: options.query }),
        },
      },
      { $sort: options.sort },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page: options.page, limit: options.limit } }],
          entries: [
            { $skip: (options.page - 1) * options.limit },
            { $limit: options.limit },
            {
              $lookup: {
                from: 'agentprofiles',
                localField: 'agentProfile',
                foreignField: '_id',
                as: 'agentProfile',
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      displayName: 1,
                      agencyName: 1,
                      avatarUrl: 1,
                      headline: 1,
                      organization: 1,
                      location: 1,
                      sports: 1,
                      specialties: 1,
                      certifications: 1,
                      email: 1,
                      contactNumber: 1,
                      slug: 1,
                      socialLinks: 1,
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: '$agentProfile',
                preserveNullAndEmptyArrays: true,
              },
            } 
          ],
        },
      },
    ]);
  }
 
}
