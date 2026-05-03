import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSystemConfigDto } from './dto/create-system-config.dto';
import { GlobalConfigurationsService } from '../global-configurations/global-configurations.service';
import { ReadingVariablesService } from '../variables/reading-variables.service';
import { WritingVariablesService } from '../variables/writing-variables.service';
import { AlarmConfigService } from '../alarm-config/alarm-config.service';
import { FreezeConfigurationService } from '../freeze-configuration/freeze-configuration.service';
import { withRetry, withTxMonitor } from '../common/utils/prisma-tx.util';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SYSTEM_EVENTS } from '../common/const/events';
import { SystemInitializerService } from './system-initializer.service';
import { plainToInstance } from 'class-transformer';
import { RestoreResponseDto } from './dto/response/restore-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly globalConfigService: GlobalConfigurationsService,
    private readonly readingVariablesService: ReadingVariablesService,
    private readonly writingVariablesService: WritingVariablesService,
    private readonly alarmConfigService: AlarmConfigService,
    private readonly freezeConfigService: FreezeConfigurationService,
    private readonly eventEmitter: EventEmitter2,
    private readonly systemInitializer: SystemInitializerService,
  ) { }

  async restoreSystemConfig(dto: CreateSystemConfigDto, dryRun = false): Promise<RestoreResponseDto> {
    // Note: DTO validation ensures configs is present and not empty
    const configs = dto.data.configs;

    this.logger.log(`[Restore] Starting system data restoration (Version: ${dto.version}, DryRun: ${dryRun})`);

    try {
      const restoreResult = await withRetry(() =>
        withTxMonitor(
          `system-restore:${configs.length}-configs`,
          () =>
            this.prisma.$transaction(
              async (tx) => {
                // We wipe the DB rows FIRST within the transaction. 
                // If anything fails during the restore, the transaction rolls back 
                // and the old configuration is preserved. No half-finished states!
                this.logger.debug(`[Restore] Wiping existing DB configurations...`);
                await tx.globalConfiguration.deleteMany({});
                await this.globalConfigService.clearCache();

                const results: { id: string; name: string }[] = [];

                for (const config of configs) {
                  this.logger.debug(`[Restore] Syncing configuration: ${config.name}`);

                  // Support explicit ID preservation for Global Config
                  const { readingVariables, writingVariables, freezeConfigs, ...globalData } = config;
                  const globalDto = {
                    ...globalData,
                    id: config.id ? config.id.toString() : undefined,
                  };
                  const createdGlobal = await this.globalConfigService.create(globalDto as any, tx);
                  const globalId = Number(createdGlobal.id);

                  for (const rv of config.readingVariables) {
                    const rvDto = {
                      ...rv,
                      id: rv.id ? rv.id.toString() : undefined,
                      globalConfigId: globalId,
                      functionName: rv.functionName as any,
                    };
                    const createdRv = await this.readingVariablesService.createReadingVariable(rvDto, tx);
                    const rvId = Number(createdRv.id);

                    if (rv.alarms && rv.alarms.length > 0) {
                      for (const alarm of rv.alarms) {
                        await this.alarmConfigService.create({
                          ...alarm,
                          id: alarm.id ? alarm.id.toString() : undefined,
                          conditionType: alarm.conditionType as any,
                          priority: alarm.priority as any,
                          readingVariableId: rvId,
                        }, tx);
                      }
                    }
                  }

                  const writingVariableIdMap = new Map<string, string>();
                  const mboVariableIdMap = new Map<string, string>();

                  for (const wv of config.writingVariables) {
                    const wvDto = {
                      ...wv,
                      id: wv.id ? wv.id.toString() : undefined,
                      globalConfigId: globalId,
                      value: wv.value !== undefined ? Number(wv.value) : undefined,
                      functionName: wv.functionName as any,
                      rawValue: wv.rawValue as any,
                      mboVariables: wv.mboVariables,
                    };
                    const createdWv = (await this.writingVariablesService.createWritingVariable(wvDto, tx)) as any;
                    
                    if (createdWv && createdWv.id && wv.id) {
                      const newWvId = createdWv.id;
                      writingVariableIdMap.set(wv.id.toString(), newWvId);
                      
                      // Re-fetch or rely on service to have created MBOs with IDs we can map
                      // Since WritingVariablesService.createWritingVariable preserves MBO IDs if provided,
                      // and we are passing wv.mboVariables which contains IDs, they should be stable.
                      // However, to be safe, we map them if they are in the DTO.
                      if (wv.mboVariables) {
                        wv.mboVariables.forEach((mbo: any) => {
                          if (mbo.id) {
                            mboVariableIdMap.set(mbo.id.toString(), mbo.id.toString());
                          }
                        });
                      }
                    }
                  }

                  for (const fc of config.freezeConfigs) {
                    const mappedVariables = fc.variables.map((v: any) => {
                      const mv: any = {
                        ...v,
                        id: v.id ? v.id.toString() : undefined,
                        writingVariableId: Number(writingVariableIdMap.get(v.writingVariableId.toString()) || v.writingVariableId),
                        valueOnStart: v.valueOnStart !== undefined ? Number(v.valueOnStart) : undefined,
                        valueOnEnd: v.valueOnEnd !== undefined ? Number(v.valueOnEnd) : undefined,
                      };
                      if (v.mboVariableId) {
                        mv.mboVariableId = Number(mboVariableIdMap.get(v.mboVariableId.toString()) || v.mboVariableId);
                      }
                      return mv;
                    });

                    await this.freezeConfigService.create({
                      ...fc,
                      id: fc.id ? fc.id.toString() : undefined,
                      globalConfigId: globalId,
                      variables: mappedVariables as any,
                    }, tx);
                  }

                  results.push({ id: globalId.toString(), name: createdGlobal.name });
                }

                if (dryRun) {
                  this.logger.warn(`[Restore] DryRun is TRUE. Rolling back all changes as requested.`);
                  throw new Error('DRY_RUN_COMPLETED');
                }

                this.logger.log(`[Restore] Successfully restored ${results.length} configurations.`);
                return {
                  success: true,
                  message: 'System configuration restored successfully',
                  processedConfigs: results,
                };
              },
              { timeout: 60000 },
            ),
          60000, // warn if entire restore takes > 60s
        ),
      );

      // 2. Only AFTER the transaction commits: wipe old cert files and emit RESET.
      // We do this outside the transaction because we can't "rollback" a file deletion.
      // If we reach this point, the DB is already safely updated.
      this.logger.log('[Restore] DB transaction committed. Cleaning up old certificates...');
      const certsDir = path.join(process.cwd(), 'shared', 'certs');
      if (fs.existsSync(certsDir)) {
        try {
          fs.rmSync(certsDir, { recursive: true, force: true });
          this.logger.log('[Restore] Removed old shared/certs directory.');
        } catch (err) {
          this.logger.warn(`[Restore] Failed to remove old certs dir: ${err.message}`);
        }
      }
      // Notify the rest of the system (MQTT clients, schedulers) to drop everything
      // before we start the re-initialization.
      this.eventEmitter.emit(SYSTEM_EVENTS.RESET);

      // 3. Trigger full system re-initialization (writes new cert files, reconnects MQTT)
      this.logger.log('[Restore] Triggering system-wide re-initialization...');
      await this.systemInitializer.initializeSystem();

      return plainToInstance(RestoreResponseDto, restoreResult);
    } catch (error) {
      if (error.message === 'DRY_RUN_COMPLETED') {
        return plainToInstance(RestoreResponseDto, {
          success: true,
          message: 'Dry run completed successfully. Verification passed.',
          data: { simulatedConfigs: configs.length },
        });
      }
      this.logger.error(`[Restore] Critical failure during restoration:`, error.stack);
      throw error;
    }
  }

  async resetSystemConfig(txClient?: any) {
    if (!txClient) {
      this.eventEmitter.emit(SYSTEM_EVENTS.RESET);
    }
    const prisma = txClient || this.prisma;
    await prisma.globalConfiguration.deleteMany({});

    // Clean up all certificates on full reset
    const certsDir = path.join(process.cwd(), 'shared', 'certs');
    if (fs.existsSync(certsDir)) {
      try {
        fs.rmSync(certsDir, { recursive: true, force: true });
        this.logger.log('[Reset] Deleted all certificate files');
      } catch (err) {
        this.logger.warn(`[Reset] Failed to clean certs directory: ${err.message}`);
      }
    }
    
    // Crucial: Clear global cache to prevent stale data from appearing after reset
    await this.globalConfigService.clearCache();
    
    return new ActionResponseDto({
      success: true,
      message: 'All system configurations cleared',
    });
  }

  async backupSystemConfig() {
    const configs = (await this.prisma.globalConfiguration.findMany({
      include: {
        dataSourceConfig: {
          include: {
            topics: true,
          },
        },
        readingVariables: {
          include: {
            alarms: true,
          },
        },
        writingVariables: {
          include: {
            mboVariables: true,
          },
        },
        freezeConfigs: {
          include: {
            timeWindows: true,
            variables: true,
          },
        },
      } as any,
      orderBy: { id: 'asc' },
    })) as any[];

    const results: any[] = [];
    for (const config of configs) {
      const backupConfig = {
        ...config,
        id: config.id.toString(),
        dataSourceConfig: config.dataSourceConfig ? {
          ...config.dataSourceConfig,
          id: config.dataSourceConfig.id.toString(),
          caContent: this.readFileSafe(config.dataSourceConfig.caPath),
          certContent: this.readFileSafe(config.dataSourceConfig.certPath),
          keyContent: this.readFileSafe(config.dataSourceConfig.keyPath),
          topics: config.dataSourceConfig.topics.map((t) => ({
            id: t.id.toString(),
            topic: t.topic,
            type: t.type,
          })),
        } : undefined,
        readingVariables: config.readingVariables.map((rv) => ({
          ...rv,
          id: rv.id.toString(),
          globalConfigId: rv.globalConfigId.toString(),
          alarms: rv.alarms.map((a) => ({
            ...a,
            id: a.id.toString(),
            readingVariableId: a.readingVariableId.toString(),
          })),
        })),
        writingVariables: config.writingVariables.map((wv) => ({
          ...wv,
          id: wv.id.toString(),
          globalConfigId: wv.globalConfigId.toString(),
          mboVariables: wv.mboVariables.map((mbo) => ({
            ...mbo,
            id: mbo.id.toString(),
            writingVariableId: mbo.writingVariableId.toString(),
          })),
        })),
        freezeConfigs: config.freezeConfigs.map((fc) => ({
          ...fc,
          id: fc.id.toString(),
          globalConfigId: fc.globalConfigId.toString(),
          timeWindows: fc.timeWindows.map((tw) => ({
            ...tw,
            id: tw.id.toString(),
            freezeConfigId: tw.freezeConfigId.toString(),
            startTime: tw.startTime.getUTCHours().toString().padStart(2, '0') + ':' +
              tw.startTime.getUTCMinutes().toString().padStart(2, '0') + ':' +
              tw.startTime.getUTCSeconds().toString().padStart(2, '0'),
            endTime: tw.endTime.getUTCHours().toString().padStart(2, '0') + ':' +
              tw.endTime.getUTCMinutes().toString().padStart(2, '0') + ':' +
              tw.endTime.getUTCSeconds().toString().padStart(2, '0'),
          })),
          variables: fc.variables.map((v) => ({
            ...v,
            id: v.id.toString(),
            freezeConfigId: v.freezeConfigId.toString(),
            writingVariableId: v.writingVariableId.toString(),
            mboVariableId: v.mboVariableId ? v.mboVariableId.toString() : null,
          })),
        })),
      };
      results.push(backupConfig);
    }

    return {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      data: {
        configs: results,
      },
    };
  }

  private readFileSafe(filePath: string | null): string | null {
    if (!filePath) return null;
    try {
      const absPath = path.resolve(process.cwd(), filePath);
      if (fs.existsSync(absPath)) {
        return fs.readFileSync(absPath, 'utf8');
      }
    } catch (err) {
      this.logger.warn(`Failed to read certificate for backup: ${filePath} - ${err.message}`);
      return null;
    }
    return null;
  }
}
