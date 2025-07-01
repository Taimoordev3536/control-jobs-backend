import { Express } from 'express';
import { Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';

@Injectable()
export class AwsService {
  private s3: S3;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    // Set values with defaults if env vars are missing
    const accessKey = process.env.AWS_ACCESS_KEY || 'dummy';
    const secretKey = process.env.AWS_SECRET_KEY || 'dummy';
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucket = process.env.AWS_S3_BUCKET || 'test-bucket';

    // Validate required configuration
    if (!accessKey || !secretKey || !this.region || !this.bucket) {
      throw new Error('AWS configuration is incomplete');
    }

    // Initialize S3 client
    this.s3 = new S3({
      region: this.region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
  }

  async uploadFile({
    file,
    userId,
    folder = 'receipts',
  }: {
    file: Express.Multer.File;
    userId: number;
    folder?: string;
  }): Promise<string> {
    if (!file) {
      throw new Error('File is required for upload');
    }

    const Key = userId
      ? `${folder}/${userId}/${Date.now()}-${file.originalname}`
      : `${folder}/${Date.now()}-${file.originalname}`;

    const params = {
      Bucket: this.bucket,
      Key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // ACL: "public-read", // Uncomment if you want files to be publicly accessible
    };

    await this.s3.upload(params).promise();
    return Key;
  }

  getFileUrl(Key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${Key}`;
  }

  createGetSignedUrl(Key: string, expiresInSeconds: number = 86400): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key,
      Expires: expiresInSeconds, // Default: 24 hours
    });
  }

  async deleteFile(Key: string): Promise<void> {
    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key,
    }).promise();
  }
}