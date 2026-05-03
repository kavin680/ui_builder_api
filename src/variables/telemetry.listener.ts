import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEvent } from '../common/events/domain-events';
import type { TelemetryUpdatedPayload } from '../common/events/domain-events';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VariablesGateway } from './variables.gateway';
import { AppCacheService } from '../common/cache/cache.service';
import { SocketTelemetryUpdateDto } from '../common/dto/websocket/telemetry-update.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class TelemetryListener implements OnModuleDestroy {
  private readonly logger = new Logger(TelemetryListener.name);
  private isShuttingDown = false;

  onModuleDestroy() {
    this.isShuttingDown = true;
    this.logger.log('TelemetryListener: shutdown — no longer accepting telemetry events');
  }


  constructor(
    @InjectQueue('variable-update') private variableUpdateQueue: Queue,
    @InjectQueue('alarm-evaluation') private alarmEvaluationQueue: Queue,
    @InjectQueue('history-storage') private historyQueue: Queue,
    private readonly variablesGateway: VariablesGateway,
    private readonly cacheService: AppCacheService,
  ) { }

  @OnEvent(DomainEvent.TELEMETRY_UPDATED)
  async handleTelemetryUpdated(payload: TelemetryUpdatedPayload) {
    // Drop events during shutdown — BullMQ connection is already being torn down
    if (this.isShuttingDown) return;

    const { globalConfigId, updates } = payload;

    try {
      // BACKPRESSURE: Check queue health
      const [varCount, alarmCount] = await Promise.all([
        this.variableUpdateQueue.getJobCounts(),
        this.alarmEvaluationQueue.getJobCounts()
      ]);

      if (varCount.waiting + varCount.active > 10000) {
        this.logger.warn(
          {
            waitingJobs: varCount.waiting,
            activeJobs: varCount.active,
            configId: globalConfigId,
            action: 'backpressure_drop'
          },
          'BACKPRESSURE: Dropping telemetry batch due to queue congestion'
        );
        return;
      }

      // 1. Update Redis Cache
      const redisMap: Record<string, string> = {};
      updates.forEach(u => redisMap[u.variableId] = u.value);

      const hashKey = `variables:values:reading`;
      await this.cacheService.hmset(hashKey, redisMap);
      await this.cacheService.expire(hashKey, 300);

      try {
        // 2. Queue for DB update
        await this.variableUpdateQueue.add('batch-update', {
          updates: updates.map(u => ({
            id: u.variableId,
            value: u.value,
            type: 'reading',
          })),
        });

        // 3. Queue for Alarm Evaluation
        await this.alarmEvaluationQueue.add('evaluate-batch', {
          updates: updates.map(u => ({
            variableId: u.variableId,
            value: u.value,
          })),
        }, {
          removeOnComplete: true,
          jobId: `alarm-batch-${globalConfigId}-${Date.now()}`,
        });

      } catch (queueErr) {
        this.logger.error(`[QUEUE BYPASS] Redis BullMQ connection failed. Using DLQ fallback for persistence.`, queueErr);
        const fs = require('fs');
        fs.appendFileSync('telemetry-dlq.ndjson', JSON.stringify({
          timestamp: new Date().toISOString(),
          error: "BullMQ queue submission failed. Payload deferred.",
          payload: updates
        }) + '\n');
      }

      // 5. Emit via WebSocket (Single source of truth)
      const socketUpdates = updates.map(u => plainToInstance(SocketTelemetryUpdateDto, {
        variableId: u.variableId,
        variableName: u.variableName,
        value: u.value,
        isCalculated: u.isCalculated,
      }, { excludeExtraneousValues: true }));

      this.variablesGateway.emitBulk(socketUpdates);

      this.logger.debug(
        {
          configId: globalConfigId,
          variableCount: updates.length,
          action: 'telemetry_processed'
        },
        'Processed telemetry event'
      );
    } catch (error) {
      this.logger.error(
        {
          err: error,
          configId: globalConfigId,
          action: 'telemetry_error'
        },
        'Error processing telemetry updated event'
      );
    }
  }
}
