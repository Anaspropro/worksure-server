export class DeliverableSubmittedEvent {
  constructor(
    public readonly deliverableId: string,
    public readonly versionId: string,
    public readonly contractId: string,
    public readonly artisanId: string,
  ) {}
}

export class DeliverableApprovedEvent {
  constructor(
    public readonly deliverableId: string,
    public readonly contractId: string,
    public readonly clientId: string,
  ) {}
}

export class RevisionRequestedEvent {
  constructor(
    public readonly deliverableId: string,
    public readonly versionId: string,
    public readonly contractId: string,
    public readonly clientId: string,
    public readonly revisionRequestId: string,
  ) {}
}
