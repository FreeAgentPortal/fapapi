import { Request } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import User from '../../auth/model/User';
import { ObjectId } from 'mongoose';
import Support from '../models/Support';
import SupportGroup from '../models/SupportGroups';

export class AgentHandler {
  async fetchAgents(ticketId: string) {
    // Find the ticket by ID
    const ticket = await Support.findById(ticketId);
    if (!ticket) {
      const error: any = new Error('Ticket not found');
      error.status = 404;
      throw error;
    }

    // Find the support groups the ticket belongs to
    const groups = await SupportGroup.find({ _id: { $in: ticket.groups } });
    if (groups.length === 0) {
      const error: any = new Error('No associated support groups found');
      error.status = 404;
      throw error;
    }

    // Inflate all agents from the support groups
    const agentIds = groups.reduce<ObjectId[]>((acc, group) => {
      if (group.agents && Array.isArray(group.agents)) {
        acc.push(...(group.agents as unknown as ObjectId[]));
      }
      return acc;
    }, []);

    // Remove duplicate agent IDs
    const uniqueAgentIds = [...new Set(agentIds)];

    // Fetch detailed agent information
    const uniqueAgents = await User.find({ _id: { $in: uniqueAgentIds } }).select('fullName email _id');

    return { agents: uniqueAgents };
  }
}
