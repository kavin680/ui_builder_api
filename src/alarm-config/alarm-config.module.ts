import { Module } from '@nestjs/common';
import { AlarmConfigService } from './alarm-config.service';
import { AlarmConfigController } from './alarm-config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AlarmsGateway } from './alarms.gateway';
import { AlarmEvaluationService } from './alarm-evaluation.service';
import { AppCacheModule } from '../common/cache/cache.module';

import { BullModule } from '@nestjs/bullmq';
import { AlarmWorker } from './alarm.worker';
import { AlarmListener } from './alarm.listener';

@Module({
  imports: [
    PrismaModule,
    AppCacheModule,
    BullModule.registerQueue({
      name: 'alarm-evaluation',
    }),
  ],
  controllers: [AlarmConfigController],
  providers: [
    AlarmConfigService,
    AlarmsGateway,
    AlarmEvaluationService,
    AlarmWorker,
    AlarmListener,
  ],
  exports: [
    AlarmConfigService,
    AlarmsGateway,
    AlarmEvaluationService,
    BullModule,
  ],
})
export class AlarmConfigModule { }
