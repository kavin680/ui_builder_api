import { Test, TestingModule } from '@nestjs/testing';
import { AlarmConfigService } from './alarm-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlarmEvaluationService } from './alarm-evaluation.service';
import { AppCacheService } from '../common/cache/cache.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { plainToInstance } from 'class-transformer';
import { AlarmResponseDto } from './dto/response/alarm-response.dto';

const mockPrismaService = {
    alarm: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    alarmStatus: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    alarmHistory: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
    },
    $transaction: jest.fn(),
};

const mockAlarmEvaluationService = {
    evaluate: jest.fn(),
};

const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
};

const mockEventBus = {
    emit: jest.fn(),
};

describe('AlarmConfigService', () => {
    let service: AlarmConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AlarmConfigService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
                {
                    provide: AlarmEvaluationService,
                    useValue: mockAlarmEvaluationService,
                },
                {
                    provide: AppCacheService,
                    useValue: mockCacheService,
                },
                {
                    provide: DomainEventBus,
                    useValue: mockEventBus,
                },
            ],
        }).compile();

        service = module.get<AlarmConfigService>(AlarmConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('should return all alarms', async () => {
            const alarms = [{ id: BigInt(1), name: 'Test Alarm' }];
            mockPrismaService.alarm.findMany.mockResolvedValue(alarms);

            const result = await service.findAll();
            expect(result).toEqual(plainToInstance(AlarmResponseDto, alarms));
            expect(mockPrismaService.alarm.findMany).toHaveBeenCalled();
        });
    });
});
