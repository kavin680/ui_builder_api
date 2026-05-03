import { Module } from '@nestjs/common';
import { HistoryConfigService } from './history-config.service';
import { HistoryConfigController } from './history-config.controller';

@Module({
  controllers: [HistoryConfigController],
  providers: [HistoryConfigService],
})
export class HistoryConfigModule {}
