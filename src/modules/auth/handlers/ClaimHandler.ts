import { ErrorUtil } from '../../../middleware/ErrorUtil';  
import { CRUDHandler } from '../../../utils/baseCRUD';
import ClaimSchema, { ClaimType } from '../model/ClaimSchema';

export class ClaimHandler extends CRUDHandler<ClaimType> {
  constructor() {
    super(ClaimSchema);
  }

}
