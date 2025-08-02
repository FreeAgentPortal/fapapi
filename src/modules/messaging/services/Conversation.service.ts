import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { ConversationHandler } from '../handlers/Conversation.handler';
import error from '../../../middleware/error';
import { CRUDService } from '../../../utils/baseCRUD';
import { ConversationCrudHandler } from '../handlers/ConversationCrud.handler';

export class ConversationService extends CRUDService {
  constructor(private readonly conversationHandler: ConversationHandler = new ConversationHandler()) {
    super(ConversationCrudHandler);
    this.requiresAuth = {
      startConversation: true,
      sendMessage: true,
      getConversations: true,
    };
    this.queryKeys = ['participants.scout', 'participants.athlete'];
  }

  public startConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { athleteId, message } = req.body;
      const scoutId = req.user.profileRefs['scout'] as any;
      const userId = req.user._id;

      const conversation = await this.conversationHandler.startConversation(scoutId, athleteId, userId, message);
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
      const profileId = req.user.profileRefs[req.body.role];
      const role = req.body.role;

      if (!conversationId || !message || !userId || !profileId || !role) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const sentMessage = await this.conversationHandler.sendMessage(conversationId, userId, profileId, role, message);
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
      const role = req.query.role as 'scout' | 'athlete';

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
}
