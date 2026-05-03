import { OnModuleInit, OnApplicationShutdown, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AppCacheService } from '../common/cache/cache.service';
import { withRetry } from '../common/utils/prisma-tx.util';


@Processor('variable-update', { concurrency: 1, lockDuration: 120000 })
export class VariableWorker extends WorkerHost implements OnModuleInit, OnApplicationShutdown {
    private readonly logger = new Logger(VariableWorker.name);
    private updates: { id: string; value: string; type: 'reading' | 'writing' }[] = [];
    private readonly BATCH_SIZE = 50;
    private flushInterval: NodeJS.Timeout;

    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: AppCacheService,
    ) {
        super();
    }

    async onModuleInit() {
        this.flushInterval = setInterval(() => this.flush(), 500);
    }

    async onApplicationShutdown() {
        this.logger.log('VariableWorker: shutting down...');
        clearInterval(this.flushInterval);
        
        // Stop taking new jobs
        if (this.worker) {
            await this.worker.close();
        }

        // Perform final flush
        await this.flush().catch((err) => {
            this.logger.error('Failed to perform final flush in VariableWorker', err);
        });
        
        this.logger.log('VariableWorker: flushed and stopped');
    }

    async process(job: Job): Promise<any> {
        if (job.name === 'batch-update') {
            const { updates } = job.data;
            for (const update of updates) {
                this.updates.push({ id: update.id, value: update.value, type: update.type });
            }
        } else if (job.name === 'update') {
            const { id, value, type } = job.data;
            this.updates.push({ id, value, type });
        }

        if (this.updates.length >= this.BATCH_SIZE) {
            await this.flush();
        }
    }

    private async flush() {
        if (this.updates.length === 0) return;

        const currentUpdates = [...this.updates];
        this.updates = [];

        const startTime = Date.now();
        this.logger.log(`Flushing ${currentUpdates.length} variable updates to DB`);

        const updateMaps = {
            reading: new Map<string, string>(),
            writing: new Map<string, string>(),
        };

        for (const update of currentUpdates) {
            updateMaps[update.type].set(update.id, update.value);
        }

        try {
            // Batch SQL Update for Reading Variables
            if (updateMaps.reading.size > 0) {
                const ids = Array.from(updateMaps.reading.keys());
                const placeholders = ids.map(() => '?').join(', ');
                const caseParts = ids.map(() => 'WHEN id = ? THEN ?').join(' ');
                const params: any[] = [];

                ids.forEach(id => {
                    params.push(BigInt(id), updateMaps.reading.get(id));
                });
                ids.forEach(id => params.push(BigInt(id)));

                const sql = `
                    UPDATE reading_variable 
                    SET value = CASE ${caseParts} END, 
                        updated_at = NOW() 
                    WHERE id IN (${placeholders})
                `;
                this.logger.debug(`Executing Reading SQL: ${sql}`);
                this.logger.debug(`With params: ${JSON.stringify(params, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                await withRetry(() => this.prisma.$executeRawUnsafe(sql, ...params));
            }

            // Batch SQL Update for Writing Variables
            if (updateMaps.writing.size > 0) {
                const ids = Array.from(updateMaps.writing.keys());
                const placeholders = ids.map(() => '?').join(', ');
                const caseParts = ids.map(() => 'WHEN id = ? THEN ?').join(' ');
                const params: any[] = [];

                ids.forEach(id => {
                    params.push(BigInt(id), updateMaps.writing.get(id));
                });
                ids.forEach(id => params.push(BigInt(id)));

                const sql = `
                    UPDATE writing_variable 
                    SET value = CASE ${caseParts} END, 
                        updated_at = NOW() 
                    WHERE id IN (${placeholders})
                `;
                this.logger.debug(`Executing Writing SQL: ${sql}`);
                this.logger.debug(`With params: ${JSON.stringify(params, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                await withRetry(() => this.prisma.$executeRawUnsafe(sql, ...params));
            }

            const duration = Date.now() - startTime;
            this.logger.log(`DB Update completed in ${duration}ms (Reading: ${updateMaps.reading.size}, Writing: ${updateMaps.writing.size})`);
        } catch (error) {
            this.logger.error('Error during batch flush', error);
        }
    }
}
