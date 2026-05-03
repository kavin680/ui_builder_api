import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HistorySchedulerService } from './history-scheduler.service';
import { FreezeSchedulerService } from './freeze-scheduler.service';
import { HistoryWorker, FreezeWorker, HistoryStorageWorker } from './scheduler.worker';
import { VariablesModule } from '../variables/variables.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../common/queue/queue.module';

@Global()
@Module({
    imports: [
        VariablesModule,
        PrismaModule,
        QueueModule,
    ],
    providers: [
        HistorySchedulerService,
        FreezeSchedulerService,
        HistoryWorker,
        FreezeWorker,
        HistoryStorageWorker,
    ],
    exports: [HistorySchedulerService, FreezeSchedulerService],
})
export class SchedulerModule { }
