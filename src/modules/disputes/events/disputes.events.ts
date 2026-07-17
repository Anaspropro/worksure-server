export class DisputeOpenedEvent {
  constructor(
    public readonly disputeId: string,
    public readonly contractId: string,
    public readonly initiatorId: string,
  ) {}
}

export class DisputeEvidenceSubmittedEvent {
  constructor(
    public readonly disputeId: string,
    public readonly evidenceId: string,
    public readonly submittedBy: string,
  ) {}
}

export class DisputeResolvedEvent {
  constructor(
    public readonly disputeId: string,
    public readonly contractId: string,
    public readonly resolvedBy: string,
    public readonly outcome: string,
    public readonly resolutionSplit: Record<string, number> | null,
  ) {}
}

export class DisputeStateChangedEvent {
  constructor(
    public readonly disputeId: string,
    public readonly oldState: string,
    public readonly newState: string,
    public readonly changedBy: string,
  ) {}
}
