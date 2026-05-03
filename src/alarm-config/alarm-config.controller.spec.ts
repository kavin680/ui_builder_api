import { Test, TestingModule } from '@nestjs/testing';
import { AlarmConfigController } from './alarm-config.controller';
import { AlarmConfigService } from './alarm-config.service';
import { AlarmEvaluationService } from './alarm-evaluation.service';
import { CreateAlarmDto } from './dto/create-alarm.dto';
import { UpdateAlarmDto } from './dto/update-alarm.dto';
import { AlarmHistoryQueryDto } from './dto/alarm-history-query.dto';
import { AcknowledgeAlarmDto, AcknowledgeBatchDto } from './dto/acknowledge-alarm.dto';
import { ParseIntPipe } from '@nestjs/common';

describe('AlarmConfigController', () => {
    let controller: AlarmConfigController;
    let service: AlarmConfigService;
    let evalService: AlarmEvaluationService;

    const mockAlarmService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        getActiveAlarms: jest.fn(),
        getHistory: jest.fn(),
        exportHistoryToExcel: jest.fn(),
        acknowledge: jest.fn(),
        acknowledgeAll: jest.fn(),
        acknowledgeBatch: jest.fn(),
    };

    const mockEvalService = {
        handleValueChange: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AlarmConfigController],
            providers: [
                {
                    provide: AlarmConfigService,
                    useValue: mockAlarmService,
                },
                {
                    provide: AlarmEvaluationService,
                    useValue: mockEvalService,
                },
            ],
        }).compile();

        controller = module.get<AlarmConfigController>(AlarmConfigController);
        service = module.get<AlarmConfigService>(AlarmConfigService);
        evalService = module.get<AlarmEvaluationService>(AlarmEvaluationService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('CRUD operations', () => {
        it('should create an alarm', async () => {
            const dto: CreateAlarmDto = { name: 'Test Alarm' } as any;
            mockAlarmService.create.mockResolvedValue({ id: 1 });
            await controller.create(dto);
            expect(service.create).toHaveBeenCalledWith(dto);
        });

        it('should find all alarms', async () => {
            mockAlarmService.findAll.mockResolvedValue([]);
            await controller.findAll();
            expect(service.findAll).toHaveBeenCalled();
        });

        it('should find one alarm', async () => {
            const id = 1;
            mockAlarmService.findOne.mockResolvedValue({ id });
            await controller.findOne(id);
            expect(service.findOne).toHaveBeenCalledWith(id);
        });

        it('should update an alarm', async () => {
            const id = 1;
            const dto: UpdateAlarmDto = { name: 'Updated' } as any;
            mockAlarmService.update.mockResolvedValue({ id });
            await controller.update(id, dto);
            expect(service.update).toHaveBeenCalledWith(id, dto);
        });

        it('should remove an alarm', async () => {
            const id = 1;
            mockAlarmService.remove.mockResolvedValue({ success: true });
            await controller.remove(id);
            expect(service.remove).toHaveBeenCalledWith(id);
        });
    });

    describe('Alarms Status & History', () => {
        it('should get active alarms', async () => {
            mockAlarmService.getActiveAlarms.mockResolvedValue([]);
            await controller.getActiveAlarms();
            expect(service.getActiveAlarms).toHaveBeenCalled();
        });

        it('should get history', async () => {
            const query: AlarmHistoryQueryDto = { alarmId: 1 } as any;
            mockAlarmService.getHistory.mockResolvedValue([]);
            await controller.getHistory(query);
            expect(service.getHistory).toHaveBeenCalledWith(query);
        });
    });

    describe('Acknowledgement', () => {
        it('should acknowledge an alarm', async () => {
            const id = 1;
            const dto: AcknowledgeAlarmDto = { userId: 123 };
            mockAlarmService.acknowledge.mockResolvedValue({ id });
            await controller.acknowledge(id, dto);
            expect(service.acknowledge).toHaveBeenCalledWith(id, dto.userId);
        });

        it('should acknowledge all alarms', async () => {
            const dto: AcknowledgeAlarmDto = { userId: 123 };
            mockAlarmService.acknowledgeAll.mockResolvedValue({ count: 5 });
            await controller.acknowledgeAll(dto);
            expect(service.acknowledgeAll).toHaveBeenCalledWith(dto.userId);
        });

        it('should acknowledge a batch of alarms', async () => {
            const dto: AcknowledgeBatchDto = { ids: [1, 2], userId: 123 };
            mockAlarmService.acknowledgeBatch.mockResolvedValue({ count: 2 });
            await controller.acknowledgeBatch(dto);
            expect(service.acknowledgeBatch).toHaveBeenCalledWith(dto.ids, dto.userId);
        });
    });

    describe('Testing', () => {
        it('should test an alarm', async () => {
            const id = 1;
            const value = '100';
            mockEvalService.handleValueChange.mockResolvedValue(undefined);
            await controller.testAlarm(id, value);
            expect(evalService.handleValueChange).toHaveBeenCalledWith(BigInt(id), value);
        });
    });
});
