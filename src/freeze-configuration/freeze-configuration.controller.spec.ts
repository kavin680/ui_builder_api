import { Test, TestingModule } from '@nestjs/testing';
import { FreezeConfigurationController } from './freeze-configuration.controller';
import { FreezeConfigurationService } from './freeze-configuration.service';
import { CreateFreezeConfigurationDto } from './dto/create-freeze-configuration.dto';
import { UpdateFreezeConfigurationDto } from './dto/update-freeze-configuration.dto';

describe('FreezeConfigurationController', () => {
    let controller: FreezeConfigurationController;
    let service: FreezeConfigurationService;

    const mockFreezeService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        findByGlobalConfigId: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [FreezeConfigurationController],
            providers: [
                {
                    provide: FreezeConfigurationService,
                    useValue: mockFreezeService,
                },
            ],
        }).compile();

        controller = module.get<FreezeConfigurationController>(FreezeConfigurationController);
        service = module.get<FreezeConfigurationService>(FreezeConfigurationService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should create a freeze config', async () => {
        const dto: CreateFreezeConfigurationDto = { globalConfigId: 1 } as any;
        mockFreezeService.create.mockResolvedValue({ id: 1 });
        await controller.create(dto);
        expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('should find one freeze config', async () => {
        const id = 1;
        mockFreezeService.findOne.mockResolvedValue({ id });
        await controller.findOne(id);
        expect(service.findOne).toHaveBeenCalledWith(id);
    });

    it('should find by global config id', async () => {
        const globalId = 123;
        mockFreezeService.findByGlobalConfigId.mockResolvedValue([]);
        await controller.findByGlobalConfigId(globalId);
        expect(service.findByGlobalConfigId).toHaveBeenCalledWith(globalId);
    });

    it('should update a freeze config', async () => {
        const id = 1;
        const dto: UpdateFreezeConfigurationDto = { isEnabled: true };
        mockFreezeService.update.mockResolvedValue({ id });
        await controller.update(id, dto);
        expect(service.update).toHaveBeenCalledWith(id, dto);
    });

    it('should remove a freeze config', async () => {
        const id = 1;
        mockFreezeService.remove.mockResolvedValue({ success: true });
        await controller.remove(id);
        expect(service.remove).toHaveBeenCalledWith(id);
    });
});
