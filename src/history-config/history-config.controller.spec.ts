import { Test, TestingModule } from '@nestjs/testing';
import { HistoryConfigController } from './history-config.controller';
import { HistoryConfigService } from './history-config.service';
import { UpdateHistoryConfigDto } from './dto/update-history-config.dto';
import { HistoryType } from '@prisma/client';
import { HistoryConfigResponseDto } from './dto/response/history-config-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

describe('HistoryConfigController', () => {
    let controller: HistoryConfigController;
    let service: HistoryConfigService;

    const mockHistoryConfigService = {
        update: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HistoryConfigController],
            providers: [
                {
                    provide: HistoryConfigService,
                    useValue: mockHistoryConfigService,
                },
            ],
        }).compile();

        controller = module.get<HistoryConfigController>(HistoryConfigController);
        service = module.get<HistoryConfigService>(HistoryConfigService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should update a history config', async () => {
        const id = 1;
        const dto: UpdateHistoryConfigDto = { historyType: HistoryType.SCHEDULED, loggingTime: 60 };
        const expectedResponse = new HistoryConfigResponseDto({ id: id.toString(), name: 'Test', historyType: HistoryType.SCHEDULED, loggingTime: 60 });
        
        mockHistoryConfigService.update.mockResolvedValue(expectedResponse);
        
        const result = await controller.update(id, dto);
        
        expect(service.update).toHaveBeenCalledWith(id, dto);
        expect(result).toEqual(expectedResponse);
    });

    it('should remove a history config', async () => {
        const id = 1;
        const expectedResponse = new ActionResponseDto({ success: true, message: 'Removed', id: id.toString(), count: 1 });
        
        mockHistoryConfigService.remove.mockResolvedValue(expectedResponse);
        
        const result = await controller.delete(id);
        
        expect(service.remove).toHaveBeenCalledWith(id);
        expect(result).toEqual(expectedResponse);
    });
});
