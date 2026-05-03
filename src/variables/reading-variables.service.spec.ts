import { Test, TestingModule } from '@nestjs/testing';
import { ReadingVariablesService } from './reading-variables.service';
import { ActionResponseDto } from '../common/dto/action-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { AlarmConfigService } from '../alarm-config/alarm-config.service';
import { GlobalConfigurationsService } from '../global-configurations/global-configurations.service';
import { AppCacheService } from '../common/cache/cache.service';
import { VariablesGateway } from './variables.gateway';
import { getQueueToken } from '@nestjs/bullmq';

const mockPrismaService = {
    readingVariable: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
    },
    readingVariableHistory: {
        createMany: jest.fn(),
    },
    writingVariable: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRawUnsafe: jest.fn(),
};

const mockAlarmConfigService = {
    evaluateAlarms: jest.fn(),
};

const mockEventBus = {
    emit: jest.fn(),
};

const mockGlobalConfigService = {
    findOne: jest.fn(),
};

const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
};

const mockVariablesGateway = {
    emitBulk: jest.fn(),
};

const mockQueue = {
    add: jest.fn(),
};

describe('ReadingVariablesService', () => {
    let service: ReadingVariablesService;
    let prisma: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReadingVariablesService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
                {
                    provide: AlarmConfigService,
                    useValue: mockAlarmConfigService,
                },
                {
                    provide: DomainEventBus,
                    useValue: mockEventBus,
                },
                {
                    provide: GlobalConfigurationsService,
                    useValue: mockGlobalConfigService,
                },
                {
                    provide: AppCacheService,
                    useValue: mockCacheService,
                },
                {
                    provide: VariablesGateway,
                    useValue: mockVariablesGateway,
                },
                {
                    provide: getQueueToken('variable-update'),
                    useValue: mockQueue,
                },
                {
                    provide: getQueueToken('alarm-evaluation'),
                    useValue: mockQueue,
                },
            ],
        }).compile();

        service = module.get<ReadingVariablesService>(ReadingVariablesService);
        prisma = module.get(PrismaService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createReadingVariable', () => {
        it('should upsert a reading variable and invalidate cache', async () => {
            const dto = {
                globalConfigId: 1,
                name: 'Temp',
                value: 10,
                isActive: true,
            };

            mockPrismaService.readingVariable.upsert.mockResolvedValue({ id: BigInt(1) });

            const result = await service.createReadingVariable(dto as any);

            expect(mockPrismaService.readingVariable.upsert).toHaveBeenCalled();
            expect(mockCacheService.del).toHaveBeenCalledWith('reading_variables_config_1');
            expect(result).toEqual(new ActionResponseDto({
              success: true,
              message: 'Reading variable created/updated successfully',
              id: '1',
              count: 1,
            }));
        });
    });

    describe('updateReadingVariablesByIndex', () => {
        it('should update variables and emit event', async () => {
            const globalConfigId = 1;
            const values = ['10', '20'];

            mockGlobalConfigService.findOne.mockResolvedValue({ alterFlag: false });
            mockCacheService.get.mockResolvedValue([
                { id: BigInt(1), name: 'V1', sequenceNo: 1, historyType: 'NONE' },
                { id: BigInt(2), name: 'V2', sequenceNo: 2, historyType: 'NONE' },
            ]);
            mockPrismaService.$executeRawUnsafe.mockResolvedValue(1);

            const result = await service.updateReadingVariablesByIndex(globalConfigId, values);

            expect(mockEventBus.emit).toHaveBeenCalled();
            expect(result.count).toBe(2);
        });
    });
});
