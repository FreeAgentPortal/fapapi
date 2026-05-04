import { Request, Response } from 'express';
import { eventBus } from '../../../../lib/eventBus';
import error from '../../../../middleware/error';
import { AdvFilters } from '../../../../utils/advFilter/AdvFilters';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import asyncHandler from '../../../../middleware/asyncHandler';
import { AthleteProfileHandler, AthleteProfileInput } from '../handlers/AtheleteProfileHandler';
import { IAthlete } from '../models/AthleteModel';
import { CRUDService } from '../../../../utils/baseCRUD';

export default class AthleteService extends CRUDService {
  constructor() {
    super(AthleteProfileHandler);
    this.queryKeys = ['fullName', 'college'];
  }
  async createProfile(userId: string, data: AthleteProfileInput): Promise<IAthlete> {
    return await this.handler.create({ userId, ...data });
  }
}
