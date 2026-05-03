import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';
import { CreateSystemConfigDto } from './dto/create-system-config.dto';

describe('SystemConfigController', () => {
    let controller: SystemConfigController;
    let service: SystemConfigService;

    const mockSystemConfigService = {
        resetSystemConfig: jest.fn(),
        restoreSystemConfig: jest.fn(),
        backupSystemConfig: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SystemConfigController],
            providers: [
                {
                    provide: SystemConfigService,
                    useValue: mockSystemConfigService,
                },
            ],
        }).compile();

        controller = module.get<SystemConfigController>(SystemConfigController);
        service = module.get<SystemConfigService>(SystemConfigService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('reset', () => {
        it('should call service resetSystemConfig', async () => {
            const result = { success: true };
            mockSystemConfigService.resetSystemConfig.mockResolvedValue(result);
            expect(await controller.reset()).toEqual(result);
            expect(service.resetSystemConfig).toHaveBeenCalled();
        });
    });

    describe('restore', () => {
        it('should call service restoreSystemConfig with body data', async () => {
            const dto: CreateSystemConfigDto = { version: '1.0', data: {} } as any;
            const dryRun = true;
            const result = { success: true };
            mockSystemConfigService.restoreSystemConfig.mockResolvedValue(result);

            expect(await controller.restore(dto, undefined, dryRun)).toEqual(result);
            expect(service.restoreSystemConfig).toHaveBeenCalledWith(dto, dryRun);
        });

        it('should call service restoreSystemConfig with file data', async () => {
            const file = { buffer: Buffer.from('{"version":"1.0","data":{}}') };
            const dryRun = false;
            const result = { success: true };
            mockSystemConfigService.restoreSystemConfig.mockResolvedValue(result);

            await controller.restore(undefined as any, file as any, dryRun);
            expect(service.restoreSystemConfig).toHaveBeenCalledWith(
                JSON.parse(file.buffer.toString()),
                dryRun,
            );
        });
    });

    describe('backup', () => {
        it('should call service backupSystemConfig', async () => {
            const result = { configs: [] };
            const res = {
                setHeader: jest.fn(),
                send: jest.fn(),
            };
            mockSystemConfigService.backupSystemConfig.mockResolvedValue(result);
            await controller.backup(res as any);
            expect(service.backupSystemConfig).toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith(result);
        });
    });
});
