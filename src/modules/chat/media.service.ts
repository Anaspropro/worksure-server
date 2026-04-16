import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

@Injectable()
export class MediaService {
  private readonly maxFileSize = 10 * 1024 * 1024;
  private readonly allowedMimePrefixes = [
    'image/',
    'video/',
    'audio/',
    'application/pdf',
  ];

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_NAME,
      api_key: process.env.CLOUDINARY_KEY,
      api_secret: process.env.CLOUDINARY_SECRET,
    });
  }

  validateFile(file?: Express.Multer.File) {
    if (!file) {
      return;
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException('Files must be 10MB or smaller.');
    }

    const allowed = this.allowedMimePrefixes.some((prefix) =>
      file.mimetype.startsWith(prefix),
    );

    if (!allowed) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: image, video, audio, and PDF.',
      );
    }
  }

  async uploadFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A file is required.');
    }

    this.validateFile(file);

    if (
      !process.env.CLOUDINARY_NAME ||
      !process.env.CLOUDINARY_KEY ||
      !process.env.CLOUDINARY_SECRET
    ) {
      throw new InternalServerErrorException(
        'Cloudinary is not configured for media uploads.',
      );
    }

    return new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'auto',
            folder: 'worksure/chat',
            use_filename: true,
            unique_filename: true,
          },
          (error, result) => {
            if (error || !result) {
              reject(
                new InternalServerErrorException(
                  error?.message || 'Unable to upload media to Cloudinary.',
                ),
              );
              return;
            }

            resolve(result);
          },
        )
        .end(file.buffer);
    });
  }
}
