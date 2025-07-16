import { Request } from 'express';
import { IAthlete } from '../models/AthleteModel';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import BillingAccount from '../../auth/model/BillingAccount';
import { AthleteProfileHandler } from './AtheleteProfileHandler';
import { CRUDHandler } from '../../../utils/baseCRUD';

/**
 * Handles creation, retrieval, and modification of athlete profiles.
 */
export class ProfileActionsHandler {
  async getProfile(data: any): Promise<IAthlete> {
    const crudHandler = new AthleteProfileHandler();
    const profile = await crudHandler.fetch(data.id);
    if (!profile) throw new ErrorUtil('Unable to fetch Profile', 400);
    const billing = await BillingAccount.findOne({ profileId: profile._id });
    if (!billing) {
      throw new ErrorUtil('billing information not found', 400);
    }
    return {
      ...profile,
      needsBillingSetup: billing.needsUpdate,
    } as any as IAthlete;
  }
}
