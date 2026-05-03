import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        ConfigModule,
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: config.get<string>('REDIS_HOST') ?? '127.0.0.1',
                    port: config.get<number>('REDIS_PORT') ?? 6379,
                    maxRetriesPerRequest: null,
                    enableReadyCheck: false,
                },
            }),
        }),
        BullModule.registerQueue(
            { name: 'variable-update' },
            { name: 'alarm-evaluation' },
            { name: 'history-scheduler' },
            { name: 'freeze-scheduler' },
            { name: 'history-storage' },
            { name: 'scheduler' },
        ),
    ],
    exports: [BullModule],
})
export class QueueModule { }
