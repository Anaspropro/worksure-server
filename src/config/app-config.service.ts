import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';

@Injectable()
export class AppConfigService {
  constructor(@Inject(ConfigService) private configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('PORT', 8000);
  }

  get databaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL')!;
  }

  get appUrl(): string {
    return this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  get isDatabaseConfigured(): boolean {
    return Boolean(this.databaseUrl);
  }

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET')!;
  }

  get jwtExpiresIn(): StringValue {
    return this.configService.get<StringValue>(
      'JWT_EXPIRES_IN',
      '1d' as StringValue,
    );
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  // Paystack
  get paystackSecret(): string {
    return this.configService.get<string>('PAYSTACK_SECRET')!;
  }

  get paystackPublic(): string {
    return this.configService.get<string>('PAYSTACK_PUBLIC')!;
  }

  // Cloudinary
  get cloudinaryName(): string {
    return this.configService.get<string>('CLOUDINARY_NAME')!;
  }

  get cloudinaryKey(): string {
    return this.configService.get<string>('CLOUDINARY_KEY')!;
  }

  get cloudinarySecret(): string {
    return this.configService.get<string>('CLOUDINARY_SECRET')!;
  }

  // Resend
  get resendApiKey(): string {
    return this.configService.get<string>('RESEND_API_KEY')!;
  }

  get emailFromAddress(): string {
    return this.configService.get<string>(
      'EMAIL_FROM_ADDRESS',
      'noreply@bustaan.xyz',
    );
  }

  // Alerting
  get discordWebhookUrl(): string | undefined {
    return this.configService.get<string>('DISCORD_WEBHOOK_URL');
  }
}
