import { Request } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import SupportGroup, { SupportGroupType } from '../models/SupportGroups';

export class SupportHandler {
  async createSupportGroup(data: SupportGroupType) {
    const group = await SupportGroup.create(data);
    if (!group) {
      const error: any = new Error('Support Group not created');
      error.status = 400;
      throw error;
    }
    return { success: true };
  }
}
