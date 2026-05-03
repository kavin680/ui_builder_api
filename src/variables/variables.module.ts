import { Module, Global } from '@nestjs/common';
import { ReadingVariablesService } from './reading-variables.service';
import { WritingVariablesService } from './writing-variables.service';
import { VariablesController } from './variables.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { VariablesGateway } from './variables.gateway';
import { HistoryConfigModule } from '../history-config/history-config.module';
import { AlarmConfigModule } from '../alarm-config/alarm-config.module';
import { BullModule } from '@nestjs/bullmq';

import { GlobalConfigurationsModule } from '../global-configurations/global-configurations.module';
import { AppCacheModule } from '../common/cache/cache.module';
import { VariableWorker } from './variable.worker';

import { TelemetryListener } from './telemetry.listener';
import { QueueModule } from '../common/queue/queue.module';
import { ReadingVariablesConsumptionService } from './reading-variables-consumption.service';

@Global()
@Module({
  controllers: [VariablesController],
  providers: [
    ReadingVariablesService,
    ReadingVariablesConsumptionService,
    WritingVariablesService,
    VariablesGateway,
    VariableWorker,
    TelemetryListener,
  ],
  imports: [
    HistoryConfigModule,
    AlarmConfigModule,
    GlobalConfigurationsModule,
    AppCacheModule,
    QueueModule,
  ],
  exports: [ReadingVariablesService, WritingVariablesService, VariablesGateway, ReadingVariablesConsumptionService],
})
export class VariablesModule { }
