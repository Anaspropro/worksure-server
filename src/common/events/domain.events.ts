export enum DomainEventName {
  // Job Events
  JOB_POSTED = 'job.posted',
  JOB_ASSIGNED = 'job.assigned',
  JOB_COMPLETED = 'job.completed',

  // Proposal Events
  PROPOSAL_SUBMITTED = 'proposal.submitted',
  PROPOSAL_ACCEPTED = 'proposal.accepted',
  PROPOSAL_REJECTED = 'proposal.rejected',

  // Contract Events
  CONTRACT_FUNDED = 'contract.funded',
  CONTRACT_COMPLETED = 'contract.completed',
  CONTRACT_CANCELLED = 'contract.cancelled',

  // Payment Events
  PAYMENT_PROCESSED = 'payment.processed',
  PAYMENT_FAILED = 'payment.failed',

  // Dispute Events
  DISPUTE_RAISED = 'dispute.raised',
  DISPUTE_RESOLVED = 'dispute.resolved',
}

/**
 * Base Event structure to ensure consistent payloads
 * Suitable for eventual Kafka serialization
 */
export interface BaseDomainEvent {
  eventId: string;
  timestamp: Date;
}

export class JobPostedEvent implements BaseDomainEvent {
  eventId: string = crypto.randomUUID();
  timestamp: Date = new Date();
  
  constructor(
    public readonly jobId: string,
    public readonly clientId: string,
    public readonly jobTitle: string,
  ) {}
}

export class ProposalSubmittedEvent implements BaseDomainEvent {
  eventId: string = crypto.randomUUID();
  timestamp: Date = new Date();
  
  constructor(
    public readonly proposalId: string,
    public readonly jobId: string,
    public readonly jobTitle: string,
    public readonly artisanId: string,
    public readonly clientId: string,
  ) {}
}

export class ProposalAcceptedEvent implements BaseDomainEvent {
  eventId: string = crypto.randomUUID();
  timestamp: Date = new Date();
  
  constructor(
    public readonly proposalId: string,
    public readonly jobId: string,
    public readonly jobTitle: string,
    public readonly artisanId: string,
    public readonly clientId: string,
  ) {}
}

export class ContractFundedEvent implements BaseDomainEvent {
  eventId: string = crypto.randomUUID();
  timestamp: Date = new Date();
  
  constructor(
    public readonly contractId: string,
    public readonly contractReference: string,
    public readonly jobId: string,
    public readonly jobTitle: string,
    public readonly clientId: string,
    public readonly artisanId: string,
    public readonly amount: number,
  ) {}
}

export class PaymentReleasedEvent implements BaseDomainEvent {
  eventId: string = crypto.randomUUID();
  timestamp: Date = new Date();
  
  constructor(
    public readonly paymentId: string,
    public readonly contractId: string,
    public readonly jobId: string,
    public readonly jobTitle: string,
    public readonly artisanId: string,
    public readonly amount: number,
  ) {}
}

export class DisputeRaisedEvent implements BaseDomainEvent {
  eventId: string = crypto.randomUUID();
  timestamp: Date = new Date();
  
  constructor(
    public readonly disputeId: string,
    public readonly contractId: string,
    public readonly contractReference: string,
    public readonly raisedById: string,
    public readonly relatedUserId: string, // The other party
  ) {}
}
