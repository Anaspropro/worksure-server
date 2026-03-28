import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'node:crypto';
import { DisputeStatus, DisputeDecision } from '../../generated/prisma';

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Validate contract or job exists and get participant IDs
    if (contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
      });

      if (!contract) {
        throw new NotFoundException('Contract not found');
      }

      clientId = contract.clientId;
      artisanId = contract.artisanId;

      // Check if dispute already exists for this contract
      const existingDispute = await this.prisma.dispute.findFirst({
        where: {
          contractId,
          status: DisputeStatus.OPEN,
        },
      });

      if (existingDispute) {
        throw new BadRequestException('Dispute already exists for this contract');
      }
    } else if (jobId) {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new NotFoundException('Job not found');
      }

      clientId = job.clientId;
      artisanId = job.artisanId || '';

      // Check if dispute already exists for this job
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
      throw new BadRequestException('Either contractId or jobId must be provided');
    }

    // Check if user is participant
    if (userId !== clientId && userId !== artisanId) {
      throw new BadRequestException('You can only create disputes for contracts/jobs you participate in');
    }

    // Create dispute
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
        evidenceMessages: [...(evidenceMessages || []), description], // Add description as first message
        createdAt: new Date(),
      },
    });

    return dispute;
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

    // Validate status transitions
    if (status) {
      this.validateStatusTransition(dispute.status, status);
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
    return await this.prisma.dispute.findMany({
      where: {
        OR: [
          { clientId: userId },
          { artisanId: userId },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDisputeById(disputeId: string, userId?: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        user: {
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

    // Check access if userId provided
    if (userId) {
      if (userId !== dispute.clientId && userId !== dispute.artisanId) {
        throw new BadRequestException('Access denied: You can only view disputes you participate in');
      }
    }

    return dispute;
  }

  private validateStatusTransition(currentStatus: DisputeStatus, newStatus: DisputeStatus) {
    const validTransitions: Record<DisputeStatus, DisputeStatus[]> = {
      [DisputeStatus.OPEN]: [DisputeStatus.RESOLVED],
      [DisputeStatus.RESOLVED]: [], // No transitions from resolved
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  getDefinition() {
    return {
      name: 'disputes',
      description: 'Handles user disputes and conflict resolution',
      responsibilities: [
        'Create and manage user disputes',
        'Validate dispute eligibility',
        'Track dispute status and resolution',
        'Handle dispute evidence and documentation',
        'Manage dispute workflow and transitions',
        'Provide dispute history and reporting',
      ],
      rules: [
        'Users can only create disputes for contracts/jobs they participate in',
        'Only one active dispute per contract/job',
        'Dispute status transitions are enforced',
        'Admin users can resolve disputes',
        'Dispute evidence is stored securely',
        'Resolution details are documented',
      ],
    };
  }
}
