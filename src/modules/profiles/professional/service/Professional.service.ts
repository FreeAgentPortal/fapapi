// services/AdminService.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import { CRUDService } from '../../../../utils/baseCRUD';
import error from '../../../../middleware/error';
import { RolesConfig } from '../../../../utils/RolesConfig';
import { ProfessionalHandler } from '../handlers/Professional.handler';

export default class ProfessionalService extends CRUDService {
  constructor() {
    super(ProfessionalHandler);
    this.queryKeys = ['permissions'];
    this.requiresAuth = {
      create: true,
      getResources: true,
      getResource: true,
      updateResource: true,
      removeResource: true,
    };
  }
}
