import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent, DomainEventPayloads } from './domain-events';

@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit<K extends DomainEvent>(event: K, payload: DomainEventPayloads[K]): void {
    this.logger.debug(`Emitting event: ${event}`);
    this.eventEmitter.emit(event, payload);
  }

  async emitAsync<K extends DomainEvent>(
    event: K,
    payload: DomainEventPayloads[K],
  ): Promise<any[]> {
    this.logger.debug(`Emitting async event: ${event}`);
    return this.eventEmitter.emitAsync(event, payload);
  }
}
