import { Request } from 'express';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import BillingAccount from '../../../auth/model/BillingAccount';
import { BillingValidator } from '../../../../utils/billingValidation';
import { IProfessionalProfile } from '../model/ProfessionalProfile';
import { ProfessionalHandler } from './Professional.handler';

/**
 * Handles creation, retrieval, and modification of athlete profiles.
 */
export class ProfileActionsHandler {
  async getProfile(data: any): Promise<IProfessionalProfile> {
    const crudHandler = new ProfessionalHandler(); 
    const profile = await crudHandler.fetch(data.id);
    if (!profile) throw new ErrorUtil('Unable to fetch Profile', 400);

    const billing = await BillingAccount.findOne({ profileId: profile._id });
    if (!billing) {
      throw new ErrorUtil('billing information not found', 400);
    }

    // Use the comprehensive billing validator
    const billingValidation = BillingValidator.validateBillingAccount(billing);

    return {
      ...profile,
      needsBillingSetup: billingValidation.needsUpdate,
      billingValidation,
    } as any as IProfessionalProfile;
  }
}
