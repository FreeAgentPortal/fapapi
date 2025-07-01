import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import { TicketHandler } from '../handlers/TicketHandler';
import authenticateUser from '../../../utils/authenticateUser';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { CRUDService } from '../../../utils/baseCRUD';

export default class TicketService extends CRUDService {
  constructor() {
    super(TicketHandler);
  }

  protected async beforeCreate(data: any): Promise<void> {
      // try to authenticate the user
      const user = await authenticateUser(data.user);
      if(user){
        data.user = user; // Attach the user to the data
      }
  }
}
