import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import { AgentHandler } from '../handlers/AgentHandler';

export default class AgentService {
  constructor(private readonly agentHandler: AgentHandler = new AgentHandler()) {}

  public getResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.agentHandler.fetchAgents(req.params.id);
      return res.status(400).json({ success: true, payload: result.agents });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
}
