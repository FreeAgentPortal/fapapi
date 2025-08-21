import { Request, Response } from 'express';
import TeamProfileHandler from '../handlers/ProfileHandler';
import { eventBus } from '../../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import AuthenticationHandler from '../handlers/AuthenticationHandler';
import error from '../../../../middleware/error';
import { CRUDService } from '../../../../utils/baseCRUD';
import asyncHandler from '../../../../middleware/asyncHandler';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { ModelMap } from '../../../../utils/ModelMap';

export default class TeamService extends CRUDService {
  private modelMap: Record<string, any>;
  constructor(private readonly authHandler: AuthenticationHandler = new AuthenticationHandler()) {
    super(TeamProfileHandler);
    this.requiresAuth = {
      updateResource: true,
      create: true,
      validateToken: true,
    };
    this.queryKeys = ['name', 'description', 'tags'];
    this.modelMap = ModelMap;
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
      const profile = await this.handler.create({ ...teamData });

      // create a token hash in the database
      const { token } = await this.modelMap['token'].issue({
        type: 'TEAM_INVITE',
        teamProfileId: profile._id,
        ttlMs: 48 * 60 * 60 * 1000, // 48 hours
        uniquePerSubject: false,
      });

      // attach token to additionalData
      additionalData.token = token;

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

      const { isValid, team, token: validatedToken } = await this.handler.validateToken(token);
      // update team linkedUsers array with the user id, and set the claimToken and expiry to undefined
      await this.handler.attach(team._id, req.user._id);

      // consume the token so it cant be used again
      await this.modelMap['token'].consume(validatedToken._id);

      // event emitter to send a notification to the user
      eventBus.publish('team.token.validated', { userId: req.user.id, teamId: team._id });

      return res.status(200).json({ valid: isValid });
    } catch (err) {
      console.error('Error validating token:', err);
      return error(err, req, res);
    }
  });

  public inviteUserToTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      // get the team profile
      const team = await this.handler.fetch(req.params.id);
      if (!team) {
        return res.status(404).json({ message: 'Team not found' });
      }

      console.log(team);

      // create a token hash in the database
      const { token } = await this.modelMap['token'].issue({
        type: 'TEAM_INVITE',
        email: req.body.inviteeEmail,
        teamProfileId: team._id,
        ttlMs: 48 * 60 * 60 * 1000, // 48 hours
      });

      // send invitation email through the email service
      eventBus.publish('team.invited', { profile: team, invitationData: req.body, additionalData: { token } });

      return res.status(200).json({ message: 'User invited to team successfully' });
    } catch (err) {
      console.error('Error inviting user to team:', err);
      return error(err, req, res);
    }
  });

  public toggleFavoriteAthlete = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { athleteId } = req.params;
      const result = await this.handler.toggleFavoriteAthlete(req.user.profileRefs['team'] as any, athleteId);
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error('[TeamProfileService] Error toggling favorite athlete:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  public fetchFavoritedAthletes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.fetchFavoritedAthletes(req.user.profileRefs['team'] as any);
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error('[TeamProfileService] Error fetching favorited athletes:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
}
