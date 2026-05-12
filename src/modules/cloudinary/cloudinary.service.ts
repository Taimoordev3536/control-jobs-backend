import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as https from 'https';

export interface UploadedImage {
  publicId: string;
  secureUrl: string;
}

export interface UploadedAttachment {
  publicId: string;
  secureUrl: string;
  resourceType: string;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly bufferCache = new Map<
    string,
    { buf: Buffer; expiresAt: number }
  >();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000;
  private readonly CACHE_MAX = 50;

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  async uploadImage(
    buffer: Buffer,
    folder: string,
  ): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', overwrite: true },
        (err, result?: UploadApiResponse) => {
          if (err || !result) {
            return reject(err || new Error('Cloudinary upload failed'));
          }
          resolve({ publicId: result.public_id, secureUrl: result.secure_url });
        },
      );
      stream.end(buffer);
    });
  }

  async uploadAttachment(
    buffer: Buffer,
    folder: string,
    resourceType: 'image' | 'raw' | 'auto' = 'auto',
  ): Promise<UploadedAttachment> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType, overwrite: true },
        (err, result?: UploadApiResponse) => {
          if (err || !result) {
            return reject(err || new Error('Cloudinary upload failed'));
          }
          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
            resourceType: result.resource_type,
            format: result.format || null,
            bytes: result.bytes ?? null,
            width: result.width ?? null,
            height: result.height ?? null,
          });
        },
      );
      stream.end(buffer);
    });
  }

  async deleteAsset(publicId: string, resourceType: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: resourceType as 'image' | 'raw' | 'video',
      });
    } catch (err) {
      this.logger.warn(
        `Failed to delete Cloudinary ${resourceType} asset ${publicId}: ${(err as Error).message}`,
      );
    }
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
      this.bufferCache.delete(publicId);
    } catch (err) {
      this.logger.warn(
        `Failed to delete Cloudinary asset ${publicId}: ${(err as Error).message}`,
      );
    }
  }

  // Build a transform URL that returns a PDF-friendly PNG (transparent BG
  // preserved, capped at 600x400, auto-quality). This way pdfkit always
  // gets a sanely-sized image regardless of what the user uploaded.
  buildPdfUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'image',
      format: 'png',
      transformation: [{ width: 600, height: 400, crop: 'limit', quality: 'auto' }],
      secure: true,
    });
  }

  async fetchPdfBuffer(publicId: string): Promise<Buffer | null> {
    const cached = this.bufferCache.get(publicId);
    if (cached && cached.expiresAt > Date.now()) return cached.buf;

    try {
      const url = this.buildPdfUrl(publicId);
      const buf = await this.downloadBuffer(url);
      this.cacheSet(publicId, buf);
      return buf;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Cloudinary asset ${publicId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private cacheSet(publicId: string, buf: Buffer) {
    if (this.bufferCache.size >= this.CACHE_MAX) {
      const oldestKey = this.bufferCache.keys().next().value;
      if (oldestKey) this.bufferCache.delete(oldestKey);
    }
    this.bufferCache.set(publicId, {
      buf,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }

  private downloadBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        })
        .on('error', reject);
    });
  }
}
