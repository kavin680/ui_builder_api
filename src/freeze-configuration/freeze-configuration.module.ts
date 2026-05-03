import { Module, forwardRef } from '@nestjs/common';
import { FreezeConfigurationService } from './freeze-configuration.service';
import { FreezeConfigurationController } from './freeze-configuration.controller';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [forwardRef(() => SchedulerModule)],
  controllers: [FreezeConfigurationController],
  providers: [FreezeConfigurationService],
  exports: [FreezeConfigurationService],
})
export class FreezeConfigurationModule { }
