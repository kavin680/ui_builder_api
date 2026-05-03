import { Test, TestingModule } from '@nestjs/testing';
import { FreezeConfigurationService } from './freeze-configuration.service';

describe('FreezeConfigurationService', () => {
  let service: FreezeConfigurationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FreezeConfigurationService],
    }).compile();

    service = module.get<FreezeConfigurationService>(
      FreezeConfigurationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
