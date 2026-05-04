import { BaseResumeCRUDHandler } from '../utils/BaseResumeCRUDHandler';

export default class ExperienceCRUDHandler extends BaseResumeCRUDHandler {
  protected sectionName = 'experiences' as const;

  protected validateData(data: any) {
    return {
      orgName: data.orgName,
      league: data.league,
      level: data.level,
      position: data.position,
      location: data.location,
      startDate: data.startDate,
      endDate: data.endDate,
      achievements: data.achievements ?? [],
      stats: data.stats ?? {},
      media: data.media ?? [],
    };
  }

  protected buildUpdateFields(patch: any): string[] {
    return ['orgName', 'league', 'level', 'position', 'location', 'startDate', 'endDate', 'achievements', 'stats', 'media'];
  }

  // Keep your existing methods for backward compatibility
  async addExperience(ownerKind: any, ownerRef: string, data: any) {
    return this.addItem(ownerKind, ownerRef, data);
  }

  async updateExperience(ownerKind: any, ownerRef: string, experienceId: string, patch: any) {
    return this.updateItem(ownerKind, ownerRef, experienceId, patch);
  }

  async removeExperience(id: string, experienceId: string) {
    return this.removeItem(id, experienceId);
  }
}
