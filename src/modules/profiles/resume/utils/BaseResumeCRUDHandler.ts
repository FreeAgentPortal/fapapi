import { Types } from 'mongoose';
import { CRUDHandler } from '../../../../utils/baseCRUD';
import { ModelKey, ModelMap } from '../../../../utils/ModelMap';
import { IResumeProfile, OwnerKind, ResumeProfile } from '../models/ResumeProfile';
import { refreshOwnerSnapshot } from './updateOwnerSnapshot';

export abstract class BaseResumeCRUDHandler extends CRUDHandler<IResumeProfile> {
  modelMap: Record<ModelKey, any>;
  protected abstract sectionName: keyof Pick<IResumeProfile, 'experiences' | 'education' | 'awards' | 'qa' | 'references' | 'media'>;
  protected abstract validateData(data: any): any;
  protected abstract buildUpdateFields(patch: any): string[];

  constructor() {
    super(ResumeProfile);
    this.modelMap = ModelMap;
  }

  /**
   * Get the resume for an owner, or create it if missing.
   * This enforces the (owner.kind, owner.ref) uniqueness.
   */
  async getOrCreateResume(ownerKind: OwnerKind, ownerRef: string): Promise<IResumeProfile> {
    // Try fast path
    console.log(ownerRef);
    const existing = await this.modelMap['resume'].findOne({
      'owner.kind': ownerKind,
      'owner.ref': ownerRef,
    });
    if (existing) {
      console.log(`[BaseResumeCRUDHandler] Found existing resume for ${ownerKind}/${ownerRef}`);
      return existing;
    }

    // Create atomically (handles race via unique index)
    return await this.modelMap['resume'].findOneAndUpdate(
      { 'owner.kind': ownerKind, 'owner.ref': ownerRef },
      {
        $setOnInsert: {
          owner: { kind: ownerKind, ref: ownerRef },
          experiences: [],
          education: [],
          awards: [],
          qa: [],
          references: [],
          media: [],
          visibility: 'public',
          version: 1,
        },
      },
      { upsert: true }
    );
  }

  /**
   * Add a new item to the resume section (atomic).
   * If `data._id` is absent, we generate one so the client can address it later.
   */
  async addItem(ownerKind: OwnerKind, ownerRef: string, data: any): Promise<IResumeProfile> {
    console.log(ownerKind, ownerRef, data);
    const resume = await this.getOrCreateResume(ownerKind, ownerRef);
    const itemId = data._id ? new Types.ObjectId(data._id) : new Types.ObjectId();

    const validatedData = this.validateData(data);
    const itemWithId = { _id: itemId, ...validatedData };

    const updated = await this.modelMap['resume'].findOneAndUpdate(
      { _id: resume._id },
      {
        $push: { [this.sectionName]: itemWithId },
        $inc: { version: 1 },
      },
      { new: true }
    );

    // refresh owner snapshot
    await refreshOwnerSnapshot(resume._id);

    return updated!;
  }

  /**
   * Update an existing item by its _id (atomic, positional via arrayFilters).
   * Only sets provided fields (partial patch).
   */
  async updateItem(ownerKind: OwnerKind, ownerRef: string, itemId: string, patch: any): Promise<IResumeProfile | null> {
    const resume = await this.getOrCreateResume(ownerKind, ownerRef);

    const updateDoc: Record<string, any> = {};
    const fields = this.buildUpdateFields(patch);

    // Build a minimal $set for the provided keys
    for (const k of fields) {
      if (patch[k] !== undefined) {
        updateDoc[`${this.sectionName}.$[item].${k}`] = patch[k];
      }
    }

    if (Object.keys(updateDoc).length === 0) {
      // nothing to update; return current doc
      return await this.modelMap['resume'].findById(resume._id);
    }

    const updated = await this.modelMap['resume'].findOneAndUpdate(
      { _id: resume._id },
      { $set: updateDoc, $inc: { version: 1 } },
      {
        arrayFilters: [{ 'item._id': new Types.ObjectId(itemId) }],
        new: true,
      }
    );

    // refreshes owner snapshot
    await refreshOwnerSnapshot(resume._id);

    return updated;
  }

  /**
   * Remove an item by its _id (atomic).
   */
  async removeItem(id: string, itemId: string): Promise<IResumeProfile | null> {
    const updated = await this.modelMap['resume'].findOneAndUpdate(
      { _id: id },
      {
        $pull: { [this.sectionName]: { _id: new Types.ObjectId(itemId) } },
        $inc: { version: 1 },
      },
      { new: true }
    );

    // refreshes owner snapshot
    await refreshOwnerSnapshot(updated._id);

    return updated;
  }

  /**
   * Get all items from this section for an owner
   */
  async getItems(ownerKind: OwnerKind, ownerRef: string): Promise<any[]> {
    const resume = await this.getOrCreateResume(ownerKind, ownerRef);
    return (resume as any)[this.sectionName] || [];
  }

  /**
   * Get a specific item by its _id
   */
  async getItem(ownerKind: OwnerKind, ownerRef: string, itemId: string): Promise<any | null> {
    const resume = await this.getOrCreateResume(ownerKind, ownerRef);
    const items = (resume as any)[this.sectionName] || [];
    return items.find((item: any) => item._id.toString() === itemId) || null;
  }
}
