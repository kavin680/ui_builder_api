import { Test, TestingModule } from '@nestjs/testing';
import { HistorySchedulerService } from './history-scheduler.service';

describe('SchedulerService', () => {
  let service: HistorySchedulerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HistorySchedulerService],
    }).compile();

    service = module.get<HistorySchedulerService>(HistorySchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
