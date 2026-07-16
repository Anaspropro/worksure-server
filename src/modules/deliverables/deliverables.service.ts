import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubmitDeliverableVersionDto } from './dto/submit-version.dto';
import { RequestRevisionDto } from './dto/request-revision.dto';
import { DeliverableStatus, RevisionStatus } from '../../generated/prisma';
import { DeliverableApprovedEvent, DeliverableSubmittedEvent, RevisionRequestedEvent } from './events/deliverables.events';
import { DomainEventName } from '../../common/events/domain.events';

@Injectable()
export class DeliverablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getDeliverableForContract(contractId: string) {
    let deliverable = await this.prisma.deliverable.findFirst({
      where: { contractId },
      include: {
        versions: {
          include: {
            attachments: true,
            revisions: true,
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!deliverable) {
      deliverable = await this.prisma.deliverable.create({
        data: { contractId, status: DeliverableStatus.NOT_STARTED },
        include: {
          versions: {
            include: { attachments: true, revisions: true },
          },
        },
      });
    }
    return deliverable;
  }

  async submitVersion(contractId: string, artisanId: string, dto: SubmitDeliverableVersionDto) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract || contract.artisanId !== artisanId) {
      throw new ForbiddenException('Only the assigned artisan can submit deliverables');
    }

    const deliverable = await this.getDeliverableForContract(contractId);

    if (deliverable.status === DeliverableStatus.APPROVED || deliverable.status === DeliverableStatus.COMPLETED) {
      throw new BadRequestException('Cannot submit to an approved or completed deliverable');
    }

    const nextVersionNumber = (deliverable.versions?.[0]?.versionNumber ?? 0) + 1;

    const updatedDeliverable = await this.prisma.$transaction(async (tx) => {
      const version = await tx.deliverableVersion.create({
        data: {
          deliverableId: deliverable.id,
          versionNumber: nextVersionNumber,
          artisanNotes: dto.artisanNotes,
          attachments: {
            create: dto.attachments.map((a) => ({
              type: a.type,
              url: a.url,
              name: a.name,
              sizeBytes: a.sizeBytes,
              mimeType: a.mimeType,
            })),
          },
        },
      });

      const nextStatus = nextVersionNumber === 1 ? DeliverableStatus.SUBMITTED : DeliverableStatus.RESUBMITTED;

      const updated = await tx.deliverable.update({
        where: { id: deliverable.id },
        data: { status: nextStatus },
        include: {
          versions: { include: { attachments: true, revisions: true }, orderBy: { versionNumber: 'desc' } },
        },
      });

      return { updated, version };
    });

    this.eventEmitter.emit(
      DomainEventName.DELIVERABLE_SUBMITTED,
      new DeliverableSubmittedEvent(updatedDeliverable.updated.id, updatedDeliverable.version.id, contractId, artisanId),
    );

    return updatedDeliverable.updated;
  }

  async markAsViewed(deliverableId: string, clientId: string) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      include: { contract: true },
    });

    if (!deliverable || deliverable.contract.clientId !== clientId) {
      throw new ForbiddenException('Only the client can view this deliverable');
    }

    if (deliverable.status === DeliverableStatus.SUBMITTED || deliverable.status === DeliverableStatus.RESUBMITTED) {
      return this.prisma.deliverable.update({
        where: { id: deliverableId },
        data: { status: DeliverableStatus.UNDER_REVIEW },
      });
    }

    return deliverable;
  }

  async requestRevision(deliverableId: string, clientId: string, dto: RequestRevisionDto) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      include: { contract: true, versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!deliverable || deliverable.contract.clientId !== clientId) {
      throw new ForbiddenException('Only the client can request revisions');
    }

    if (deliverable.status === DeliverableStatus.APPROVED || deliverable.status === DeliverableStatus.COMPLETED) {
      throw new BadRequestException('Cannot request revision on an approved deliverable');
    }

    const latestVersion = deliverable.versions[0];
    if (!latestVersion) {
      throw new BadRequestException('No version submitted yet to review');
    }

    const updatedDeliverable = await this.prisma.$transaction(async (tx) => {
      const revision = await tx.revisionRequest.create({
        data: {
          versionId: latestVersion.id,
          requestedBy: clientId,
          comment: dto.comment,
          requiredChanges: dto.requiredChanges,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: RevisionStatus.PENDING,
        },
      });

      const updated = await tx.deliverable.update({
        where: { id: deliverableId },
        data: { status: DeliverableStatus.REVISION_REQUESTED },
      });

      return { updated, revision };
    });

    this.eventEmitter.emit(
      DomainEventName.DELIVERABLE_REVISION_REQUESTED,
      new RevisionRequestedEvent(deliverableId, latestVersion.id, deliverable.contractId, clientId, updatedDeliverable.revision.id),
    );

    return updatedDeliverable.updated;
  }

  async approve(deliverableId: string, clientId: string) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      include: { contract: true, versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!deliverable || deliverable.contract.clientId !== clientId) {
      throw new ForbiddenException('Only the client can approve this deliverable');
    }

    const latestVersion = deliverable.versions[0];
    if (!latestVersion) {
      throw new BadRequestException('No version submitted yet to approve');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Mark pending revisions as resolved
      await tx.revisionRequest.updateMany({
        where: { versionId: latestVersion.id, status: RevisionStatus.PENDING },
        data: { status: RevisionStatus.RESOLVED },
      });

      return tx.deliverable.update({
        where: { id: deliverableId },
        data: { status: DeliverableStatus.APPROVED, approvedAt: new Date() },
      });
    });

    this.eventEmitter.emit(
      DomainEventName.DELIVERABLE_APPROVED,
      new DeliverableApprovedEvent(deliverableId, deliverable.contractId, clientId),
    );

    return updated;
  }
}

