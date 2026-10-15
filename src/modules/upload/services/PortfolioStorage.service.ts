import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import crypto from 'crypto';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

/** Authenticated portfolio assets are separate from generic public uploads. */
export class PortfolioStorageService {
  private config(key: string, contentType: string) {
    if (!/^scout-portfolios\/[a-f\d]{24}\/[a-f\d]{24}$/.test(key)) throw new ErrorUtil('Invalid storage key', 400);
    const formats: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf',
    };
    const format = formats[contentType];
    if (!format) throw new ErrorUtil('Unsupported portfolio file type', 400);
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_KEY;
    const api_secret = process.env.CLOUDINARY_SECRET;
    if (!cloud_name || !api_key || !api_secret) throw new ErrorUtil('Portfolio storage is not configured', 503);
    // Raw PDF public IDs include their extension. Image public IDs do not.
    const resource_type = contentType === 'application/pdf' ? 'raw' as const : 'image' as const;
    return {
      publicId: resource_type === 'raw' ? `${key}.${format}` : key, format,
      options: { cloud_name, api_key, api_secret, resource_type, type: 'authenticated' as const, timeout: 60000 },
    };
  }

  async upload(key: string, body: Buffer, contentType: string) {
    const { publicId, format, options } = this.config(key, contentType);
    const sha256 = crypto.createHash('sha256').update(body).digest('hex');
    let uploaded: UploadApiResponse;
    try {
      uploaded = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          ...options, public_id: publicId, overwrite: false, unique_filename: false, use_filename: false,
          context: { sha256 },
        }, (error, result) => {
          if (error || !result) reject(new Error('Upload failed'));
          else resolve(result);
        });
        stream.on('error', reject);
        stream.end(body);
      });
    } catch {
      // Provider errors can include credentials or request details; never expose them.
      throw new ErrorUtil('Portfolio storage upload failed', 502);
    }
    if (uploaded.public_id !== publicId || uploaded.resource_type !== options.resource_type ||
        uploaded.type !== options.type || uploaded.bytes !== body.length || uploaded.existing ||
        (options.resource_type === 'image' && uploaded.format !== format)) {
      throw new ErrorUtil('Uploaded file verification failed', 502);
    }
    return sha256;
  }

  async remove(key: string, contentType: string) {
    const { publicId, options } = this.config(key, contentType);
    try {
      const result = await cloudinary.uploader.destroy(publicId, { ...options, invalidate: true });
      if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Deletion not confirmed');
    } catch { throw new ErrorUtil('Portfolio storage deletion failed', 502); }
  }

  async download(key: string, contentType: string) {
    const { publicId, format, options } = this.config(key, contentType);
    try {
      // Ordinary signed CDN URLs do not expire. The authenticated download API does.
      const url = cloudinary.utils.private_download_url(publicId, format, {
        ...options, attachment: true, expires_at: Math.floor(Date.now() / 1000) + 300,
      });
      return { url, expiresInSeconds: 300 };
    } catch { throw new ErrorUtil('Portfolio storage download failed', 502); }
  }
}
