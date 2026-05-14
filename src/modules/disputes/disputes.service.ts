import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { DisputeDecision, DisputeStatus } from '../../generated/prisma';
import { ContractsService } from '../contracts/contracts.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async createDispute(
    userId: string,
    amount: number,
    description: string,
    contractId?: string,
    jobId?: string,
    evidenceImages?: string[],
    evidenceVideos?: string[],
    evidenceMessages?: string[],
  ) {
    let clientId: string;
    let artisanId: string;

    if (contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
      });

      if (!contract) {
        throw new NotFoundException('Contract not found');
      }

      clientId = contract.clientId;
      artisanId = contract.artisanId;

      const existingDispute = await this.prisma.dispute.findFirst({
        where: {
          contractId,
          status: DisputeStatus.OPEN,
        },
      });

      if (existingDispute) {
        throw new BadRequestException(
          'Dispute already exists for this contract',
        );
      }
    } else if (jobId) {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new NotFoundException('Job not found');
      }

      clientId = job.clientId;

      if (!job.artisanId) {
        throw new BadRequestException(
          'Cannot create a dispute for a job without an assigned artisan',
        );
      }
      artisanId = job.artisanId;

      const existingDispute = await this.prisma.dispute.findFirst({
        where: {
          jobId,
          status: DisputeStatus.OPEN,
        },
      });

      if (existingDispute) {
        throw new BadRequestException('Dispute already exists for this job');
      }
    } else {
      throw new BadRequestException(
        'Either contractId or jobId must be provided',
      );
    }

    if (userId !== clientId && userId !== artisanId) {
      throw new BadRequestException(
        'You can only create disputes for contracts/jobs you participate in',
      );
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        id: randomUUID(),
        contractId: contractId || null,
        jobId: jobId || null,
        clientId,
        artisanId,
        amount,
        status: DisputeStatus.OPEN,
        evidenceImages: evidenceImages || [],
        evidenceVideos: evidenceVideos || [],
        evidenceMessages: [...(evidenceMessages || []), description],
        createdAt: new Date(),
      },
    });

    if (contractId) {
      await this.contractsService.markDisputed(contractId);
    }

    return dispute;
  }

  async resolveDispute(
    disputeId: string,
    decision: DisputeDecision,
    resolutionNotes: string,
    resolvedBy: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== DisputeStatus.OPEN) {
      throw new BadRequestException('Only open disputes can be resolved');
    }

    // Process dispute resolution with proper decision handling
    if (dispute.contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: dispute.contractId },
        include: { client: true, artisan: true },
      });

      if (!contract) {
        throw new NotFoundException('Linked contract not found');
      }

      // Execute decision based on admin resolution
      if (decision === DisputeDecision.REFUND_CLIENT) {
        await this.paymentsService.refundContract(
          dispute.contractId,
          contract.clientId,
          true,
          resolutionNotes,
        );
      } else if (decision === DisputeDecision.PAY_ARTISAN) {
        await this.paymentsService.releaseEscrowByAdmin(
          dispute.contractId,
          resolutionNotes,
        );
      }
    }

    // Update dispute status
    const updatedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.RESOLVED,
        resolutionDecision: decision,
        resolutionNotes,
        resolvedBy,
        resolvedAt: new Date(),
      },
    });

    return updatedDispute;
  }

  async updateDispute(
    disputeId: string,
    status?: DisputeStatus,
    resolutionDecision?: DisputeDecision,
    resolutionNotes?: string,
    resolvedBy?: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (status === DisputeStatus.RESOLVED && resolutionDecision && resolvedBy) {
      return this.resolveDispute(
        disputeId,
        resolutionDecision,
        resolutionNotes || '',
        resolvedBy,
      );
    }

    const updateData: any = {
      ...(resolutionDecision && { resolutionDecision }),
      ...(resolutionNotes && { resolutionNotes }),
      ...(resolvedBy && { resolvedBy }),
    };

    if (status) {
      updateData.status = status;
      if (status === DisputeStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
      }
    }

    const updatedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: updateData,
    });

    return updatedDispute;
  }

  async getDisputesByUser(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [{ clientId: userId }, { artisanId: userId }],
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getDisputeById(disputeId: string, userId?: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (userId && userId !== dispute.clientId && userId !== dispute.artisanId) {
      throw new BadRequestException(
        'Access denied: You can only view disputes you participate in',
      );
    }

    return dispute;
  }
}
