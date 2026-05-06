import mongoose, { Document } from 'mongoose';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { CRUDHandler, PaginationOptions } from '../../../../utils/baseCRUD';
import { RolesConfig } from '../../../../utils/RolesConfig';
import { IProfessionalProfile, ProfessionalProfileModel } from '../model/ProfessionalProfile';

export class ProfessionalHandler extends CRUDHandler<IProfessionalProfile> {
  constructor() {
    super(ProfessionalProfileModel);
  }
}
