import { Injectable, Logger } from '@nestjs/common';
import { DataSourceService } from '../data-source/data-source.service';
import { HistorySchedulerService } from '../scheduler/history-scheduler.service';
import { FreezeSchedulerService } from '../scheduler/freeze-scheduler.service';
import { ReadingVariablesService } from '../variables/reading-variables.service';
import { AlarmConfigService } from '../alarm-config/alarm-config.service';

@Injectable()
export class SystemInitializerService {
  private readonly logger = new Logger(SystemInitializerService.name);

  constructor(
    private readonly variableService: ReadingVariablesService,
    private readonly dataSourceService: DataSourceService,
    private readonly historyScheduler: HistorySchedulerService,
    private readonly freezeScheduler: FreezeSchedulerService,
    private readonly alarmConfigService: AlarmConfigService,
  ) {}

  /**
   * Orchestrates the complete system initialization sequence.
   * Safe to call on app startup or after a system restore.
   */
  async initializeSystem() {
    this.logger.log('🚀 [System] Initializing backend orchestrator...');

    try {
      // Step 1: Clear previous runtime state (Safety first)
      this.logger.log('🧹 [System] Clearing previous runtime state...');
      await this.variableService.clearCache();
      this.dataSourceService.disconnectAll();
      await this.historyScheduler.clearAllJobs();
      await this.freezeScheduler.clearAllJobs();

      // Step 2: Rebuild Variable Cache
      this.logger.log('📦 [System] Rebuilding variable cache...');
      await this.variableService.rebuildCache();

      // Step 3: Initialize Data Sources (MQTT)
      this.logger.log('🔌 [System] Connecting data sources...');
      await this.dataSourceService.initialize();

      // Step 4: Initialize Schedulers
      // BullMQ WorkerHost.onApplicationBootstrap() fires before this point,
      // so workers are already consuming from Redis by the time jobs are added.
      this.logger.log('⏰ [System] Starting schedulers...');
      await this.historyScheduler.initialize();
      await this.freezeScheduler.initialize();

      // Step 5: Warm up Alarm Cache
      // This runs LAST so it never blocks workers or schedulers from starting.
      this.logger.log('🔔 [System] Warming up alarm cache...');
      await this.alarmConfigService.initialize();

      this.logger.log('✅ [System] Initialization complete. All services are operational.');
    } catch (error) {
      this.logger.error(`❌ [System] Critical failure during initialization: ${error.message}`, error.stack);
      // We don't throw here to avoid crashing the whole app, but the error is logged.
    }
  }
}
