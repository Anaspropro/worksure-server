import { Injectable } from '@nestjs/common';
import { StringValue } from 'ms';

@Injectable()
export class AppConfigService {
  get port(): number {
    const rawPort = process.env.PORT;
    return rawPort ? Number(rawPort) : 8000;
  }

  get databaseUrl(): string | undefined {
    return process.env.DATABASE_URL;
  }

  get isDatabaseConfigured(): boolean {
    return Boolean(this.databaseUrl);
  }

  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET environment variable is required and must be at least 32 characters long',
      );
    }
    return secret;
  }

  get jwtExpiresIn(): StringValue {
    return (process.env.JWT_EXPIRES_IN || '1d') as StringValue;
  }

  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  }
}
