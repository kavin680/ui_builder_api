import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SYSTEM_EVENTS } from '../common/const/events';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { calculateNextRun, isCurrentlyInWindow } from '../common/utils/time-calculation.util';
import { WritingVariablesService } from '../variables/writing-variables.service';

@Injectable()
export class FreezeSchedulerService {
  private readonly logger = new Logger(FreezeSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly writingVariablesService: WritingVariablesService,
    @InjectQueue('freeze-scheduler') private freezeQueue: Queue,
  ) { }

  async initialize() {
    this.logger.log('[System] Starting freeze scheduler...');
    await this.syncAllFreezeSchedules();
    
    // Step 6: Test BullMQ (Temporary) - Unique ID per run
    const testJobId = `test-heartbeat-${Date.now()}`;
    this.logger.log(`[Diagnostic] Adding heartbeat test job: ${testJobId}`);
    await this.freezeQueue.add('test', {}, { delay: 1000, jobId: testJobId });
  }

  async clearAllJobs() {
    this.logger.warn('[FreezeScheduler] Clearing all freeze jobs.');
    await this.freezeQueue.drain();
    await this.freezeQueue.clean(0, 1000, 'delayed');
  }

  @OnEvent(SYSTEM_EVENTS.RESET)
  async handleSystemReset() {
    this.logger.warn('[FreezeScheduler] System reset received. Purging freeze queue.');
    await this.clearAllJobs();
  }

  // @OnEvent(SYSTEM_EVENTS.RESTORED)
  // async handleSystemRestored() {
  //   this.logger.log('[FreezeScheduler] System restored received. Re-syncing schedules.');
  //   await this.syncAllFreezeSchedules();
  // }

  /**
   * Syncs all active freeze configs to Redis delayed jobs at startup.
   */
  async syncAllFreezeSchedules() {
    const activeMappings = await this.prisma.writingVariableFreezeMap.findMany({
      where: {
        freezeConfig: { isActive: true },
      },
      include: {
        freezeConfig: { include: { timeWindows: true } },
      },
    });

    // Process in chunks of 50 to avoid overloading connection pool while speeding up initialization
    const BATCH_SIZE = 50;
    for (let i = 0; i < activeMappings.length; i += BATCH_SIZE) {
      const batch = activeMappings.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (mapping) => {
          // 1. Check if we should apply freeze value immediately
          await this.checkAndApplyImmediateFreeze(mapping);

          // 2. Schedule future events
          await this.scheduleNextFreezeEvent(mapping);
        })
      );
    }
    this.logger.log(`Synced ${activeMappings.length} freeze mappings to Redis.`);
  }

  /**
   * Checks if current time is within any window and applies start value if so.
   */
  async checkAndApplyImmediateFreeze(mapping: any) {
    if (isCurrentlyInWindow(mapping.freezeConfig.timeWindows)) {
      this.logger.log(`🕒 Current time is INSIDE a window for mapping ${mapping.id}. Applying START value immediately.`);
      
      if (mapping.mboVariableId) {
        await this.writingVariablesService.updateMboVariable({
          id: Number(mapping.mboVariableId),
          value: Number(mapping.valueOnStart),
        });
      } else {
        await this.writingVariablesService.updateWritingVariable({
          id: Number(mapping.writingVariableId),
          value: Number(mapping.valueOnStart),
        });
      }

      // Update DB to reflect we are in the window
      await this.prisma.writingVariableFreezeMap.update({
        where: { id: mapping.id },
        data: { lastStartTriggeredAt: new Date() },
      });
    }
  }

  /**
   * Schedules the next start or end event for a mapping.
  /**
   * Schedules the next start or end event for a mapping.
   */
  async scheduleNextFreezeEvent(mapping: any) {
    const now = new Date();

    // Determine which event comes first: next start or next end
    const nextStart = calculateNextRun(mapping.freezeConfig.timeWindows, 'start');
    const nextEnd = calculateNextRun(mapping.freezeConfig.timeWindows, 'end');

    if (!nextStart || !nextEnd) return;

    // Convert mappingId to number/string to avoid BigInt serialization error in BullMQ
    const mappingId = Number(mapping.id);

    // Schedule Start Event
    const startJobId = `freeze-start-${mappingId}-${nextStart.getTime()}`;
    const startDelay = Math.max(0, nextStart.getTime() - now.getTime());
    
    // Check if job exists before adding
    const startExists = await this.freezeQueue.getJob(startJobId);
    if (!startExists) {
      this.logger.log(`ADDING JOB: ${startJobId} with delay ${startDelay}ms`);
      await this.freezeQueue.add('process-freeze-start', { mappingId }, {
        delay: startDelay,
        jobId: startJobId,
        removeOnComplete: true,
        removeOnFail: true,
      });
    }

    // Schedule End Event
    const endJobId = `freeze-end-${mappingId}-${nextEnd.getTime()}`;
    const endDelay = Math.max(0, nextEnd.getTime() - now.getTime());
    
    const endExists = await this.freezeQueue.getJob(endJobId);
    if (!endExists) {
      this.logger.log(`ADDING JOB: ${endJobId} with delay ${endDelay}ms`);
      await this.freezeQueue.add('process-freeze-end', { mappingId }, {
        delay: endDelay,
        jobId: endJobId,
        removeOnComplete: true,
        removeOnFail: true,
      });
    }
    
    this.logger.debug(`[FreezeScheduler] Next window calculation:
    - NOW: ${now.toISOString()}
    - START: ${nextStart.toISOString()}
    - END: ${nextEnd.toISOString()}`);
  }

  /**
   * Handles a triggered freeze event (START).
   */
  async handleFreezeStart(mappingId: number) {
    try {
      const mapping = await this.prisma.writingVariableFreezeMap.findUnique({
        where: { id: BigInt(mappingId) },
        include: { freezeConfig: { include: { timeWindows: true } } },
      });

      if (!mapping || !mapping.freezeConfig.isActive) return;

      const now = new Date();
      this.logger.log(`🟢 STARTING freeze for mapping ${mappingId} (Type: ${mapping.mboVariableId ? 'MBO' : 'WritingVariable'})`);

      if (mapping.mboVariableId) {
        await this.writingVariablesService.updateMboVariable({
          id: Number(mapping.mboVariableId),
          value: Number(mapping.valueOnStart),
        });
      } else {
        await this.writingVariablesService.updateWritingVariable({
          id: Number(mapping.writingVariableId),
          value: Number(mapping.valueOnStart),
        });
      }

      const nextStart = calculateNextRun(mapping.freezeConfig.timeWindows, 'start');
      await this.prisma.writingVariableFreezeMap.update({
        where: { id: mapping.id },
        data: {
          lastStartTriggeredAt: now,
          nextStartRunAt: nextStart,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to handle freeze start for ${mappingId}`, error);
    } finally {
      // Step 8: Ensure rescheduling always happens
      const mappingToReschedule = await this.prisma.writingVariableFreezeMap.findUnique({
        where: { id: BigInt(mappingId) },
        include: { freezeConfig: { include: { timeWindows: true } } },
      });
      if (mappingToReschedule && mappingToReschedule.freezeConfig.isActive) {
        await this.scheduleNextFreezeEvent(mappingToReschedule);
      }
    }
  }

  /**
   * Handles a triggered freeze event (END).
   */
  async handleFreezeEnd(mappingId: number) {
    try {
      const mapping = await this.prisma.writingVariableFreezeMap.findUnique({
        where: { id: BigInt(mappingId) },
        include: { freezeConfig: { include: { timeWindows: true } } },
      });

      if (!mapping || !mapping.freezeConfig.isActive) return;

      const now = new Date();
      this.logger.log(`🔴 ENDING freeze for mapping ${mappingId} (Type: ${mapping.mboVariableId ? 'MBO' : 'WritingVariable'})`);

      if (mapping.mboVariableId) {
        await this.writingVariablesService.updateMboVariable({
          id: Number(mapping.mboVariableId),
          value: Number(mapping.valueOnEnd),
        });
      } else {
        await this.writingVariablesService.updateWritingVariable({
          id: Number(mapping.writingVariableId),
          value: Number(mapping.valueOnEnd),
        });
      }

      const nextEnd = calculateNextRun(mapping.freezeConfig.timeWindows, 'end');
      await this.prisma.writingVariableFreezeMap.update({
        where: { id: mapping.id },
        data: {
          lastEndTriggeredAt: now,
          nextEndRunAt: nextEnd,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to handle freeze end for ${mappingId}`, error);
    } finally {
      // Step 8: Ensure rescheduling always happens
      const mappingToReschedule = await this.prisma.writingVariableFreezeMap.findUnique({
        where: { id: BigInt(mappingId) },
        include: { freezeConfig: { include: { timeWindows: true } } },
      });
      if (mappingToReschedule && mappingToReschedule.freezeConfig.isActive) {
        await this.scheduleNextFreezeEvent(mappingToReschedule);
      }
    }
  }

  /**
   * Syncs a specific mapping to Redis.
   */
  async syncMapping(id: number) {
    try {
      const mapping = await this.prisma.writingVariableFreezeMap.findUnique({
        where: { id },
        include: {
          freezeConfig: { include: { timeWindows: true } },
        },
      });

      if (!mapping || !mapping.freezeConfig.isActive) {
        await this.unsyncMapping(id);
        return;
      }

      await this.checkAndApplyImmediateFreeze(mapping);
      await this.scheduleNextFreezeEvent(mapping);

      this.logger.log(`Synced freeze mapping ${id} to Redis.`);
    } catch (error) {
      this.logger.error(`Failed to sync freeze mapping ${id}`, error);
    }
  }

  /**
   * Removes all scheduled jobs for a mapping.
   */
  async unsyncMapping(id: number) {
    // Step 4: Correct job removal using startsWith partial matching
    const jobs = await this.freezeQueue.getJobs(['delayed', 'waiting']);
    for (const job of jobs) {
      if (job.id && (job.id.startsWith(`freeze-start-${id}`) || job.id.startsWith(`freeze-end-${id}`))) {
        await job.remove();
        this.logger.log(`Removed orphaned job: ${job.id}`);
      }
    }
    this.logger.log(`Unsynced all jobs for freeze mapping ${id}.`);
  }
}
