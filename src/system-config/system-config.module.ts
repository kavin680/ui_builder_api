import { Module } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController } from './system-config.controller';
import { PrismaModule } from '../prisma/prisma.module';

import { GlobalConfigurationsModule } from '../global-configurations/global-configurations.module';
import { VariablesModule } from '../variables/variables.module';
import { AlarmConfigModule } from '../alarm-config/alarm-config.module';
import { FreezeConfigurationModule } from '../freeze-configuration/freeze-configuration.module';

import { DataSourceModule } from '../data-source/data-source.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { SystemInitializerService } from './system-initializer.service';

@Module({
  imports: [
    PrismaModule,
    GlobalConfigurationsModule,
    VariablesModule,
    AlarmConfigModule,
    FreezeConfigurationModule,
    DataSourceModule,
    SchedulerModule,
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigService, SystemInitializerService],
  exports: [SystemInitializerService],
})
export class SystemConfigModule {}
