import { BaseResumeCRUDHandler } from '../utils/BaseResumeCRUDHandler';

export default class QACRUDHandler extends BaseResumeCRUDHandler {
  protected sectionName = 'qa' as const;

  protected validateData(data: any) {
    return {
      promptId: data.promptId,
      question: data.question,
      answer: data.answer,
    };
  }

  protected buildUpdateFields(patch: any): string[] {
    return ['promptId', 'question', 'answer'];
  }

  async addQA(ownerKind: any, ownerRef: string, data: any) {
    return this.addItem(ownerKind, ownerRef, data);
  }

  async updateQA(ownerKind: any, ownerRef: string, qaId: string, patch: any) {
    return this.updateItem(ownerKind, ownerRef, qaId, patch);
  }

  async removeQA(id: string, qaId: string) {
    return this.removeItem(id, qaId);
  }
}
