export interface AlertPayload {
  incidentKey: string;
  title: string;
  message: string;
  severity: 'error' | 'critical' | 'fatal';
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface RecoveryPayload {
  incidentKey: string;
  title: string;
  message: string;
  downtimeMs: number;
  timestamp: Date;
}

export interface AlertProvider {
  sendAlert(payload: AlertPayload): Promise<void>;
  sendRecovery(payload: RecoveryPayload): Promise<void>;
}
