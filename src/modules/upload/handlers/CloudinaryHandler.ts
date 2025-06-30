import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

export class CloudinaryHandler {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key: process.env.CLOUDINARY_KEY!,
      api_secret: process.env.CLOUDINARY_SECRET!,
    });
  }

  /**
   * Uploads a file to Cloudinary using a Buffer.
   * @param fileBuffer The file data as a Buffer
   * @param fileName The original filename (for tracking, not for saving)
   * @param folder Optional target folder on Cloudinary
   * @returns {Promise<object>} - Upload result
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    folder: string = 'uploads'
  ): Promise<{
    public_id: string;
    secure_url: string;
    original_filename: string;
    resource_type: string;
    format: string;
  }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto', // auto-detect image/video/raw
          use_filename: true,
          // unique_filename: true, // change to false if you want exact filename retention
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Empty upload result from Cloudinary'));
          return resolve({
            public_id: result.public_id,
            secure_url: result.secure_url,
            original_filename: result.original_filename,
            resource_type: result.resource_type,
            format: result.format,
          });
        }
      );
      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  }

  /**
   * Deletes a file from Cloudinary
   * @param publicId The Cloudinary public ID of the asset
   */
  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, {
    });
  }

  /**
   * Generates a transformed URL (future-use)
   * @param publicId
   * @param options
   */
  getTransformedUrl(publicId: string, options: Partial<{ width: number; height: number; crop: string }> = {}): string {
    return cloudinary.url(publicId, {
      secure: true,
      ...options,
    });
  }
}
