import mongoose from 'mongoose';
import { UploadedFile } from 'express-fileupload';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler } from '../../../utils/baseCRUD';
import SponsorModel, { ISponsor, SponsorLogo } from '../models/Sponsor';
import { parseSponsorInput } from '../utils/sponsorInput';
import { SponsorLogoHandler } from './SponsorLogoHandler';

export interface SponsorMutation {
  fields: unknown;
  actorId: string;
  file?: UploadedFile;
}

export class SponsorHandler extends CRUDHandler<ISponsor> {
  private logos = new SponsorLogoHandler();

  constructor() {
    super(SponsorModel);
  }

  async create({ fields: input, actorId, file }: SponsorMutation): Promise<ISponsor> {
    this.requireActor(actorId);
    const { altText, ...fields } = parseSponsorInput(input);
    if (!file) throw new ErrorUtil('A logo file is required in the logo form field', 400);

    const sponsor = new this.Schema({ ...fields, createdBy: actorId, updatedBy: actorId });
    // Reject invalid business fields before uploading; the complete document is validated by create.
    await sponsor.validate({ pathsToSkip: ['logo'] });
    const id = String(sponsor._id);
    const logo = await this.logos.upload(file, id);
    try {
      return await super.create({ ...sponsor.toObject(), logo: { ...logo, altText } });
    } catch (err) {
      await this.logos.cleanup(logo.publicId, id);
      throw err;
    }
  }

  async fetch(id: string): Promise<ISponsor | null> {
    this.requireId(id);
    return super.fetch(id);
  }

  async fetchVisible() {
    const now = new Date();
    return this.Schema.find({
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
      ],
    })
      .select('_id businessName websiteUrl logo.url logo.altText displayOrder')
      .sort({ displayOrder: 1, _id: 1 })
      .lean();
  }

  async update(id: string, { fields: input, actorId, file }: SponsorMutation): Promise<ISponsor> {
    this.requireId(id);
    this.requireActor(actorId);
    const fields = parseSponsorInput(input);
    if (!file && Object.keys(fields).length === 0) throw new ErrorUtil('No sponsor changes provided', 400);

    const sponsor = await this.Schema.findById(id);
    if (!sponsor) throw new ErrorUtil('Sponsor not found', 404);
    const previousPublicId = sponsor.logo.publicId;
    const { altText, ...metadata } = fields;
    sponsor.set({ ...metadata, updatedBy: actorId });
    if (altText !== undefined) sponsor.set('logo.altText', altText);
    // Validate the merged document, including dates omitted from the request.
    await sponsor.validate();

    let uploaded: SponsorLogo | undefined;
    try {
      if (file) {
        uploaded = await this.logos.upload(file, id);
        sponsor.set('logo', { ...uploaded, altText: sponsor.logo.altText });
      }
      await sponsor.save();
    } catch (err) {
      if (uploaded) await this.logos.cleanup(uploaded.publicId, id);
      if (err instanceof mongoose.Error.VersionError || err instanceof mongoose.Error.DocumentNotFoundError) {
        throw new ErrorUtil('Sponsor changed during this request; reload and try again', 409);
      }
      throw err;
    }

    if (uploaded && previousPublicId !== uploaded.publicId) await this.logos.cleanup(previousPublicId, id);
    return sponsor;
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const sponsor = await this.fetch(id);
    if (!sponsor) throw new ErrorUtil('Sponsor not found', 404);
    // Avoid removing a logo belonging to a concurrent replacement.
    const removed = await this.Schema.findOneAndDelete({ _id: id, __v: sponsor.__v });
    if (!removed) throw new ErrorUtil('Sponsor changed during this request; reload and try again', 409);
    await this.logos.cleanup(sponsor.logo.publicId, id);
    return { success: true };
  }

  private requireId(id: string): void {
    if (!mongoose.isObjectIdOrHexString(id)) throw new ErrorUtil('Invalid sponsor ID', 400);
  }

  private requireActor(id: string): void {
    if (!mongoose.isObjectIdOrHexString(id)) throw new ErrorUtil('An authenticated admin user is required', 401);
  }
}
