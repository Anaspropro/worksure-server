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
    return process.env.JWT_SECRET || 'worksure-dev-jwt-secret';
  }

  get jwtExpiresIn(): StringValue {
    return (process.env.JWT_EXPIRES_IN || '1d') as StringValue;
  }
}
