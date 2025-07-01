import { Request, Response } from 'express';
import TeamProfileHandler from '../handlers/ProfileHandler';
import { eventBus } from '../../../lib/eventBus';
import { ITeamProfile } from '../model/TeamModel';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import AuthenticationHandler from '../handlers/AuthenticationHandler';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import error from '../../../middleware/error';

export default class TeamService {
  constructor(private readonly crudHandler: TeamProfileHandler = new TeamProfileHandler(), private readonly authHandler: AuthenticationHandler = new AuthenticationHandler()) {}
  public checkResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log(req);
      const exists = await this.authHandler.checkResourceExists(req);
      return res.status(200).json({
        exists,
      });
    } catch (err: any) {
      console.log(err);
      return res.status(500).json({ error: err.message });
    }
  };
  /**
   * Called internally during registration or profile bootstrapping.
   */
  async createProfile(data: any): Promise<ITeamProfile> {
    return await this.crudHandler.createProfile(data);
  }
  /**
   * Called from an HTTP route. Handles req/res and responds to client.
   */
  async createProfileFromRequest(req: Request, res: Response) {
    try {
      const data = req.body as any; // Adjust type as needed
      const profile = await this.crudHandler.createProfile(data);
      return res.status(201).json(profile);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  public getResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.crudHandler.fetch(req.params.id);
      if (!result) {
        return res.status(404).json({ message: 'Resource Not found' });
      }
      console.log(result);
      return res.status(200).json({
        success: true,
        payload: result,
      });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
  public getResources = async (req: Request, res: Response): Promise<Response> => {
    try {
      const pageSize = Number(req.query?.limit) || 10;
      const page = Number(req.query?.pageNumber) || 1;
      // Generate the keyword query
      const keywordQuery = AdvFilters.query(['name', 'coach', 'abbreviation', 'shortDisplayName'], req.query?.keyword as string);

      // Generate the filter options for inclusion if provided
      const filterIncludeOptions = AdvFilters.filter(req.query?.includeOptions as string);

      // Construct the `$or` array conditionally
      const orConditions = [
        ...(Object.keys(keywordQuery[0]).length > 0 ? keywordQuery : []),
        ...(Array.isArray(filterIncludeOptions) && filterIncludeOptions.length > 0 && Object.keys(filterIncludeOptions[0]).length > 0 ? filterIncludeOptions : []), // Only include if there are filters
      ];
      const [result] = await this.crudHandler.fetchAll({
        filters: AdvFilters.filter(req.query?.filterOptions as string),
        sort: AdvFilters.sort((req.query?.sortOptions as string) || '-createdAt'),
        query: orConditions,
        page,
        limit: pageSize,
      });
      return res.status(200).json({
        success: true,
        payload: [...result.entries],
        metadata: {
          page,
          pages: Math.ceil(result.metadata[0]?.totalCount / pageSize) || 0,
          totalCount: result.metadata[0]?.totalCount || 0,
          prevPage: page - 1,
          nextPage: page + 1,
        },
      });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
  public updateResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log(req.body);
      await this.crudHandler.update(req.params.id, req.body);
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
  public removeResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      await this.crudHandler.delete(req.params.id);
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
}
