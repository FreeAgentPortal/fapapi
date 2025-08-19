import { CRUDHandler } from '../../../../utils/baseCRUD';
import { ModelMap } from '../../../../utils/ModelMap';
import { IResumeProfile, ResumeProfile } from '../models/ResumeProfile';

export default class ResumeCRUDHandler extends CRUDHandler<IResumeProfile> {
  modelMap: Record<string, any>;
  constructor() {
    super(ResumeProfile);
    this.modelMap = ModelMap;
  }

  public getOrCreateResume = async (athleteId: string): Promise<IResumeProfile> => {
    let resume = await this.Schema.findOne({ athleteId });
    if (!resume) {
      resume = await this.Schema.create({ athleteId, experiences: [], education: [], awards: [], qa: [], references: [], media: [] });
    }
    return resume;
  };
}
