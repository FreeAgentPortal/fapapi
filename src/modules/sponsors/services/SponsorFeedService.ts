import mongoose from 'mongoose';
import { UploadedFile } from 'express-fileupload';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import SponsorModel, { SponsorFeedAd } from '../models/Sponsor';
import { SponsorLogoHandler } from '../handlers/SponsorLogoHandler';
import { SponsorFeedEventModel } from '../models/SponsorFeedEvent';
import { readPlacementToken, issuePlacementToken } from '../utils/placementToken';
import { SponsorFeedMeasurementService } from './SponsorFeedMeasurementService';

export interface EligibleSponsor {
  _id: string;
  businessName: string;
  logo: { url: string; altText?: string };
  feedAd: Omit<SponsorFeedAd, 'image'> & { image: { url: string; altText?: string } };
}

export function reportRange(from: unknown, to: unknown): { from: Date; until: Date } {
  const parse = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ErrorUtil('Dates must use YYYY-MM-DD (UTC)', 400);
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ErrorUtil('Invalid report date', 400);
    return date;
  };
  const start = parse(from);
  const end = parse(to);
  if (end < start || end.getTime() - start.getTime() > 365 * 86400000) throw new ErrorUtil('Report range must be ordered and no longer than 366 days', 400);
  return { from: start, until: new Date(end.getTime() + 86400000) };
}

export class SponsorFeedService {
  private images = new SponsorLogoHandler('feed-ad');

  private requireId(id: string): void {
    if (!mongoose.isObjectIdOrHexString(id)) throw new ErrorUtil('Invalid sponsor ID', 400);
  }

  async getAd(id: string) {
    this.requireId(id);
    const sponsor = await SponsorModel.findById(id);
    if (!sponsor) throw new ErrorUtil('Sponsor not found', 404);
    return sponsor.feedAd ?? null;
  }

  async saveAd(id: string, input: Record<string, unknown>, actorId: string, file?: UploadedFile) {
    this.requireId(id);
    const sponsor = await SponsorModel.findById(id).select('+feedAdRevision');
    if (!sponsor) throw new ErrorUtil('Sponsor not found', 404);
    const allowed = ['enabled', 'headline', 'body', 'ctaLabel', 'destinationUrl', 'altText'];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !allowed.includes(key))) {
      throw new ErrorUtil('Unsupported creative fields', 400);
    }
    const oldAd = sponsor.feedAd;
    const fields: any = oldAd ? JSON.parse(JSON.stringify(oldAd)) : { enabled: false };
    for (const [key, value] of Object.entries(input)) {
      if (key === 'enabled') {
        if (![true, false, 'true', 'false'].includes(value as any)) throw new ErrorUtil('enabled must be a boolean', 400);
        fields.enabled = value === true || value === 'true';
      } else {
        if (typeof value !== 'string') throw new ErrorUtil(`${key} must be a string`, 400);
        if (key !== 'altText') fields[key] = value.trim();
      }
    }
    for (const [key, max] of [
      ['headline', 120],
      ['body', 1000],
      ['ctaLabel', 40],
    ] as const) {
      if (typeof fields[key] !== 'string' || !fields[key] || fields[key].length > max) throw new ErrorUtil(`${key} is required (maximum ${max} characters)`, 400);
    }
    try {
      const destination = new URL(fields.destinationUrl);
      if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password) throw new Error();
    } catch {
      throw new ErrorUtil('Destination must be an HTTP or HTTPS URL without credentials', 400);
    }
    const altText = input.altText === undefined ? oldAd?.image.altText : String(input.altText).trim();
    if (!altText || altText.length > 300) throw new ErrorUtil('Image alt text is required (maximum 300 characters)', 400);
    if (!file && !oldAd?.image) throw new ErrorUtil('A creative image is required', 400);
    const revision = (sponsor.feedAdRevision || 0) + 1;
    const uploaded = file ? await this.images.upload(file, id) : undefined;
    try {
      sponsor.set('feedAd', { ...fields, image: { ...(uploaded ?? oldAd!.image), altText }, revision });
      sponsor.feedAdRevision = revision;
      sponsor.updatedBy = new mongoose.Types.ObjectId(actorId);
      await sponsor.save();
    } catch (err) {
      if (uploaded) await this.images.cleanup(uploaded.publicId, id);
      if (err instanceof mongoose.Error.VersionError || err instanceof mongoose.Error.DocumentNotFoundError) throw new ErrorUtil('Sponsor changed; reload and try again', 409);
      throw err;
    }
    if (uploaded && oldAd?.image.publicId) await this.images.cleanup(oldAd.image.publicId, id);
    return sponsor.feedAd;
  }

  async removeAd(id: string, actorId: string) {
    this.requireId(id);
    const sponsor = await SponsorModel.findById(id).select('+feedAdRevision');
    if (!sponsor) throw new ErrorUtil('Sponsor not found', 404);
    const image = sponsor.feedAd?.image;
    sponsor.set('feedAd', undefined);
    sponsor.feedAdRevision = (sponsor.feedAdRevision || 0) + 1;
    sponsor.updatedBy = new mongoose.Types.ObjectId(actorId);
    try {
      await sponsor.save();
    } catch (err) {
      if (err instanceof mongoose.Error.VersionError || err instanceof mongoose.Error.DocumentNotFoundError) throw new ErrorUtil('Sponsor changed; reload and try again', 409);
      throw err;
    }
    if (image) await this.images.cleanup(image.publicId, id);
  }

  async eligible(now = new Date()): Promise<EligibleSponsor[]> {
    const sponsors = await SponsorModel.find({
      isActive: true,
      'feedAd.enabled': true,
      $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }],
    })
      .select(
        '_id businessName logo.url logo.altText feedAd.enabled feedAd.headline feedAd.body feedAd.image.url feedAd.image.altText feedAd.ctaLabel feedAd.destinationUrl feedAd.revision'
      )
      .sort({ displayOrder: 1, _id: 1 })
      .lean();
    return sponsors.map((sponsor) => ({ ...sponsor, _id: String(sponsor._id) })) as EligibleSponsor[];
  }

  placement(sponsor: EligibleSponsor, userId: string, placementId: string) {
    return {
      ...sponsor,
      measurementToken: issuePlacementToken({
        userId,
        sponsorId: sponsor._id,
        businessName: sponsor.businessName,
        revision: sponsor.feedAd.revision,
        placementId,
        issuedAt: Date.now(),
      }),
    };
  }

  async recordEvent(token: unknown, type: unknown, userId: string) {
    if (type !== 'impression' && type !== 'click') throw new ErrorUtil('Event type must be impression or click', 400);
    const claim = readPlacementToken(token, userId);
    if (type === 'impression') return new SponsorFeedMeasurementService().recordImpression(claim);
    // Do not accept traffic before the unique event index finishes initializing.
    await SponsorFeedEventModel.init();
    try {
      const result = await SponsorFeedEventModel.updateOne(
        { placementId: claim.placementId, type },
        {
          $setOnInsert: {
            sponsorId: claim.sponsorId,
            businessName: claim.businessName,
            revision: claim.revision,
            userId,
            receivedAt: new Date(),
          },
        },
        { upsert: true }
      );
      return { recorded: result.upsertedCount === 1 };
    } catch (err: any) {
      if (err.code === 11000) return { recorded: false };
      throw err;
    }
  }

  async report(from: unknown, to: unknown, sponsorId?: string) {
    const range = reportRange(from, to);
    if (sponsorId) this.requireId(sponsorId);
    const counts = { impressions: { $sum: { $cond: [{ $eq: ['$type', 'impression'] }, 1, 0] } }, clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } } };
    const [result] = await SponsorFeedEventModel.aggregate([
      { $match: { counted: { $ne: false }, receivedAt: { $gte: range.from, $lt: range.until }, ...(sponsorId ? { sponsorId: new mongoose.Types.ObjectId(sponsorId) } : {}) } },
      {
        $facet: {
          totals: [{ $group: { _id: null, ...counts } }],
          daily: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$receivedAt', timezone: 'UTC' } }, ...counts } }, { $sort: { _id: 1 } }],
          sponsors: [{ $sort: { receivedAt: 1 } }, { $group: { _id: '$sponsorId', businessName: { $last: '$businessName' }, ...counts } }, { $sort: { businessName: 1 } }],
        },
      },
    ]);
    const withCtr = (row: any) => ({ ...row, ctr: row.impressions ? (row.clicks / row.impressions) * 100 : null });
    return {
      timezone: 'UTC',
      from,
      to,
      totals: withCtr(result.totals[0] ?? { impressions: 0, clicks: 0 }),
      daily: result.daily.map(withCtr),
      sponsors: result.sponsors.map(withCtr),
    };
  }
}
