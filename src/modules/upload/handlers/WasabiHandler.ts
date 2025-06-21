import aws4 from 'aws4';
import axios from 'axios';
import crypto from 'crypto';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

export class WasabiHandler {
  private host: string;
  private bucket: string;
  private accessKey: string;
  private secretKey: string;
  private region: string = 'us-east-2';

  constructor() {
    this.host = `s3.${this.region}.wasabisys.com`;
    this.bucket = process.env.CDN_BUCKET!;
    this.accessKey = process.env.CDN_KEY!;
    this.secretKey = process.env.CDN_SECRET!;
  }

  private getPath(username: string, folder: string, fileName: string): string {
    return `/${this.bucket}/${username}/${folder}/${fileName}`;
  }

  private getUrl(path: string): string {
    return `https://${this.host}${path}`;
  }

  async uploadFile(username: string, folder: string, fileName: string, fileData: Buffer, contentType = 'application/octet-stream'): Promise<string> {
    if (!fileData) {
      throw new ErrorUtil('File data buffer is empty', 400);
    }
    const path = this.getPath(username, folder, fileName);
    const url = this.getUrl(path);
    const resolvedType = contentType || this.getMimeType(fileName);

    const request = {
      host: this.host,
      method: 'PUT',
      url,
      path,
      headers: {
        'Content-Type': resolvedType,
      },
      body: fileData,
      data: fileData,
      service: 's3',
      region: this.region,
    };
    console.log(this.accessKey, this.secretKey);
    const signed = aws4.sign(request, {
      accessKeyId: this.accessKey,
      secretAccessKey: this.secretKey,
    });

    delete signed.headers?.Host;
    delete signed.headers?.['Content-Length'];

    await axios({
      method: signed.method,
      url,
      headers: { ...(signed.headers as Record<string, string>) },
      data: signed.body,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return url;
  }

  async deleteFile(username: string, folder: string, fileName: string): Promise<void> {
    const path = this.getPath(username, folder, fileName);
    const url = this.getUrl(path);

    const request = {
      host: this.host,
      method: 'DELETE',
      url,
      path,
      service: 's3',
      region: this.region,
    };

    const signed = aws4.sign(request, {
      accessKeyId: this.accessKey,
      secretAccessKey: this.secretKey,
    });

    delete signed.headers?.Host;
    delete signed.headers?.['Content-Length'];

    await axios({
      method: signed.method,
      url,
      headers: { ...(signed.headers as Record<string, string>) },
      data: signed.body,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  }

  getFileUrl(username: string, folder: string, fileName: string): string {
    const path = this.getPath(username, folder, fileName);
    return this.getUrl(path);
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  public getSignedUrl(slug: string, folder: string, fileName: string, expiresInSeconds = 3600): string {
    const path = `/${this.bucket}/${slug}/${folder}/${fileName}`;
    const host = this.host;

    const url = `https://${host}${path}`;

    const credentials = {
      accessKeyId: this.accessKey,
      secretAccessKey: this.secretKey,
    };

    const signed = aws4.sign(
      {
        host,
        path,
        method: 'GET',
        service: 's3',
        region: this.region,
        headers: {},
        signQuery: true,
      },
      credentials
    ) as any;

    const queryString = new URLSearchParams(signed.headers as Record<string, string>).toString();

    return `${url}?${queryString}`;
  }
}
