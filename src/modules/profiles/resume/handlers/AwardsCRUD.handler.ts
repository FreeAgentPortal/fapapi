import { BaseResumeCRUDHandler } from '../utils/BaseResumeCRUDHandler';

export default class AwardsCRUDHandler extends BaseResumeCRUDHandler {
  protected sectionName = 'awards' as const;

  protected validateData(data: any) {
    return {
      title: data.title,
      org: data.org,
      year: data.year,
      description: data.description,
    };
  }

  protected buildUpdateFields(patch: any): string[] {
    return ['title', 'org', 'year', 'description'];
  }

  async addAward(ownerKind: any, ownerRef: string, data: any) {
    return this.addItem(ownerKind, ownerRef, data);
  }

  async updateAward(ownerKind: any, ownerRef: string, awardId: string, patch: any) {
    return this.updateItem(ownerKind, ownerRef, awardId, patch);
  }

  async removeAward(id: string, awardId: string) {
    return this.removeItem(id, awardId);
  }
}
