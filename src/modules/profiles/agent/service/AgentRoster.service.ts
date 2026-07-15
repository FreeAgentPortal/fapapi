import { Response } from 'express';
import asyncHandler from '../../../../middleware/asyncHandler';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import error from '../../../../middleware/error';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import { AgentRosterHandler } from '../handlers/AgentRoster.handler';
import { eventBus } from '../../../../lib/eventBus';

export interface AthleteRepresentationInviteNotificationEvent {
  assignmentId: string;
  athleteProfileId: string;
  athleteUserId?: string;
  agentProfileId: string;
  invitedByUserId: string;
  message?: string;
}

export async function publishAthleteRepresentationInviteNotification(
  event: AthleteRepresentationInviteNotificationEvent
): Promise<void> {
  try {
    await eventBus.publish('athlete.representation.invited', event);
  } catch (error) {
    console.error('[Profiles - Agent] Failed to publish athlete representation invite notification:', error);
  }
}

export class AgentRosterService {
  constructor(private readonly handler: AgentRosterHandler = new AgentRosterHandler()) {}

  public getRoster = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.getRoster(this.requireProfileRef(req, 'agent'));
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public getSeatSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.getSeatSummary(this.requireProfileRef(req, 'agent'));
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res); 
    }
  });

  public inviteAthlete = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.inviteAthlete(this.requireProfileRef(req, 'agent'), req.user._id, req.body);
      await publishAthleteRepresentationInviteNotification({
        assignmentId: result._id.toString(),
        athleteProfileId: result.athleteProfile.toString(),
        athleteUserId: result.athleteUser?.toString(),
        agentProfileId: result.agentProfile.toString(),
        invitedByUserId: result.invitedBy ? result.invitedBy.toString() : req.user._id.toString(),
        message: result.message,
      });
      return res.status(201).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public getMyInvitations = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.getAthleteInvitations(this.requireProfileRef(req, 'athlete'));
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public getMyInvitationCount = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const pendingInviteCount = await this.handler.getAthleteInvitationCount(this.requireProfileRef(req, 'athlete'));
      return res.status(200).json({ success: true, payload: { pendingInviteCount } });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public respondToInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.respondToInvitation(this.requireProfileRef(req, 'athlete'), req.params.invitationId, req.body.action);
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public removeAthlete = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.removeAthlete(this.requireProfileRef(req, 'agent'), req.params.assignmentId);
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public removeMyAgent = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.removeMyAgent(this.requireProfileRef(req, 'athlete'));
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  private requireProfileRef(req: AuthenticatedRequest, role: 'agent' | 'athlete'): string {
    const profileId = req.user?.profileRefs?.[role];
    if (!profileId) {
      throw new ErrorUtil(`Authenticated user does not have a ${role} profile.`, 403);
    }
    return profileId;
  }
}
