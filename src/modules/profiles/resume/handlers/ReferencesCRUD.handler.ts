import { BaseResumeCRUDHandler } from '../utils/BaseResumeCRUDHandler';
export default class ReferencesCRUDHandler extends BaseResumeCRUDHandler {
  protected sectionName = 'references' as const;

  protected validateData(data: any) {
    return {
      name: data.name,
      role: data.role,
      organization: data.organization,
      contact: data.contact,
    };
  }

  protected buildUpdateFields(patch: any): string[] {
    return ['name', 'role', 'organization', 'contact'];
  }

  async addReference(ownerKind: any, ownerRef: string, data: any) {
    return this.addItem(ownerKind, ownerRef, data);
  }

  async updateReference(ownerKind: any, ownerRef: string, referenceId: string, patch: any) {
    return this.updateItem(ownerKind, ownerRef, referenceId, patch);
  }

  async removeReference(id: string, referenceId: string) {
    return this.removeItem(id, referenceId);
  }
}
