import { OnModuleInit, OnApplicationShutdown, Logger, Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { HistorySchedulerService } from './history-scheduler.service';
import { FreezeSchedulerService } from './freeze-scheduler.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Processor('history-scheduler', { concurrency: 1, lockDuration: 120000 })
export class HistoryWorker extends WorkerHost implements OnApplicationShutdown {
    constructor(private readonly historyService: HistorySchedulerService) {
        super();
    }

    async onApplicationShutdown() {
        if (this.worker) {
            await this.worker.close();
        }
    }

    async process(job: Job): Promise<any> {
        if (job.name === 'history-batch-sync') {
            await this.historyService.processDueVariables();
        } else if (job.name === 'process-variable-history') {
            await this.historyService.handleVariableJob(job.data.variableId);
        }
    }
}

@Injectable()
@Processor('freeze-scheduler', { concurrency: 2 })
export class FreezeWorker extends WorkerHost implements OnApplicationShutdown {
    private readonly logger = new Logger(FreezeWorker.name);
    constructor(private readonly freezeService: FreezeSchedulerService) {
        super();
        console.log('❄️ FreezeWorker Instantiated');
    }

    async onApplicationShutdown() {
        if (this.worker) {
            await this.worker.close();
        }
    }

    async process(job: Job): Promise<any> {
        this.logger.log(`JOB RECEIVED: ${job.name} ${job.id}`);

        if (job.name === 'process-freeze-start') {
            await this.freezeService.handleFreezeStart(job.data.mappingId);
        } else if (job.name === 'process-freeze-end') {
            await this.freezeService.handleFreezeEnd(job.data.mappingId);
        } else if (job.name === 'test') {
            this.logger.log('✅ TEST WORKED');
        }
    }
}

@Processor('history-storage', { concurrency: 10, lockDuration: 120000 })
export class HistoryStorageWorker extends WorkerHost implements OnModuleInit, OnApplicationShutdown {
    private readonly logger = new Logger(HistoryStorageWorker.name);
    // private historyBatch: Prisma.ReadingVariableHistoryCreateManyInput[] = [];
    private historyBatch: Prisma.ReadingVariableHistoryCreateManyInput[] = [];
    private utilityBatch: Prisma.ReadingVariableUtilityHistoryCreateManyInput[] = [];
    private readonly BATCH_SIZE = 500;
    private flushingHistory = false;
    private flushingUtility = false;
    private flushInterval: NodeJS.Timeout;

    constructor(private readonly prisma: PrismaService) {
        super();
    }

    async onModuleInit() {
        // MICRO-BATCHING STRATEGY:
        // Instead of hitting the DB for every single telemetry point, we accumulate
        // records in memory and flush them every 6 seconds (or when the batch is full).
        // This dramatically reduces IOPS and allows the system to handle thousands 
        // of variables per second with minimal CPU usage.
        this.flushInterval = setInterval(async () => {
            await this.flushHistory();
            await this.flushUtility();
        }, 6000);
    }

    async onApplicationShutdown() {
        this.logger.log('HistoryStorageWorker: shutting down...');
        clearInterval(this.flushInterval);

        // Stop taking new jobs
        if (this.worker) {
            await this.worker.close();
        }

        // Perform final flush
        await this.flushHistory().catch(err =>
            this.logger.error('Failed to flush history on shutdown', err)
        );

        await this.flushUtility().catch(err =>
            this.logger.error('Failed to flush utility on shutdown', err)
        );

        this.logger.log('HistoryStorageWorker: stopped');
    }

    async process(job: Job): Promise<any> {
        if (job.name === 'store-history') {
            const { readingVariableId, value, recordedAt, historyType } = job.data;

            if (historyType === 'UTILITY') {
                this.utilityBatch.push({
                    readingVariableId: BigInt(readingVariableId),
                    value: String(value),
                    recordedAt: new Date(recordedAt),
                });
            } else {
                this.historyBatch.push({
                    readingVariableId: BigInt(readingVariableId),
                    value: String(value),
                    recordedAt: new Date(recordedAt),
                });
            }

            if (this.historyBatch.length >= this.BATCH_SIZE) {
                await this.waitForHistoryFlush();
                await this.flushHistory();
            }

            if (this.utilityBatch.length >= this.BATCH_SIZE) {
                await this.waitForUtilityFlush();
                await this.flushUtility();
            }
        }
        // Note: The BullMQ job completes as soon as it's added to the memory batch.
        // This favors extreme throughput over "strict" at-least-once delivery, 
        // which is the standard trade-off for high-frequency time-series data.
    }

    private async flushHistory() {
        if (this.flushingHistory || this.historyBatch.length === 0) return;

        this.flushingHistory = true;

        try {
            const batch = [...this.historyBatch];
            this.historyBatch = [];

            this.logger.log(`Flushing ${batch.length} HISTORY entries`);

            await this.prisma.readingVariableHistory.createMany({
                data: batch,
            });

        } catch (error) {
            this.logger.error('Failed to flush history batch', error);
        } finally {
            this.flushingHistory = false;
        }
    }

    private async flushUtility() {
        if (this.flushingUtility || this.utilityBatch.length === 0) return;

        this.flushingUtility = true;

        try {
            const batch = [...this.utilityBatch];
            this.utilityBatch = [];

            this.logger.log(`Flushing ${batch.length} UTILITY entries`);

            await this.prisma.readingVariableUtilityHistory.createMany({
                data: batch,
            });

        } catch (error) {
            this.logger.error('Failed to flush utility batch', error);
        } finally {
            this.flushingUtility = false;
        }
    }

    private async waitForHistoryFlush() {
        if (!this.flushingHistory) return;
        await new Promise(resolve => {
            const check = setInterval(() => {
                if (!this.flushingHistory) {
                    clearInterval(check);
                    resolve(true);
                }
            }, 50);
        });
    }

    private async waitForUtilityFlush() {
        if (!this.flushingUtility) return;
        await new Promise(resolve => {
            const check = setInterval(() => {
                if (!this.flushingUtility) {
                    clearInterval(check);
                    resolve(true);
                }
            }, 50);
        });
    }
}
