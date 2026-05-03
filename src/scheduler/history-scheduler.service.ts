import { PrismaService } from '../prisma/prisma.service';
import { HistoryType } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SYSTEM_EVENTS } from '../common/const/events';
import { AppCacheService } from '../common/cache/cache.service';

@Injectable()
export class HistorySchedulerService {
  private readonly logger = new Logger(HistorySchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('history-scheduler') private schedulerQueue: Queue,
    @InjectQueue('history-storage') private historyStorageQueue: Queue,
    private readonly cache: AppCacheService,
  ) { }

  // async onModuleInit() {
  //   this.logger.log('Initializing Batch History Scheduler... Waiting for Redis');
  //   while (true) {
  //     try {
  //       await this.setupHistorySync();
  //       break;
  //     } catch (err) {
  //       await new Promise((resolve) => setTimeout(resolve, 5000));
  //     }
  //   }
  // }

  async initialize() {
    this.logger.log('[System] Starting history scheduler...');
    await this.setupHistorySync();
  }

  @OnEvent(SYSTEM_EVENTS.RESET)
  async handleSystemReset() {
    this.logger.warn('[HistoryScheduler] System reset received. Clearing variables cache and jobs.');
    await this.cache.del('variables:values:reading');
    await this.clearAllJobs();
  }

  async clearAllJobs() {
    this.logger.warn('[HistoryScheduler] Clearing all history jobs.');
    const jobs = await this.schedulerQueue.getRepeatableJobs();
    for (const job of jobs) {
      await this.schedulerQueue.removeRepeatableByKey(job.key);
    }
    // Also clean any waiting/active jobs
    await this.schedulerQueue.drain();
    await this.schedulerQueue.clean(0, 1000, 'delayed');
  }

  /**
   * Sets up a single repeatable job to process all due variables in batches.
   */
  async setupHistorySync() {
    // 1. Remove any old repeatable jobs to avoid duplicates
    const jobs = await this.schedulerQueue.getRepeatableJobs();
    for (const job of jobs) {
      if (job.name === 'history-batch-sync' || job.name.includes('history-')) {
        await this.schedulerQueue.removeRepeatableByKey(job.key);
      }
    }

    // 2. Schedule the single heartbeat job (every 1 second)
    await this.schedulerQueue.add('history-batch-sync', {}, {
      repeat: { every: 1000 },
      removeOnComplete: true,
      removeOnFail: true,
    });

    this.logger.log('Batch History Scheduler heartbeat started (every 1s).');
  }
  /**
   * Core logic: Fetches due variables, updates next_run_at using fast batch updates,
   * then queues history storage jobs.
   */
  async processDueVariables() {
    const rawNow = Date.now();
    // High-precision second-aligned baseline recommended by user
    const nowMs = Math.floor(rawNow / 1000) * 1000;
    const now = new Date(nowMs);
    const batchSize = 500;

    try {
      // 1. Find variables that are due for logging (outside transaction to keep TX short)
      const dueVars = await this.prisma.readingVariable.findMany({
        where: {
          isActive: true,
          historyType: { in: [HistoryType.SCHEDULED, HistoryType.UTILITY] },
          loggingTime: { not: null, gt: 0 },
          OR: [
            { next_run_at: { lte: now } },
            { next_run_at: null }
          ]
        },
        take: batchSize,
      });

      if (dueVars.length === 0) return;

      const dueIds = dueVars.map(v => v.id);

      // 2. Efficiency Fix: Update lastRunAt in a single bulk update
      // This is 100x faster than individual row updates.
      await this.prisma.readingVariable.updateMany({
        where: { id: { in: dueIds } },
        data: { lastRunAt: now }
      });

      // 3. Group variables by their interval (loggingTime) to batch next_run_at updates
      const intervalGroups = new Map<number, bigint[]>();
      dueVars.forEach(v => {
        const interval = v.loggingTime || 60;
        let group = intervalGroups.get(interval);
        if (!group) {
          group = [];
          intervalGroups.set(interval, group);
        }
        group.push(v.id);
      });

      // 4. Clock Boundary Alignment: 
      // We don't just log "whenever". We align every logging event to strict 
      // clock ticks (e.g., exactly at 10:05:00, 10:10:00). 
      // This is vital for industrial reports where data from different sensors 
      // must align perfectly on a timeline for comparison.
      const nextRunPromises = Array.from(intervalGroups.entries()).map(([interval, ids]) => {
        const intervalMs = interval * 1000;
        const nextTime = Math.floor(nowMs / intervalMs) * intervalMs + intervalMs;
        return this.prisma.readingVariable.updateMany({
          where: { id: { in: ids } },
          data: { next_run_at: new Date(nextTime) }
        });
      });
      await Promise.all(nextRunPromises);

      // 5. Fetch current values from Redis (Primary Source of Truth for live values)
      const hashKey = `variables:values:reading`;
      const currentValues = await this.cache.hmget(hashKey, dueIds.map(id => id.toString()));

      // 6. Trigger history storage jobs with ultra-clean, grid-aligned timestamps
      const historyJobs = dueVars.map((v, index) => {
        const intervalMs = (v.loggingTime || 60) * 1000;
        const triggerTime = new Date(Math.floor(nowMs / intervalMs) * intervalMs);
        const liveValue = currentValues[index] ?? v.value ?? '';

        return {
          name: 'store-history',
          data: {
            readingVariableId: v.id.toString(),
            value: liveValue,
            recordedAt: triggerTime.toISOString(),
            historyType: v.historyType,
          },
          opts: {
            jobId: `history-${v.id}-${triggerTime.getTime()}`, // 👈 KEY FIX
            removeOnComplete: true,
            removeOnFail: true,
          }
        };
      });

      await this.historyStorageQueue.addBulk(historyJobs);
      this.logger.debug(`Processed ${dueVars.length} variables. Aligned tick: ${now.toISOString()}`);

    } catch (error) {
      this.logger.error(`Error processing due variables: ${error.message}`, error.stack);
    }
  }

  // Legacy method for compatibility if needed, though now handled by processDueVariables
  async handleVariableJob(variableId: string) {
    this.logger.warn(`Legacy handleVariableJob called for ${variableId}. Use processDueVariables instead.`);
  }

  async scheduleDelayedJob(variableId: string, delayMs: number) {
    this.logger.warn(`Legacy scheduleDelayedJob called for ${variableId}. Individual jobs are deprecated.`);
  }
}
