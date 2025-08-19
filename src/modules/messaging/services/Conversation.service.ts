import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { ConversationHandler } from '../handlers/Conversation.handler';
import error from '../../../middleware/error';
import { CRUDService } from '../../../utils/baseCRUD';
import { ConversationCrudHandler } from '../handlers/ConversationCrud.handler';
import { eventBus } from '../../../lib/eventBus';

export class ConversationService extends CRUDService {
  constructor(private readonly conversationHandler: ConversationHandler = new ConversationHandler()) {
    super(ConversationCrudHandler);
    this.requiresAuth = {
      startConversation: true,
      sendMessage: true,
      getConversations: true,
    };
    this.queryKeys = ['participants.team', 'participants.athlete'];
  }

  public startConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { athleteId, message } = req.body;
      const teamId = req.user.profileRefs['team'] as any;
      const userId = req.user._id;

      const { conversation, newMessage } = await this.conversationHandler.startConversation(teamId, athleteId, userId, message);

      eventBus.publish('conversation.started', { conversation: conversation });

      return res.status(201).json({ success: true, payload: conversation });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });

  public sendMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { conversationId } = req.params;
      const { message } = req.body;
      const userId = req.user._id;
      const profileId = req.user.profileRefs[req.query.role as string];
      const role = req.query.role as 'team' | 'athlete';

      if (!conversationId || !message || !userId || !profileId || !role) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const sentMessage = await this.conversationHandler.sendMessage(conversationId, userId, profileId, role, message);

      eventBus.publish('conversation.message', { message: sentMessage });

      return res.status(201).json({ success: true, payload: sentMessage });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });

  public getConversations = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const profileId = req.user.profileRefs[req.query.role as string];
      const role = req.query.role as 'team' | 'athlete';

      if (!userId || !profileId || !role) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const conversations = await this.conversationHandler.getConversationsForUser(userId, profileId, role);
      return res.status(200).json({ success: true, payload: conversations });
    } catch (err) {
      console.log(err);
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

      let isAuthenticated = false;

      if (req.query.role === 'athlete' && response.participants.athlete._id.toString() == profileId) {
        isAuthenticated = true;
      } else if (response.participants.team._id.toString() == profileId) {
        isAuthenticated = true;
      }
      if (!isAuthenticated) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      return res.status(200).json({ success: true, payload: response });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });
}
