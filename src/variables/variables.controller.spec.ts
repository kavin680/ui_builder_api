import { Test, TestingModule } from '@nestjs/testing';
import { VariablesController } from './variables.controller';
import { ReadingVariablesService } from './reading-variables.service';
import { WritingVariablesService } from './writing-variables.service';
import { ReadingVariablesConsumptionService } from './reading-variables-consumption.service';
import { GetReadingHistoryDto } from './dto/get-reading-history.dto';
import { GetConsumptionDto, ConsumptionType } from './dto/get-consumption.dto';
import { ExportConsumptionRawDto } from './dto/export-consumption-raw.dto';

describe('VariablesController', () => {
    let controller: VariablesController;
    let readingService: ReadingVariablesService;
    let writingService: WritingVariablesService;
    let consumptionService: ReadingVariablesConsumptionService;

    const mockReadingService = {
        findAllReadingVariables: jest.fn(),
        findAllActiveReadingVariables: jest.fn(),
        createReadingVariable: jest.fn(),
        updateReadingVariablesByIndex: jest.fn(),
        deleteAllReadingVariables: jest.fn(),
        getReadingHistory: jest.fn(),
        exportReadingHistoryToExcel: jest.fn(),
    };

    const mockWritingService = {
        findAllWritingVariables: jest.fn(),
        findAllActiveWritingVariables: jest.fn(),
        createWritingVariable: jest.fn(),
        updateWritingVariable: jest.fn(),
        deleteAllWritingVariables: jest.fn(),
        findAllMboByWritingVariable: jest.fn(),
        updateMboVariable: jest.fn(),
        findAllEncodedWritingVariables: jest.fn(),
    };

    const mockConsumptionService = {
        getConsumptionData: jest.fn(),
        exportConsumptionRawToExcel: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [VariablesController],
            providers: [
                {
                    provide: ReadingVariablesService,
                    useValue: mockReadingService,
                },
                {
                    provide: WritingVariablesService,
                    useValue: mockWritingService,
                },
                {
                    provide: ReadingVariablesConsumptionService,
                    useValue: mockConsumptionService,
                },
            ],
        }).compile();

        controller = module.get<VariablesController>(VariablesController);
        readingService = module.get<ReadingVariablesService>(ReadingVariablesService);
        writingService = module.get<WritingVariablesService>(WritingVariablesService);
        consumptionService = module.get<ReadingVariablesConsumptionService>(ReadingVariablesConsumptionService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('Reading Variables', () => {
        it('should get all active reading variables', async () => {
            mockReadingService.findAllActiveReadingVariables.mockResolvedValue([]);
            await controller.getAllActiveReading();
            expect(readingService.findAllActiveReadingVariables).toHaveBeenCalled();
        });

        it('should create a reading variable', async () => {
            const dto = { globalConfigId: 1, name: 'Test' };
            mockReadingService.createReadingVariable.mockResolvedValue({ count: 1 });
            await controller.createReadingVariable(dto as any);
            expect(readingService.createReadingVariable).toHaveBeenCalledWith(dto);
        });

        it('should get reading history', async () => {
            const query: GetReadingHistoryDto = {
                startDate: '2023-01-01',
                endDate: '2023-01-02',
                variableIds: [1, 2],
            };
            mockReadingService.getReadingHistory.mockResolvedValue([]);
            await controller.getReadingHistory(query);
            expect(readingService.getReadingHistory).toHaveBeenCalledWith(
                query.startDate,
                query.endDate,
                query.variableIds,
            );
        });

        it('should get consumption data', async () => {
            const query: GetConsumptionDto = {
                variableId: 1,
                type: ConsumptionType.DAY,
                count: 7,
            };
            mockConsumptionService.getConsumptionData.mockResolvedValue([]);
            await controller.getConsumption(query);
            expect(consumptionService.getConsumptionData).toHaveBeenCalledWith(
                query.variableId,
                query.type,
                query.count,
            );
        });

        it('should export consumption raw', async () => {
            const query: ExportConsumptionRawDto = {
                startDate: '2023-01-01',
                endDate: '2023-01-02',
                variableIds: [1],
            };
            const mockRes = {
                setHeader: jest.fn(),
                end: jest.fn(),
            };
            const mockWorkbook = {
                xlsx: { write: jest.fn().mockResolvedValue(undefined) },
            };
            mockConsumptionService.exportConsumptionRawToExcel.mockResolvedValue(mockWorkbook);

            await controller.exportConsumptionRaw(query, mockRes as any);

            expect(consumptionService.exportConsumptionRawToExcel).toHaveBeenCalledWith(
                query.startDate,
                query.endDate,
                query.variableIds,
            );
            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    describe('Writing Variables', () => {
        it('should get all active writing variables', async () => {
            mockWritingService.findAllActiveWritingVariables.mockResolvedValue([]);
            await controller.getAllActiveWriting();
            expect(writingService.findAllActiveWritingVariables).toHaveBeenCalled();
        });

        it('should update a writing variable', async () => {
            const dto = { id: 1, value: 100 };
            mockWritingService.updateWritingVariable.mockResolvedValue({ id: BigInt(1) });
            await controller.updateWritingVariable(dto as any);
            expect(writingService.updateWritingVariable).toHaveBeenCalledWith(dto);
        });

        it('should get MBO variables by writing variable ID', async () => {
            const writingVariableId = 123;
            mockWritingService.findAllMboByWritingVariable.mockResolvedValue([]);
            await controller.getMboByWritingVariable(writingVariableId);
            expect(writingService.findAllMboByWritingVariable).toHaveBeenCalledWith(writingVariableId);
        });
    });
});
