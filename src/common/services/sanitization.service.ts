import { Injectable } from '@nestjs/common';
import { ValidationError } from 'class-validator';

@Injectable()
export class SanitizationService {
  /**
   * Sanitize string input to prevent XSS and injection attacks
   */
  sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return (
      input
        // Remove potentially dangerous characters
        .replace(/[<>]/g, '')
        // Remove JavaScript event handlers
        .replace(/on\w+\s*=/gi, '')
        // Remove javascript: protocol
        .replace(/javascript:/gi, '')
        // Remove data: protocol (except for safe data URIs)
        .replace(/data:(?!image\/)/gi, '')
        // Remove vbscript: protocol
        .replace(/vbscript:/gi, '')
        // Remove file: protocol
        .replace(/file:/gi, '')
        // Remove potential SQL injection patterns
        .replace(/union\s+select/gi, '')
        .replace(/drop\s+table/gi, '')
        .replace(/insert\s+into/gi, '')
        .replace(/update\s+set/gi, '')
        .replace(/delete\s+from/gi, '')
        // Remove path traversal
        .replace(/\.\./g, '')
        // Remove null bytes
        .replace(/\0/g, '')
        // Trim whitespace
        .trim()
    );
  }

  /**
   * Sanitize HTML content (basic version)
   */
  sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return (
      input
        // Remove script tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove iframe tags
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        // Remove object tags
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        // Remove embed tags
        .replace(/<embed\b[^>]*>/gi, '')
        // Remove form tags
        .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
        // Remove input tags
        .replace(/<input\b[^>]*>/gi, '')
        // Remove on* event handlers
        .replace(/\son\w+\s*=/gi, '')
        // Remove javascript: protocol
        .replace(/javascript:/gi, '')
        // Remove vbscript: protocol
        .replace(/vbscript:/gi, '')
        // Remove data: protocol (except for safe data URIs)
        .replace(/data:(?!image\/)/gi, '')
    );
  }

  /**
   * Sanitize email addresses
   */
  sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return '';
    }

    return email
      .toLowerCase()
      .trim()
      .replace(/[<>]/g, '')
      .replace(/['"]/g, '')
      .substring(0, 254); // RFC 5321 limit
  }

  /**
   * Sanitize phone numbers
   */
  sanitizePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      return '';
    }

    return phone
      .replace(/[^\d+\-\s()]/g, '') // Only allow digits, +, -, spaces, parentheses
      .trim()
      .substring(0, 20); // Reasonable length limit
  }

  /**
   * Sanitize URLs
   */
  sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    return url
      .replace(/[<>]/g, '')
      .replace(/['"]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:(?!image\/)/gi, '')
      .trim()
      .substring(0, 2048); // Reasonable length limit
  }

  /**
   * Sanitize names and general text fields
   */
  sanitizeName(name: string): string {
    if (!name || typeof name !== 'string') {
      return '';
    }

    return name
      .replace(/[<>]/g, '')
      .replace(/['"]/g, '')
      .replace(/[{}[\]\\]/g, '')
      .trim()
      .substring(0, 100); // Reasonable length limit
  }

  /**
   * Sanitize numeric input
   */
  sanitizeNumber(input: string): number | null {
    if (!input || typeof input !== 'string') {
      return null;
    }

    const sanitized = input.replace(/[^\d.-]/g, '');
    const num = parseFloat(sanitized);

    return isNaN(num) ? null : num;
  }

  /**
   * Sanitize array of strings
   */
  sanitizeStringArray(input: string[]): string[] {
    if (!Array.isArray(input)) {
      return [];
    }

    return input
      .filter((item) => typeof item === 'string')
      .map((item) => this.sanitizeString(item))
      .filter((item) => item.length > 0)
      .slice(0, 50); // Limit array size
  }

  /**
   * Validate and sanitize file upload names
   */
  sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') {
      return '';
    }

    return fileName
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
      .replace(/\.\./g, '') // Remove path traversal
      .replace(/^\./, '') // Remove leading dot
      .toLowerCase()
      .trim()
      .substring(0, 255); // Reasonable filename length
  }

  /**
   * Sanitize validation error messages
   */
  sanitizeValidationErrors(errors: ValidationError[]): ValidationError[] {
    return errors.map((error) => ({
      ...error,
      constraints: error.constraints
        ? Object.keys(error.constraints).reduce(
            (acc, key) => {
              acc[key] = this.sanitizeString(error.constraints![key]);
              return acc;
            },
            {} as Record<string, string>,
          )
        : undefined,
    }));
  }
}
