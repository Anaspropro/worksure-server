import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KycVerificationStatus, KycDocumentType, KycDocumentStatus } from '../../generated/prisma';
import { PaystackClientService } from '../../common/services/paystack-client.service';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystackClient: PaystackClientService,
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_NAME,
      api_key: process.env.CLOUDINARY_KEY,
      api_secret: process.env.CLOUDINARY_SECRET,
    });
  }

  async verifyIdentityWithPaystack(
    userId: string,
    bvn: string,
    bankCode: string,
    accountNumber: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.kycStatus === KycVerificationStatus.VERIFIED) {
      return { message: 'User already verified', status: user.kycStatus };
    }

    // Attempt Paystack BVN match
    if (process.env.NODE_ENV === 'development' || bvn === '00000000000') {
      import('@nestjs/common').then(({ Logger }) => {
        Logger.warn(
          `[DEV MODE / TEST BVN] Bypassing Paystack BVN match for ${bvn}. Assuming identity is verified.`,
          'KycService'
        );
      });
    } else {
      try {
        const matchData = await this.paystackClient.post<any>('/bvn/match', {
          bvn,
          account_number: accountNumber,
          bank_code: bankCode,
          first_name: user.name.split(' ')[0],
        });

        if (!matchData?.is_match) {
          throw new BadRequestException('Identity verification failed. Information does not match.');
        }
      } catch (error: any) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException('Failed to verify identity with Paystack.');
      }
    }

    // Verification successful
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycVerified: true,
        kycStatus: KycVerificationStatus.PENDING, // PENDING document review
      },
    });

    return {
      message: 'Identity verified successfully. Please upload required documents.',
      status: KycVerificationStatus.PENDING,
    };
  }

  async uploadKycDocument(
    userId: string,
    documentUrl: string,
    documentType: KycDocumentType,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!documentUrl) throw new BadRequestException('documentUrl is required.');

    const kycDoc = await this.prisma.kycDocument.create({
      data: {
        userId,
        documentType,
        documentUrl,
        status: KycDocumentStatus.PENDING,
      },
    });

    return {
      message: 'Document uploaded successfully',
      document: kycDoc,
    };
  }

  async getKycStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycDocuments: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    
    return {
      kycStatus: user.kycStatus,
      kycVerified: user.kycVerified,
      documents: user.kycDocuments,
    };
  }
}
