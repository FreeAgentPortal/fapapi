import { CRUDHandler } from '../../../utils/baseCRUD';
import JobPostModel, { IJobPost } from '../models/JobPost';

export default class JobPostHandler extends CRUDHandler<IJobPost> {
  constructor() {
    super(JobPostModel);
  }

  async updateOwned(id: string, teamId: string, data: Partial<IJobPost>): Promise<IJobPost | null> {
    await this.beforeUpdate(id, data);
    const updated = await this.Schema.findOneAndUpdate({ _id: id, team: teamId }, data, {
      new: true,
      runValidators: true,
    });
    await this.afterUpdate(updated);
    return updated;
  }

  async deleteOwned(id: string, teamId: string): Promise<IJobPost | null> {
    await this.beforeDelete(id);
    const deleted = await this.Schema.findOneAndDelete({ _id: id, team: teamId });
    await this.afterDelete(deleted);
    return deleted;
  }
}
