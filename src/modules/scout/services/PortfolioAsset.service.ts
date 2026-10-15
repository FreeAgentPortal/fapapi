import mongoose from 'mongoose';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import { PortfolioAsset, PortfolioItem, SubmittedItem } from '../models/Portfolio';
import { PortfolioService } from './Portfolio.service';
import { PortfolioStorageService } from '../../upload/services/PortfolioStorage.service';
import { fail, FILE_LIMIT, FILE_TYPES, id, paged, STORAGE_LIMIT, text } from '../utils/portfolioInput';
import { transaction } from '../utils/transaction';

export class PortfolioAssetService {
  private portfolios = new PortfolioService();
  private access = this.portfolios.access;
  private storage = new PortfolioStorageService();

  async list(userId: string, page: number, limit: number) {
    const athlete = await this.access.athlete(userId);
    const filter = { athleteId: athlete._id };
    const [assets, count] = await Promise.all([
      PortfolioAsset.find(filter).select('-objectKey').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      PortfolioAsset.countDocuments(filter),
    ]);
    return paged(assets, count, page, limit);
  }

  async reserve(userId: string, data: any) {
    const athlete = await this.access.athlete(userId);
    await this.access.requireEntitled(athlete._id);
    const fileName = text(data.fileName, 'file name', 200, true);
    if (/[\\/\r\n\u0000]/.test(fileName)) fail('Invalid file name');
    const contentType = FILE_TYPES[path.extname(fileName).toLowerCase()];
    if (!contentType || contentType !== data.contentType) fail('Only JPEG, PNG, WebP and PDF files are supported');
    if (!Number.isSafeInteger(data.bytes) || data.bytes < 1 || data.bytes > FILE_LIMIT) fail('Files must be between 1 byte and 25 MB');
    await this.portfolios.ensure(athlete._id);
    // Best effort reclamation is also available as a scheduled maintenance command.
    await this.cleanup(String(athlete._id), 20);
    return transaction(async session => {
      const portfolio = await this.portfolios.lock(athlete._id, session);
      await this.access.requireEntitled(athlete._id, session);
      if (portfolio.storageBytes + data.bytes > STORAGE_LIMIT) fail('Portfolio storage limit of 5 GB reached', 409);
      if (await PortfolioAsset.countDocuments({ athleteId: athlete._id, state: { $in: ['reserved', 'uploading'] } }).session(session) >= 5) fail('Finish existing uploads before reserving more', 429);
      const assetId = new mongoose.Types.ObjectId();
      const [asset] = await PortfolioAsset.create([{
        _id: assetId, athleteId: athlete._id, fileName, contentType, bytes: data.bytes,
        objectKey: `scout-portfolios/${athlete._id}/${assetId}`, expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }], { session });
      portfolio.storageBytes += data.bytes;
      await portfolio.save({ session });
      return { assetId: asset._id, expiresAt: asset.expiresAt, contentType, bytes: asset.bytes,
        uploadPath: `/api/v1/upload/scout-portfolio/assets/${asset._id}/content` };
    });
  }

  private async validateBytes(body: Buffer, type: string) {
    if (type === 'application/pdf') {
      if (body.subarray(0, 5).toString() !== '%PDF-' || !body.subarray(Math.max(0, body.length - 1024)).includes(Buffer.from('%%EOF'))) fail('Invalid PDF content');
      return;
    }
    try {
      const image = sharp(body, { limitInputPixels: 40_000_000, failOn: 'warning' });
      const metadata = await image.metadata();
      const expected: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
      if (metadata.format !== expected[type] || (metadata.pages ?? 1) > 1) fail('Invalid or animated image');
      await image.stats();
    } catch { fail('Invalid image content or image exceeds 40 million pixels'); }
  }

  async upload(userId: string, assetId: string, body: unknown) {
    const athlete = await this.access.athlete(userId);
    await this.access.requireEntitled(athlete._id);
    const existing = await PortfolioAsset.findOne({ _id: id(assetId), athleteId: athlete._id });
    if (!existing) fail('Upload not found', 404);
    if (!Buffer.isBuffer(body) || body.length !== existing.bytes || body.length > FILE_LIMIT) fail('Upload size does not match reservation');
    await this.validateBytes(body, existing.contentType);
    if (existing.state === 'ready') {
      if (existing.sha256 !== crypto.createHash('sha256').update(body).digest('hex')) fail('Completed files cannot be replaced; reserve a new upload', 409);
      return { assetId: existing._id, state: 'ready', sha256: existing.sha256 };
    }
    const asset = await PortfolioAsset.findOneAndUpdate({ _id: assetId, athleteId: athlete._id, state: 'reserved', expiresAt: { $gt: new Date() } },
      { $set: { state: 'uploading', expiresAt: new Date(Date.now() + 10 * 60 * 1000) } }, { new: true });
    if (!asset) fail('Upload is expired or already in progress', 409);
    try {
      const sha256 = await this.storage.upload(asset.objectKey, body, asset.contentType);
      const saved = await PortfolioAsset.findOneAndUpdate({ _id: assetId, state: 'uploading', expiresAt: { $gt: new Date() } },
        { $set: { state: 'ready', sha256, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } }, { new: true });
      if (!saved) fail('Upload expired before completion', 409);
      return { assetId: saved._id, state: saved.state, sha256 };
    } catch (error) {
      await PortfolioAsset.updateOne({ _id: assetId, state: 'uploading' }, { $set: { state: 'deleting', expiresAt: new Date() } });
      throw error;
    }
  }

  async download(userId: string, assetId: string, submissionId?: string) {
    const asset = await PortfolioAsset.findOne({ _id: id(assetId), state: 'ready' });
    if (!asset) fail('File not found', 404);
    if (submissionId) {
      await this.access.submission(userId, id(submissionId));
      if (!(await SubmittedItem.exists({ submissionId, assetId }))) fail('File does not belong to submission', 404);
    } else {
      const athlete = await this.access.athlete(userId);
      if (String(athlete._id) !== String(asset.athleteId)) fail('File not found', 404);
    }
    return this.storage.download(asset.objectKey, asset.contentType);
  }

  async remove(userId: string, assetId: string) {
    const athlete = await this.access.athlete(userId);
    const asset = await PortfolioAsset.findOne({ _id: id(assetId), athleteId: athlete._id });
    if (!asset) fail('File not found', 404);
    if (!(await this.reclaim(String(asset._id), true))) fail('File is referenced by a draft/submission or upload is in progress', 409);
    return { deleted: true };
  }

  async reclaim(assetId: string, explicit = false) {
    const asset = await transaction(async session => {
      const candidate = await PortfolioAsset.findById(assetId).session(session);
      if (!candidate) return null;
      await this.portfolios.lock(candidate.athleteId, session);
      if (candidate.state !== 'deleting' && candidate.expiresAt > new Date() && (!explicit || candidate.state === 'uploading')) return null;
      if (await PortfolioItem.exists({ assetId }).session(session) || await SubmittedItem.exists({ assetId }).session(session)) return null;
      candidate.state = 'deleting';
      await candidate.save({ session });
      return candidate;
    });
    if (!asset) return false;
    // Keep the reservation charged until the storage provider confirms deletion.
    await this.storage.remove(asset.objectKey, asset.contentType);
    return transaction(async session => {
      const portfolio = await this.portfolios.lock(asset.athleteId, session);
      const deleted = await PortfolioAsset.deleteOne({ _id: asset._id, state: 'deleting' }, { session });
      if (deleted.deletedCount) {
        portfolio.storageBytes = Math.max(0, portfolio.storageBytes - asset.bytes);
        await portfolio.save({ session });
      }
      return true;
    });
  }

  async cleanup(athleteId?: string, limit = 100) {
    const filter: any = { ...(athleteId ? { athleteId: new mongoose.Types.ObjectId(athleteId) } : {}), $or: [{ state: 'deleting' }, { expiresAt: { $lte: new Date() } }] };
    let reclaimed = 0, failed = 0;
    // Exclude retained assets before limiting; historical files cannot starve orphan cleanup.
    const candidates = await PortfolioAsset.aggregate([
      { $match: filter }, { $sort: { expiresAt: 1, _id: 1 } },
      { $lookup: { from: PortfolioItem.collection.name, localField: '_id', foreignField: 'assetId', pipeline: [{ $limit: 1 }, { $project: { _id: 1 } }], as: 'draft' } },
      { $match: { 'draft.0': { $exists: false } } },
      { $lookup: { from: SubmittedItem.collection.name, localField: '_id', foreignField: 'assetId', pipeline: [{ $limit: 1 }, { $project: { _id: 1 } }], as: 'submitted' } },
      { $match: { 'submitted.0': { $exists: false } } }, { $limit: limit }, { $project: { _id: 1 } },
    ]);
    for (const asset of candidates) {
      try { if (await this.reclaim(String(asset._id))) reclaimed++; }
      catch { failed++; }
    }
    return { reclaimed, failed };
  }
}
