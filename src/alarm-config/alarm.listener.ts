import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEvent } from '../common/events/domain-events';
import type { AlarmEventPayload } from '../common/events/domain-events';
import { AlarmsGateway } from './alarms.gateway';
import { SocketAlarmEventDto } from '../common/dto/websocket/alarm-event.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class AlarmListener {
  private readonly logger = new Logger(AlarmListener.name);

  constructor(private readonly alarmsGateway: AlarmsGateway) {}

  @OnEvent(DomainEvent.ALARM_TRIGGERED)
  handleAlarmTriggered(payload: AlarmEventPayload) {
    try {
      this.logger.log(`Alarm Triggered Event: ${payload.name} (${payload.alarmId})`);
      this.emitToGateway(payload);
    } catch (error) {
      this.logger.error(`Error handling alarm triggered event: ${error.message}`, error.stack);
    }
  }

  @OnEvent(DomainEvent.ALARM_CLEARED)
  handleAlarmCleared(payload: AlarmEventPayload) {
    try {
      this.logger.log(`Alarm Cleared Event: ${payload.name} (${payload.alarmId})`);
      this.emitToGateway(payload);
    } catch (error) {
      this.logger.error(`Error handling alarm cleared event: ${error.message}`, error.stack);
    }
  }

  @OnEvent(DomainEvent.ALARM_ACKNOWLEDGED)
  handleAlarmAcknowledged(payload: AlarmEventPayload) {
    try {
      this.logger.log(`Alarm Acknowledged Event: ${payload.name} (${payload.alarmId})`);
      this.emitToGateway(payload);
    } catch (error) {
      this.logger.error(`Error handling alarm acknowledged event: ${error.message}`, error.stack);
    }
  }

  private emitToGateway(payload: AlarmEventPayload) {
    if (!payload || !payload.alarmId) {
      this.logger.error('Received malformed alarm payload, skipping WebSocket emission', { payload });
      return;
    }

    try {
      const socketAlarm = plainToInstance(SocketAlarmEventDto, {
        id: payload.alarmId,
        variableId: payload.variableId,
        name: payload.name,
        type: payload.type,
        priority: payload.priority,
        value: payload.value,
        timestamp: payload.timestamp || new Date(),
        isAcknowledged: payload.type?.includes('A'), // Simple detection from log types
      }, { excludeExtraneousValues: true });

      if (payload.type === 'I' || payload.type === 'IA') {
        this.alarmsGateway.emitAlarmTriggered(socketAlarm);
      } else {
        this.alarmsGateway.emitAlarmCleared(socketAlarm);
      }
    } catch (err) {
      this.logger.error(`Critical failure in alarm WebSocket emission: ${err.message}`, err.stack);
    }
  }
}
