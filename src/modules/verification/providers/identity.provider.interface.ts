export interface VerificationSession {
  url?: string;
  reference: string;
}

export interface VerificationResult {
  status: 'VERIFIED' | 'FAILED' | 'PENDING' | 'PROCESSING';
  reference: string;
  verifiedAt?: Date;
  failureReason?: string;
  rawData?: any;
}

export interface IdentityVerificationProvider {
  initiateVerification(
    userId: string,
    email: string,
  ): Promise<VerificationSession>;
  verifyWebhookSignature(
    payload: any,
    signature: string,
    secret: string,
  ): boolean;
  parseWebhook(payload: any): VerificationResult;
  getVerificationStatus(reference: string): Promise<VerificationResult>;
}
