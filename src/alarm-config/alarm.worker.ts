import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AlarmEvaluationService } from './alarm-evaluation.service';
import { Logger } from '@nestjs/common';

@Processor('alarm-evaluation', { concurrency: 2 })
export class AlarmWorker extends WorkerHost {
    private readonly logger = new Logger(AlarmWorker.name);

    constructor(private readonly alarmEvaluationService: AlarmEvaluationService) {
        super();
    }

    async process(job: Job<any>): Promise<any> {
        if (job.name === 'evaluate-batch') {
            const { updates } = job.data;
            if (!updates || !Array.isArray(updates)) return;

            this.logger.log(`[DEBUG] Worker received updates: ${JSON.stringify(updates)}`);

            // Convert string IDs back to bigint for the service
            const mappedUpdates: { variableId: bigint; value: string }[] = updates
                .map((u: any) => ({
                    variableId: u.variableId ? BigInt(u.variableId) : null,
                    value: String(u.value),
                }))
                .filter((u: any): u is { variableId: bigint; value: string } => u.variableId !== null);

            this.logger.log(`[DEBUG] Mapped updates count: ${mappedUpdates.length}`);
            await this.alarmEvaluationService.handleBatchUpdated(mappedUpdates);
        }
    }
}
