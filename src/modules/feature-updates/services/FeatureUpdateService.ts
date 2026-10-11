import mongoose from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import FeatureUpdate, { IFeatureUpdate } from '../models/FeatureUpdate';
import PortalSettings, { appIdForPortal, DEFAULT_FEATURE_UPDATE_TITLE } from '../models/FeatureUpdatePortal';
import { FEATURE_UPDATE_PORTALS, FeatureUpdatesConfig } from '../types';
import { inputObject, parseFeatureUpdateInput, parseTitle, requirePortal, requireRevision } from '../utils/featureUpdateInput';

export class FeatureUpdateService {
  async getPublicConfig(portalInput: unknown): Promise<FeatureUpdatesConfig> {
    const portal = requirePortal(portalInput);
    const [settings, items] = await Promise.all([
      PortalSettings.findOne({ portal }).lean(),
      FeatureUpdate.find({ belongs_to: portal, enabled: true })
        .select('key name description releasedAt badge highlights media action enabled -_id')
        .sort({ displayOrder: 1, releasedAt: -1, _id: 1 }).lean(),
    ]);
    return { appId: appIdForPortal(portal), title: settings?.title ?? DEFAULT_FEATURE_UPDATE_TITLE, items };
  }

  async list(query: Record<string, unknown>) {
    const portal = query.belongs_to === undefined ? undefined : requirePortal(query.belongs_to);
    const pageNumber = this.pageValue(query.pageNumber, 1, Number.MAX_SAFE_INTEGER);
    const pageLimit = this.pageValue(query.pageLimit, 20, 100);
    const skip = (pageNumber - 1) * pageLimit;
    if (!Number.isSafeInteger(skip)) throw new ErrorUtil('Pagination offset is too large', 400);
    const filter = portal ? { belongs_to: portal } : {};
    const [entries, totalCount] = await Promise.all([
      FeatureUpdate.find(filter).sort({ displayOrder: 1, releasedAt: -1, _id: 1 }).skip(skip).limit(pageLimit),
      FeatureUpdate.countDocuments(filter),
    ]);
    return { entries: entries.map(entry => this.adminView(entry)), totalCount, pageNumber, pageLimit };
  }

  async get(id: string) { return this.adminView(await this.find(id)); }

  async create(input: unknown, actorId: unknown) {
    this.requireActor(actorId);
    const fields = parseFeatureUpdateInput(input);
    return this.adminView(await FeatureUpdate.create({ ...fields, createdBy: actorId, updatedBy: actorId }));
  }

  async update(id: string, input: unknown, actorId: unknown) {
    this.requireActor(actorId);
    const body = inputObject(input, ['revision', 'name', 'description', 'releasedAt', 'badge', 'highlights', 'media', 'action', 'enabled', 'belongs_to', 'displayOrder']);
    const { revision: rawRevision, ...changes } = body;
    const revision = requireRevision(rawRevision);
    const fields = parseFeatureUpdateInput(changes, true);
    const item = await this.find(id);
    if (item.__v !== revision) throw this.conflict();
    item.set({ ...fields, updatedBy: actorId });
    try {
      await item.save();
    } catch (error) {
      if (error instanceof mongoose.Error.VersionError || error instanceof mongoose.Error.DocumentNotFoundError) throw this.conflict();
      throw error;
    }
    return this.adminView(item);
  }

  async remove(id: string, revisionInput: unknown) {
    const revision = requireRevision(revisionInput);
    const item = await this.find(id);
    if (item.__v !== revision) throw this.conflict();
    const removed = await FeatureUpdate.findOneAndDelete({ _id: id, __v: revision });
    if (!removed) throw this.conflict();
  }

  async getPortals() {
    const settings = await PortalSettings.find().lean();
    return FEATURE_UPDATE_PORTALS.map(portal => ({
      portal, appId: appIdForPortal(portal),
      title: settings.find(setting => setting.portal === portal)?.title ?? DEFAULT_FEATURE_UPDATE_TITLE,
    }));
  }

  async savePortalTitle(portalInput: unknown, input: unknown) {
    const portal = requirePortal(portalInput);
    const body = inputObject(input, ['title']);
    const title = parseTitle(body.title);
    await PortalSettings.findOneAndUpdate({ portal }, { $set: { title } }, { upsert: true, runValidators: true });
    return { portal, appId: appIdForPortal(portal), title };
  }

  private async find(id: string) {
    if (!mongoose.isObjectIdOrHexString(id)) throw new ErrorUtil('Invalid announcement ID', 400);
    const item = await FeatureUpdate.findById(id);
    if (!item) throw new ErrorUtil('Announcement not found', 404);
    return item;
  }

  private adminView(item: IFeatureUpdate) {
    const { __v, ...fields } = item.toObject();
    return { ...fields, revision: __v };
  }

  private conflict() { return new ErrorUtil('Announcement changed; reload it before saving or deleting', 409); }

  private requireActor(actorId: unknown) {
    if (!mongoose.isObjectIdOrHexString(actorId)) throw new ErrorUtil('An authenticated admin user is required', 401);
  }

  private pageValue(input: unknown, fallback: number, max: number): number {
    if (input === undefined) return fallback;
    if (typeof input !== 'string' || !/^[1-9]\d*$/.test(input)) throw new ErrorUtil('Invalid pagination', 400);
    const value = Number(input);
    if (!Number.isSafeInteger(value) || value > max) throw new ErrorUtil('Invalid pagination; pageLimit cannot exceed 100', 400);
    return value;
  }
}
