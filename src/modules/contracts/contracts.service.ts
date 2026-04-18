import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ContractStatus } from '../../generated/prisma';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async createContract(proposalId: string, userId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        job: true,
        client: true,
        artisan: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Proposal must be accepted to create contract',
      );
    }

    if (proposal.clientId !== userId) {
      throw new ForbiddenException('Only the client can create a contract');
    }

    if (!proposal.artisan.artisanVerified) {
      throw new BadRequestException(
        'Cannot create a contract for an unverified artisan.',
      );
    }

    const existingContract = await this.prisma.contract.findUnique({
      where: { proposalId },
    });

    if (existingContract) {
      throw new BadRequestException(
        'Contract already exists for this proposal',
      );
    }

    const contract = await this.prisma.$transaction(async (tx) => {
      const newContract = await tx.contract.create({
        data: {
          id: randomUUID(),
          jobId: proposal.jobId,
          proposalId,
          clientId: proposal.clientId,
          artisanId: proposal.artisanId,
          amount: proposal.amount,
          status: ContractStatus.DRAFT,
        },
        include: {
          job: true,
          proposal: true,
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

      await tx.job.update({
        where: { id: proposal.jobId },
        data: { contractId: newContract.id },
      });

      return newContract;
    });

    return contract;
  }

  async activateContract(contractId: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        payments: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.clientId !== userId && contract.artisanId !== userId) {
      throw new ForbiddenException(
        'Only contract parties can activate the contract',
      );
    }

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException(
        'Contract must be funded and active to start work',
      );
    }

    if (contract.startedAt) {
      throw new BadRequestException('Contract is already started');
    }

    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        startedAt: new Date(),
        activatedAt: new Date(),
      },
      include: {
        job: true,
        proposal: true,
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

    return updatedContract;
  }

  async fundContract(contractId: string, userId: string, amount: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.clientId !== userId) {
      throw new ForbiddenException('Only the client can fund the contract');
    }

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException(
        'Contract must be in DRAFT status to be funded',
      );
    }

    if (amount !== contract.amount) {
      throw new BadRequestException(
        'Funding amount must match contract amount',
      );
    }

    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status: ContractStatus.ACTIVE,
        fundedAt: new Date(),
      },
    });
  }

  async releaseEscrow(contractId: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        artisan: {
          select: {
            artisanVerified: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.clientId !== userId) {
      throw new ForbiddenException('Only the client can release escrow');
    }

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException(
        'Contract must be ACTIVE to release escrow',
      );
    }

    if (
      !contract.clientConfirmedCompletion ||
      !contract.artisanConfirmedCompletion
    ) {
      throw new BadRequestException(
        'Both parties must confirm completion before releasing escrow',
      );
    }

    if (contract.escrowReleased) {
      throw new BadRequestException('Escrow has already been released');
    }

    if (!contract.artisan.artisanVerified) {
      throw new BadRequestException(
        'Escrow cannot be released to an unverified artisan.',
      );
    }

    await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        escrowReleased: true,
        escrowReleasedAt: new Date(),
        status: ContractStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    return { message: 'Escrow released successfully' };
  }

  async refundContract(contractId: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.clientId !== userId) {
      throw new ForbiddenException('Only the client can request a refund');
    }

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException('Contract must be ACTIVE to refund');
    }

    if (contract.escrowReleased) {
      throw new BadRequestException(
        'Cannot refund contract after escrow release',
      );
    }

    await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status: ContractStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    return { message: 'Contract refunded successfully' };
  }

  async confirmCompletion(
    contractId: string,
    userId: string,
    isClient: boolean,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (isClient && contract.clientId !== userId) {
      throw new ForbiddenException('Only the client can confirm completion');
    }

    if (!isClient && contract.artisanId !== userId) {
      throw new ForbiddenException('Only the artisan can confirm completion');
    }

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException(
        'Contract must be ACTIVE to confirm completion',
      );
    }

    if (!contract.startedAt) {
      throw new BadRequestException(
        'Contract must be activated before completion can be confirmed.',
      );
    }

    if (isClient && contract.clientConfirmedCompletion) {
      throw new BadRequestException('Client has already confirmed completion.');
    }

    if (!isClient && contract.artisanConfirmedCompletion) {
      throw new BadRequestException(
        'Artisan has already confirmed completion.',
      );
    }

    const updateData: any = {
      [isClient ? 'clientConfirmedCompletion' : 'artisanConfirmedCompletion']:
        true,
      [isClient ? 'clientConfirmedAt' : 'artisanConfirmedAt']: new Date(),
    };

    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: updateData,
      include: {
        job: true,
        proposal: true,
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

    return updatedContract;
  }

  async getContract(contractId: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        job: true,
        proposal: true,
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
        payments: true,
        review: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.clientId !== userId && contract.artisanId !== userId) {
      throw new ForbiddenException(
        'Only contract parties can view contract details',
      );
    }

    return contract;
  }

  async getUserContracts(userId: string, status?: ContractStatus) {
    const where: any = {
      OR: [{ clientId: userId }, { artisanId: userId }],
    };

    if (status) {
      where.status = status;
    }

    const contracts = await this.prisma.contract.findMany({
      where,
      include: {
        job: true,
        proposal: true,
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
        payments: true,
        review: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return contracts;
  }
}
