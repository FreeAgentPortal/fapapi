import { SponsorFeedService, reportRange } from '../SponsorFeedService';
import { issuePlacementToken, readPlacementToken } from '../../utils/placementToken';
import { SponsorFeedEventModel } from '../../models/SponsorFeedEvent';
import SponsorModel from '../../models/Sponsor';
import { SponsorLogoHandler } from '../../handlers/SponsorLogoHandler';
import mongoose from 'mongoose';
import { SponsorFeedImpressionStateModel } from '../../models/SponsorFeedImpressionState';

const userId = '0123456789abcdef01234567';
const sponsorId = 'abcdef0123456789abcdef01';
const claim = () => ({ userId, sponsorId, businessName: 'Original sponsor', revision: 3, placementId: 'session:3:sponsor:1:3', issuedAt: Date.now() });

describe('sponsor feed measurement and creatives', () => {
  const secret = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = 'sponsor-test-secret'; });
  afterAll(() => { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });
  beforeEach(() => {
    jest.spyOn(SponsorFeedEventModel, 'init').mockResolvedValue(undefined as any);
    jest.spyOn(SponsorFeedImpressionStateModel, 'init').mockResolvedValue(undefined as any);
    jest.spyOn(SponsorFeedImpressionStateModel, 'findOneAndUpdate').mockResolvedValue({ lastCountedAt: null } as any);
    jest.spyOn(SponsorFeedImpressionStateModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);
    jest.spyOn(SponsorFeedEventModel, 'findOne').mockReturnValue({
      sort: jest.fn().mockReturnThis(), session: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null),
    } as any);
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({
      withTransaction: jest.fn(async (callback: () => Promise<boolean>) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    } as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('verifies tokens and rejects tampering, foreign users, wrong domains and expiry', () => {
    const data = claim(); const token = issuePlacementToken(data);
    expect(readPlacementToken(token, userId)).toEqual(data);
    expect(() => readPlacementToken(token, 'other')).toThrow();
    expect(() => readPlacementToken(token + 'x', userId)).toThrow();
    expect(() => readPlacementToken(token, userId, data.issuedAt + 86400001)).toThrow();
    expect(() => readPlacementToken('bad', userId)).toThrow();
    expect(() => readPlacementToken(token, userId, data.issuedAt - 1)).toThrow();
  });

  it('uses atomic upserts and treats concurrent duplicate-key conflicts as duplicates', async () => {
    const update = jest.spyOn(SponsorFeedEventModel, 'updateOne').mockResolvedValueOnce({ upsertedCount: 1 } as any).mockRejectedValueOnce({ code: 11000 }).mockResolvedValue({ upsertedCount: 0 } as any);
    const service = new SponsorFeedService(); const token = issuePlacementToken(claim());
    const results = await Promise.all([service.recordEvent(token, 'impression', userId), service.recordEvent(token, 'impression', userId), service.recordEvent(token, 'impression', userId)]);
    expect(results.filter(result => result.recorded)).toHaveLength(1);
    expect(update).toHaveBeenCalledWith({ placementId: claim().placementId, type: 'impression' }, { $setOnInsert: expect.objectContaining({ sponsorId, revision: 3, businessName: 'Original sponsor', receivedAt: expect.any(Date), counted: true }) }, { upsert: true, session: expect.any(Object) });
    expect(SponsorFeedEventModel.schema.indexes()).toContainEqual([{ placementId: 1, type: 1 }, expect.objectContaining({ unique: true })]);
  });

  it('counts separate appearances and event types independently without looking up a deleted sponsor', async () => {
    const update = jest.spyOn(SponsorFeedEventModel, 'updateOne').mockResolvedValue({ upsertedCount: 1 } as any);
    const lookup = jest.spyOn(SponsorModel, 'findById');
    const service = new SponsorFeedService(); const data = claim();
    await service.recordEvent(issuePlacementToken(data), 'click', userId);
    await service.recordEvent(issuePlacementToken({ ...data, placementId: 'session:6:sponsor:1:3' }), 'impression', userId);
    expect(update.mock.calls[0][0]).not.toEqual(update.mock.calls[1][0]);
    expect(lookup).not.toHaveBeenCalled();
    await expect(service.recordEvent(issuePlacementToken(data), 'view', userId)).rejects.toThrow();
  });

  it('uses inclusive UTC days and rejects invalid ranges', () => {
    expect(reportRange('2026-10-01', '2026-10-09')).toEqual({ from: new Date('2026-10-01T00:00:00Z'), until: new Date('2026-10-10T00:00:00Z') });
    for (const dates of [['2026-02-30', '2026-03-01'], ['2026-10-10', '2026-10-01'], ['2024-01-01', '2026-01-01']]) expect(() => reportRange(...dates as [string, string])).toThrow();
  });

  it('reports CTR and keeps server-received UTC boundaries in the query', async () => {
    const aggregate = jest.spyOn(SponsorFeedEventModel, 'aggregate').mockResolvedValue([{ totals: [{ impressions: 4, clicks: 1 }], daily: [{ _id: '2026-10-09', impressions: 0, clicks: 1 }], sponsors: [] }]);
    const report = await new SponsorFeedService().report('2026-10-09', '2026-10-09');
    expect(report.totals.ctr).toBe(25); expect(report.daily[0].ctr).toBeNull();
    expect(aggregate.mock.calls[0][0]?.[0]).toEqual({ $match: { counted: { $ne: false }, receivedAt: { $gte: new Date('2026-10-09T00:00:00Z'), $lt: new Date('2026-10-10T00:00:00Z') } } });
  });

  it('filters active, enabled, scheduled creatives and only selects public rendering fields', async () => {
    const select = jest.fn().mockReturnThis();
    const find = jest.spyOn(SponsorModel, 'find').mockReturnValue({ select, sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) } as any);
    const now = new Date(); await new SponsorFeedService().eligible(now);
    expect((find.mock.calls as unknown[][])[0][0]).toEqual({ isActive: true, 'feedAd.enabled': true, $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
    ] });
    expect(select.mock.calls[0][0]).not.toContain('publicId');
  });

  it('increments creative revisions and cleans replaced images after saving', async () => {
    const oldAd = { enabled: true, headline: 'Old', body: 'Copy', image: { url: 'https://example.com/old.png', publicId: 'sponsors/' + sponsorId + '/feed-ad/old', altText: 'Old' }, ctaLabel: 'Learn more', destinationUrl: 'https://example.com', revision: 2 };
    const document: any = { feedAd: oldAd, feedAdRevision: 2, set: jest.fn(function (this: any, key: string, value: unknown) { this[key] = value; }), save: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(SponsorModel, 'findById').mockReturnValue({ select: jest.fn().mockResolvedValue(document) } as any);
    jest.spyOn(SponsorLogoHandler.prototype, 'upload').mockResolvedValue({ url: 'https://example.com/new.png', publicId: 'sponsors/' + sponsorId + '/feed-ad/new' });
    const cleanup = jest.spyOn(SponsorLogoHandler.prototype, 'cleanup').mockResolvedValue(undefined);
    const ad = await new SponsorFeedService().saveAd(sponsorId, { headline: 'Updated' }, userId, {} as any);
    expect(ad?.revision).toBe(3); expect(document.feedAdRevision).toBe(3);
    expect(cleanup).toHaveBeenCalledWith(oldAd.image.publicId, sponsorId);
    expect(document.save.mock.invocationCallOrder[0]).toBeLessThan(cleanup.mock.invocationCallOrder[0]);
  });
});
