import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { ConversationHandler } from '../handlers/Conversation.handler';
import error from '../../../middleware/error';
import { CRUDService } from '../../../utils/baseCRUD';
import { ConversationCrudHandler } from '../handlers/ConversationCrud.handler';
import { eventBus } from '../../../lib/eventBus';
import { AgentConversationService } from './AgentConversation.service';
import { RepresentativeConversationService } from './RepresentativeConversation.service';

export class ConversationService extends CRUDService {
  constructor(private readonly conversationHandler: ConversationHandler = new ConversationHandler()) {
    super(ConversationCrudHandler);
    this.requiresAuth = {
      startConversation: true,
      sendMessage: true,
      getConversations: true,
      removeMessage: true,
    };
    this.queryKeys = ['participants.team', 'participants.athlete'];
  }

  public startConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      if (req.body.representativeId !== undefined) {
        const role = req.query.role;
        if (role !== 'team' && role !== 'agent') return res.status(400).json({ message: 'Only teams and agents can contact representatives.' });
        const senderId = req.user.profileRefs[role];
        if (!senderId) return res.status(403).json({ message: 'A sender profile is required.' });
        const result = await new RepresentativeConversationService().start(String(senderId), role, req.body);
        if (result.newMessage) eventBus.publish('conversation.message', { message: result.newMessage });
        return res.status(result.existing ? 200 : 201).json({ success: true, payload: result.conversation, existing: result.existing });
      }
      if (req.query.role === 'agent') {
        const agentId = req.user.profileRefs.agent;
        if (!agentId) return res.status(403).json({ message: 'An agent profile is required.' });
        const result = await new AgentConversationService().start(String(agentId), req.body);
        // The legacy conversation.started event sends a team-specific welcome.
        // Agent-initiated threads use the role-aware new-message notification.
        if (result.newMessage) eventBus.publish('conversation.message', { message: result.newMessage });
        return res.status(result.existing ? 200 : 201).json({ success: true, payload: result.conversation, existing: result.existing });
      }
      if (req.query.role && req.query.role !== 'team') return res.status(400).json({ message: 'Only teams and agents can start conversations.' });
      const { athleteId, message } = req.body;
      if (!req.user.profileRefs.team) return res.status(403).json({ message: 'A team profile is required.' });
      if (typeof athleteId !== 'string' || typeof message !== 'string' || !message.trim()) return res.status(400).json({ message: 'An athlete and initial message are required.' });
      const teamId = req.user.profileRefs['team'] as any;
      const userId = req.user._id;

      const { conversation, newMessage } = await this.conversationHandler.startConversation(teamId, athleteId, userId, message);

      eventBus.publish('conversation.started', { conversation: conversation });
      eventBus.publish('conversation.message', { message: newMessage });

      return res.status(201).json({ success: true, payload: conversation });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public sendMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { conversationId } = req.params;
      const { message } = req.body;
      const userId = req.user._id;
      const profileId = req.user.profileRefs[req.query.role as string];
      const role = req.query.role as 'team' | 'athlete' | 'agent';

      if (!conversationId || typeof message !== 'string' || !message.trim() || !userId || !profileId || !['team', 'athlete', 'agent'].includes(role)) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const sentMessage = await this.conversationHandler.sendMessage(conversationId, userId, profileId, role, message);

      eventBus.publish('conversation.message', { message: sentMessage });

      return res.status(201).json({ success: true, payload: sentMessage });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public getConversations = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const profileId = req.user.profileRefs[req.query.role as string];
      const role = req.query.role as 'team' | 'athlete' | 'agent';

      if (!userId || !profileId || !['team', 'athlete', 'agent'].includes(role)) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const conversations = await this.conversationHandler.getConversationsForUser(userId, profileId, role);
      return res.status(200).json({ success: true, payload: conversations });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public getUnreadConversationCount = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const role = req.query.role;
      if (role !== 'team' && role !== 'athlete' && role !== 'agent') {
        return res.status(400).json({ message: 'role must be team, athlete, or agent' });
      }

      const profileId = req.user.profileRefs[role];
      if (!profileId) {
        return res.status(403).json({ message: `Authenticated user does not have a ${role} profile.` });
      }

      const unreadConversationCount = await this.conversationHandler.getUnreadConversationCount(profileId, role);
      return res.status(200).json({ success: true, payload: { count: unreadConversationCount } });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public getConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { conversationId } = req.params;

      const profileId = req.user.profileRefs[req.query.role as string];

      if (!conversationId || !profileId) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const response = await this.conversationHandler.getConversation(conversationId);

      const role = req.query.role;
      const isAuthenticated =
        (role === 'athlete' && (!response.participants.team || !response.participants.agent) && response.participants.athlete?._id.toString() === String(profileId)) ||
        (role === 'agent' && (response.participants.agent?._id.toString() === String(profileId) || response.participants.agents?.some(agent => String(agent._id) === String(profileId)))) ||
        (role === 'team' && response.participants.team?._id.toString() === String(profileId));
      if (!isAuthenticated) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      return res.status(200).json({ success: true, payload: { ...response, viewerProfileId: String(profileId) } });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public removeMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
      await this.handler.archiveMessage(id, req.query.messageId as string);
      return res.status(200).json({ success: true, message: 'Message archived successfully' });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });
}
