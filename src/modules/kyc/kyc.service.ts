import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KycVerificationStatus } from '../../generated/prisma';

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  private getPaystackSecretKey(): string {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      throw new Error(
        'PAYSTACK_SECRET_KEY is required in environment variables',
      );
    }
    return key;
  }

  private async callPaystack<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`https://api.paystack.co${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.getPaystackSecretKey()}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    const payload = (await response.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: T;
    } | null;

    if (!response.ok || !payload?.status) {
      throw new BadRequestException(
        payload?.message || 'Paystack verification failed',
      );
    }

    return payload.data as T;
  }

  async verifyBvn(userId: string, bvn: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.kycStatus === KycVerificationStatus.VERIFIED) {
      return { message: 'User already verified', status: user.kycStatus };
    }

    // Call Paystack Resolve BVN
    // Note: This is a premium service.
    const bvnData = await this.callPaystack<any>(`/bank/resolve_bvn/${bvn}`, {
      method: 'GET',
    });

    // Simple name matching logic (can be more sophisticated)
    const fullName = user.name.toLowerCase();
    const paystackName =
      `${bvnData.first_name} ${bvnData.last_name}`.toLowerCase();

    // Allow some flexibility or just log the match
    const isNameMatch =
      fullName.includes(bvnData.first_name.toLowerCase()) ||
      fullName.includes(bvnData.last_name.toLowerCase());

    if (!isNameMatch) {
      // We might still allow it but mark as pending for admin review if names are completely different
      // For this implementation, we'll be strict for security
      throw new BadRequestException(
        'BVN name mismatch. Please ensure your name matches your bank details.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycVerified: true,
        kycStatus: KycVerificationStatus.VERIFIED,
        artisanVerified: user.role === 'ARTISAN' ? true : user.artisanVerified,
      },
    });

    return {
      message: 'KYC verified successfully',
      status: KycVerificationStatus.VERIFIED,
      data: {
        firstName: bvnData.first_name,
        lastName: bvnData.last_name,
      },
    };
  }

  async getKycStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, kycVerified: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
