import { BaseResumeCRUDHandler } from '../utils/BaseResumeCRUDHandler';

export default class EducationCRUDHandler extends BaseResumeCRUDHandler {
  protected sectionName = 'education' as const;

  protected validateData(data: any) {
    return {
      school: data.school,
      degreeOrProgram: data.degreeOrProgram,
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes,
    };
  }

  protected buildUpdateFields(patch: any): string[] {
    return ['school', 'degreeOrProgram', 'startDate', 'endDate', 'notes'];
  }

  // Convenience methods with specific naming
  async addEducation(ownerKind: any, ownerRef: string, data: any) {
    return this.addItem(ownerKind, ownerRef, data);
  }

  async updateEducation(ownerKind: any, ownerRef: string, educationId: string, patch: any) {
    return this.updateItem(ownerKind, ownerRef, educationId, patch);
  }

  async removeEducation(id: string, educationId: string) {
    return this.removeItem(id, educationId);
  }
}
