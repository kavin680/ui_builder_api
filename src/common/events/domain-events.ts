export enum DomainEvent {
  TELEMETRY_UPDATED = 'telemetry.updated',
  ALARM_TRIGGERED = 'alarm.triggered',
  ALARM_CLEARED = 'alarm.cleared',
  ALARM_ACKNOWLEDGED = 'alarm.acknowledged',
  CONFIG_CHANGED = 'config.changed',
}

export interface TelemetryUpdatedPayload {
  globalConfigId: number;
  updates: {
    variableId: string;
    variableName: string;
    value: string;
    isCalculated?: boolean;
    historyType?: "INSTANT" | "ON_CHANGE" | "SCHEDULED" | "NONE" | "UTILITY";
  }[];
}

export interface AlarmEventPayload {
  alarmId: string;
  variableId: string;
  name: string;
  type: 'I' | 'IO' | 'IAO' | 'IA' | 'IOA';
  priority: string;
  value: string;
  timestamp: Date;
}

export type DomainEventPayloads = {
  [DomainEvent.TELEMETRY_UPDATED]: TelemetryUpdatedPayload;
  [DomainEvent.ALARM_TRIGGERED]: AlarmEventPayload;
  [DomainEvent.ALARM_CLEARED]: AlarmEventPayload;
  [DomainEvent.ALARM_ACKNOWLEDGED]: AlarmEventPayload;
  [DomainEvent.CONFIG_CHANGED]: { configId: number; type: string };
};
