import { UploadedFile } from 'express-fileupload';
import sharp from 'sharp';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import logger from '../../../utils/logger';
import { CloudinaryHandler } from '../../upload/handlers/CloudinaryHandler';
import { SponsorLogo } from '../models/Sponsor';

export class SponsorLogoHandler {
  async upload(file: UploadedFile, sponsorId: string): Promise<SponsorLogo> {
    if (file.truncated || file.size > 5 * 1024 * 1024 || file.data?.length > 5 * 1024 * 1024) {
      throw new ErrorUtil('Logo must be no larger than 5 MB', 413);
    }
    if (!Buffer.isBuffer(file.data) || file.data.length === 0) {
      throw new ErrorUtil('Logo file is empty', 400);
    }

    let image: Buffer;
    try {
      const source = sharp(file.data, { limitInputPixels: 25000000 });
      const metadata = await source.metadata();
      if (!metadata.format || !['png', 'jpeg', 'webp'].includes(metadata.format)) {
        throw new Error('Unsupported logo format');
      }
      // Decode and normalize the actual image rather than trusting the supplied MIME type.
      image = await source.rotate().png().toBuffer();
    } catch {
      throw new ErrorUtil('Logo must be a valid PNG, JPEG, or WebP image (at most 25 megapixels)', 400);
    }

    // Construct lazily: server.ts loads dotenv after importing the route tree.
    const cloudinary = new CloudinaryHandler();
    let result;
    try {
      result = await cloudinary.uploadFile(image, 'logo.png', `sponsors/${sponsorId}`);
    } catch {
      throw new ErrorUtil('Logo upload failed; please try again', 502);
    }
    if (result.resource_type !== 'image' || !result.public_id.startsWith(`sponsors/${sponsorId}/`)) {
      await this.cleanup(result.public_id, sponsorId);
      throw new ErrorUtil('Unexpected logo upload response', 502);
    }
    return { url: result.secure_url, publicId: result.public_id };
  }

  /** Cleanup must never turn a successful database write into a failed response. */
  async cleanup(publicId: string, sponsorId: string): Promise<void> {
    if (!publicId.startsWith(`sponsors/${sponsorId}/`)) {
      logger.warn({ sponsorId, publicId }, 'Skipped cleanup of logo outside sponsor folder');
      return;
    }
    try {
      await new CloudinaryHandler().deleteFile(publicId);
    } catch (err) {
      logger.error({ err, sponsorId, publicId }, 'Sponsor logo cleanup failed; asset needs manual removal');
    }
  }
}
