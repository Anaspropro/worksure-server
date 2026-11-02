import { Injectable } from '@nestjs/common';

@Injectable()
export class RedactionService {
  // Common keys that should be redacted globally
  private readonly defaultDenyList = new Set([
    'password',
    'passwordHash',
    'token',
    'secret',
    'ssn',
    'cardNumber',
    'cvv',
    'pin',
    'refreshToken',
    'accessToken',
  ]);

  public redact(obj: any, additionalDenyList: string[] = []): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    const denyList = new Set([...this.defaultDenyList, ...additionalDenyList]);
    return this.deepRedact(obj, denyList);
  }

  private deepRedact(obj: any, denyList: Set<string>): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepRedact(item, denyList));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (denyList.has(key)) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.deepRedact(value, denyList);
        }
      }
      return result;
    }

    return obj;
  }
}
