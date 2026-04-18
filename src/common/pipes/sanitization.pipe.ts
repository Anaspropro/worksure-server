import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { SanitizationService } from '../services/sanitization.service';

@Injectable()
export class SanitizationPipe implements PipeTransform<unknown, unknown> {
  constructor(private readonly sanitizationService: SanitizationService) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!value) {
      return value;
    }

    try {
      return this.sanitizeValue(value, metadata);
    } catch {
      throw new BadRequestException('Invalid input data');
    }
  }

  private sanitizeValue(value: unknown, metadata: ArgumentMetadata): unknown {
    if (typeof value === 'string') {
      return this.sanitizeStringByType(value, metadata);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item, metadata));
    }

    if (typeof value === 'object' && value !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = this.sanitizeValue(val, metadata);
      }
      return sanitized;
    }

    return value;
  }

  private sanitizeStringByType(
    value: string,
    metadata: ArgumentMetadata,
  ): string {
    const propertyName = metadata.data?.toLowerCase() || '';

    // Email sanitization
    if (propertyName.includes('email')) {
      return this.sanitizationService.sanitizeEmail(value);
    }

    // Phone sanitization
    if (propertyName.includes('phone') || propertyName.includes('mobile')) {
      return this.sanitizationService.sanitizePhone(value);
    }

    // URL sanitization
    if (
      propertyName.includes('url') ||
      propertyName.includes('link') ||
      propertyName.includes('website')
    ) {
      return this.sanitizationService.sanitizeUrl(value);
    }

    // Name sanitization
    if (propertyName.includes('name') || propertyName.includes('title')) {
      return this.sanitizationService.sanitizeName(value);
    }

    // Description/content sanitization (allow more characters but still sanitize)
    if (
      propertyName.includes('description') ||
      propertyName.includes('content') ||
      propertyName.includes('message')
    ) {
      return this.sanitizationService.sanitizeHtml(value);
    }

    // Default string sanitization
    return this.sanitizationService.sanitizeString(value);
  }
}
