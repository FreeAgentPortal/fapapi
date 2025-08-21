import { CRUDHandler } from '../../../../utils/baseCRUD';
import { ModelMap } from '../../../../utils/ModelMap';
import { IResumeProfile, ResumeProfile } from '../models/ResumeProfile';

export default class ResumeCRUDHandler extends CRUDHandler<IResumeProfile> {
  modelMap: Record<string, any>;
  constructor() {
    super(ResumeProfile);
    this.modelMap = ModelMap;
  }
}
