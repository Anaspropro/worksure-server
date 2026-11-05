import { Injectable, Logger } from '@nestjs/common';
import {
  IdentityVerificationProvider,
  VerificationResult,
  VerificationSession,
} from './identity.provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class PaystackVerificationProvider implements IdentityVerificationProvider {
  private readonly logger = new Logger(PaystackVerificationProvider.name);

  async initiateVerification(
    userId: string,
    email: string,
  ): Promise<VerificationSession> {
    const reference = `verify_${userId}_${Date.now()}`;
    return {
      reference,
      url: undefined,
    };
  }

  verifyWebhookSignature(
    payload: any,
    signature: string,
    secret: string,
  ): boolean {
    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return hash === signature;
  }

  parseWebhook(payload: any): VerificationResult {
    const event = payload.event;
    const data = payload.data;

    let status: VerificationResult['status'] = 'PENDING';
    if (event === 'identity.verification.successful') {
      status = 'VERIFIED';
    } else if (event === 'identity.verification.failed') {
      status = 'FAILED';
    }

    return {
      status,
      reference: data.reference,
      verifiedAt: status === 'VERIFIED' ? new Date() : undefined,
      failureReason: status === 'FAILED' ? data.reason : undefined,
      rawData: data,
    };
  }

  async getVerificationStatus(reference: string): Promise<VerificationResult> {
    return {
      status: 'VERIFIED',
      reference,
      verifiedAt: new Date(),
    };
  }
}
