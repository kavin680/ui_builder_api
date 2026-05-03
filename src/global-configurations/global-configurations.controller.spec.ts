import { Test, TestingModule } from '@nestjs/testing';
import { GlobalConfigurationsController } from './global-configurations.controller';
import { GlobalConfigurationsService } from './global-configurations.service';
import { CreateGlobalConfigurationDto } from './dto/create-global-configuration.dto';
import { UpdateGlobalConfigurationDto } from './dto/update-global-configuration.dto';

describe('GlobalConfigurationsController', () => {
    let controller: GlobalConfigurationsController;
    let service: GlobalConfigurationsService;

    const mockGlobalService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GlobalConfigurationsController],
            providers: [
                {
                    provide: GlobalConfigurationsService,
                    useValue: mockGlobalService,
                },
            ],
        }).compile();

        controller = module.get<GlobalConfigurationsController>(GlobalConfigurationsController);
        service = module.get<GlobalConfigurationsService>(GlobalConfigurationsService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should create a global config', async () => {
        const dto: CreateGlobalConfigurationDto = { name: 'Test' } as any;
        mockGlobalService.create.mockResolvedValue({ id: 1 });
        await controller.create(dto);
        expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('should find one global config', async () => {
        const id = 1;
        mockGlobalService.findOne.mockResolvedValue({ id });
        await controller.findOne(id);
        expect(service.findOne).toHaveBeenCalledWith(id);
    });

    it('should update a global config', async () => {
        const id = 1;
        const dto: UpdateGlobalConfigurationDto = { name: 'Updated' };
        mockGlobalService.update.mockResolvedValue({ id });
        await controller.update(id, dto);
        expect(service.update).toHaveBeenCalledWith(id, dto);
    });

    it('should remove a global config', async () => {
        const id = 1;
        mockGlobalService.remove.mockResolvedValue({ success: true });
        await controller.remove(id);
        expect(service.remove).toHaveBeenCalledWith(id);
    });
});
