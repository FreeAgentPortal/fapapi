import { Request, Response } from 'express';
import TeamProfileHandler from '../handlers/ProfileHandler';
import { eventBus } from '../../../../lib/eventBus';
import { ITeamProfile } from '../model/TeamModel';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import AuthenticationHandler from '../handlers/AuthenticationHandler';
import { AdvFilters } from '../../../../utils/advFilter/AdvFilters';
import error from '../../../../middleware/error';
import { CRUDService } from '../../../../utils/baseCRUD';
import asyncHandler from '../../../../middleware/asyncHandler';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import mongoose from 'mongoose';

export default class TeamService extends CRUDService {
  constructor(private readonly authHandler: AuthenticationHandler = new AuthenticationHandler()) {
    super(TeamProfileHandler);
    this.requiresAuth = {
      updateResource: true,
      create: true,
      validateToken: true,
    };
    this.queryKeys = ['name', 'description', 'tags'];
  }
  public checkResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const exists = await this.authHandler.checkResourceExists(req);
      return res.status(200).json({
        exists,
      });
    } catch (err: any) {
      console.log(err);
      return res.status(500).json({ error: err.message });
    }
  };
  public createInternal = async (userId: string, data: any) => {
    try {
      return await this.handler.create(data);
    } catch (error: any) {
      console.error('Error creating team profile:', error);
      throw new ErrorUtil('Failed to create team profile', 400);
    }
  };

  public inviteTeam = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    try {
      const { teamData, invitationData, additionalData } = req.body;
      // creates the team profile
      const profile = await this.handler.inviteTeam({ ...teamData });

      // send invitation email through the email service
      eventBus.publish('team.invited', { profile, invitationData, additionalData });

      return res.status(201).json(profile);
    } catch (err) {
      console.error('Error inviting team:', err);
      return error(err, req, res);
    }
  });

  public validateToken = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { token } = req.body;

      const { isValid, team } = await this.handler.validateToken(token);
      // update team linkedUsers array with the user id, and set the claimToken and expiry to undefined
      await this.handler.attach(team._id, req.user._id);

      // event emitter to send a notification to the user
      eventBus.publish('team.token.validated', { userId: req.user.id, teamId: team._id });

      return res.status(200).json({ valid: isValid });
    } catch (err) {
      console.error('Error validating token:', err);
      return error(err, req, res);
    }
  });
}
