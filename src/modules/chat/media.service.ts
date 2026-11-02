import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class MediaService {
  private readonly maxFileSize = 10 * 1024 * 1024;
  private readonly allowedMimePrefixes = [
    'image/',
    'video/',
    'audio/',
    'application/pdf',
  ];

  private readonly logger = new Logger(MediaService.name);

  constructor() {
    const cloudName = process.env.CLOUDINARY_NAME;
    const apiKey = process.env.CLOUDINARY_KEY;
    const apiSecret = process.env.CLOUDINARY_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn(
        'Cloudinary credentials are not properly configured. Media uploads will fail.',
      );
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async getSignedUploadParams(folder = 'worksure/chat') {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      process.env.CLOUDINARY_SECRET!,
    );

    return {
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_NAME,
      apiKey: process.env.CLOUDINARY_KEY,
      folder,
    };
  }
}
