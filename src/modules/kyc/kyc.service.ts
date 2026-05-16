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
    // Note: This requires valid real BVN and account details in production,
    // or test BVN details in test mode.
    try {
      const matchData = await this.paystackClient.post<any>('/bvn/match', {
        bvn,
        account_number: accountNumber,
        bank_code: bankCode,
        first_name: user.name.split(' ')[0], // Optional in Paystack but good for validation
      });

      if (!matchData.is_match) {
        throw new BadRequestException('Identity verification failed. Information does not match.');
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new BadRequestException(error.response.data.message);
      }
      // If error is something else, you might want to log it and throw a generic error.
      // But for local test, if paystack fails because of test data, we might want to mock it.
      // For this implementation, we assume real Paystack integration.
      throw new BadRequestException('Failed to verify identity with Paystack.');
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
    file: Express.Multer.File,
    documentType: KycDocumentType,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Upload to Cloudinary
    if (!file) throw new BadRequestException('A file is required.');
    
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'auto',
            folder: `worksure/kyc/${userId}`,
          },
          (error, result) => {
            if (error || !result) {
              reject(new BadRequestException('Unable to upload document.'));
            } else {
              resolve(result);
            }
          },
        )
        .end(file.buffer);
    });

    const kycDoc = await this.prisma.kycDocument.create({
      data: {
        userId,
        documentType,
        documentUrl: uploadResult.secure_url,
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
