import { BaseResumeCRUDHandler } from '../utils/BaseResumeCRUDHandler';

export default class MediaCRUDHandler extends BaseResumeCRUDHandler {
  protected sectionName = 'media' as const;

  protected validateData(data: any) {
    return {
      kind: data.kind,
      url: data.url,
      label: data.label,
    };
  }

  protected buildUpdateFields(patch: any): string[] {
    return ['kind', 'url', 'label'];
  }

  async addMedia(ownerKind: any, ownerRef: string, data: any) {
    return this.addItem(ownerKind, ownerRef, data);
  }

  async updateMedia(ownerKind: any, ownerRef: string, mediaId: string, patch: any) {
    return this.updateItem(ownerKind, ownerRef, mediaId, patch);
  }

  async removeMedia(id: string, mediaId: string) {
    return this.removeItem(id, mediaId);
  }
}
