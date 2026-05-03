import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEventBus } from './domain-event-bus.service';
import { DomainEvent } from './domain-events';

describe('DomainEventBus', () => {
  let service: DomainEventBus;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainEventBus,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            emitAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DomainEventBus>(DomainEventBus);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should emit an event through EventEmitter2', () => {
    const payload = { 
      globalConfigId: 1, 
      updates: [{ variableId: '1', variableName: 'V1', value: '10', isCalculated: false }] 
    };
    service.emit(DomainEvent.TELEMETRY_UPDATED, payload);
    expect(eventEmitter.emit).toHaveBeenCalledWith(DomainEvent.TELEMETRY_UPDATED, payload);
  });
});
