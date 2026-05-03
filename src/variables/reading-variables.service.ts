import { Workbook } from 'exceljs';
import {
  BadRequestException,
  Injectable,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEvent } from '../common/events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReadingVariableDto } from './dto/create-reading-variable.dto';
import { VariablesGateway } from './variables.gateway';
import { AlarmConfigService } from '../alarm-config/alarm-config.service';
import { DerivedFunctionHandlers } from '../const/derived-function-handlers';
import { PARAMETER_COUNT_MAP } from '../const/function-registry';
import { GlobalConfigurationsService } from '../global-configurations/global-configurations.service';
import { TimeUtils } from '../common/utils/time-utils';
import { AppCacheService } from '../common/cache/cache.service';
import { ReadingVariable as ReadingVariableModel, HistoryType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { ReadingVariableResponseDto } from './dto/response/reading-variable-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

interface ReadingVariableCreateData {
  globalConfigId: bigint;
  name: string;
  value: string | null;
  functionName: string | null;
  startIndex: number | null;
  sequenceNo: number;
  isActive?: boolean;
  historyType?: HistoryType;
  loggingTime?: number | null;
}

interface ReadingVariableUpdateData {
  name?: string;
  value?: string | null;
  functionName?: string | null;
  startIndex?: number | null;
  sequenceNo?: number;
  isActive?: boolean;
  historyType?: HistoryType;
  loggingTime?: number | null;
}

const SQL_CHUNK_SIZE = 500;
@Injectable()
export class ReadingVariablesService {
  private readonly logger = new Logger(ReadingVariablesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly variablesGateway: VariablesGateway,
    private readonly alarmService: AlarmConfigService,
    private readonly eventBus: DomainEventBus,
    private readonly globalConfigService: GlobalConfigurationsService,
    private readonly cacheService: AppCacheService,
    @InjectQueue('variable-update') private variableUpdateQueue: Queue,
    @InjectQueue('alarm-evaluation') private alarmEvaluationQueue: Queue,
  ) { }

  async createReadingVariable(dto: CreateReadingVariableDto, txClient?: any) {
    const prisma = txClient || this.prisma;
    // Prepare data object
    const createData: ReadingVariableCreateData & { id?: bigint } = {
      id: dto.id ? BigInt(dto.id) : undefined,
      globalConfigId: BigInt(dto.globalConfigId),
      name: dto.name,
      value:
        dto.value !== undefined && dto.value !== null
          ? String(dto.value)
          : null,
      functionName: dto.functionName ?? null,
      startIndex: dto.startIndex ?? null,
      sequenceNo: dto.sequenceNo ?? 0,
      historyType: dto.historyType ?? HistoryType.NONE,
      loggingTime: dto.loggingTime ?? null,
    };
    if (dto.isActive !== undefined) createData.isActive = dto.isActive;

    const updateData: ReadingVariableUpdateData = {
      name: dto.name,
      value:
        dto.value !== undefined && dto.value !== null
          ? String(dto.value)
          : null,
      functionName: dto.functionName ?? null,
      startIndex: dto.startIndex ?? null,
      sequenceNo: dto.sequenceNo ?? 0,
      historyType: dto.historyType ?? HistoryType.NONE,
      loggingTime: dto.loggingTime ?? null,
    };
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const whereClause = dto.id
      ? { id: BigInt(dto.id) }
      : {
        globalConfigId_name: {
          globalConfigId: BigInt(dto.globalConfigId),
          name: dto.name,
        },
      };

    const record = await prisma.readingVariable.upsert({
      where: whereClause as any, // Prisma unique input can be tricky with BigInt
      create: createData as any,
      update: updateData as any,
    });

    // Invalidate cache
    const cacheKey = `reading_variables_config_${dto.globalConfigId}`;
    this.logger.log(
      { cacheKey, action: 'cache_invalidation', configId: dto.globalConfigId },
      'Invalidating reading variables configuration cache'
    );
    await this.cacheService.del(cacheKey);

    return new ActionResponseDto({
      success: true,
      message: 'Reading variable created/updated successfully',
      id: record.id.toString(),
      count: 1,
    });
  }

  /**
   * Update reading variables by index order
   * @param globalConfigId - The global configuration ID
   * @param values - Array of values (hex or numeric strings) to update (in order)
   * returns Update result
   */
  async updateReadingVariablesByIndex(
    globalConfigId: number,
    values: string[],
  ) {
    // We receive a raw list of values (e.g. from an MQTT packet).
    // Our job is to map these values to the correct database variables 
    // based on their sequence order.
    if (!values || values.length === 0) {
      return {
        count: 0,
        message: 'No values provided in request',
        updatedVariables: [],
      };
    }

    // Fetch global config from cache to get alterFlag
    const globalConfig = (await this.globalConfigService.findOne(
      globalConfigId,
    )) as { alterFlag: boolean } | null;

    const useFunction = globalConfig?.alterFlag ?? false;

    // Fetch reading variables with caching
    const cacheKey = `reading_variables_config_${globalConfigId}`;
    let variables =
      await this.cacheService.get<ReadingVariableModel[]>(cacheKey);

    if (!variables) {
      variables = await this.prisma.readingVariable.findMany({
        where: { globalConfigId: BigInt(globalConfigId) },
        orderBy: { sequenceNo: 'asc' },
      });
      await this.cacheService.set(cacheKey, variables, 60000); // 1 minute TTL
    }

    if (variables.length === 0) {
      return {
        count: 0,
        message: `No variables found for configuration ID ${globalConfigId}. Please create variables first using POST /variables/reading/batch`,
        updatedVariables: [],
      };
    }

    // Create a map for O(1) lookups
    const variableMap = new Map(variables.map((v) => [v.name, v]));

    // Process each variable
    const updatedVariables: {
      id: bigint;
      name: string;
      value: string;
      calculated: boolean;
    }[] = [];
    const historyEntries: { id: bigint; value: string }[] = [];
    const skippedVariables: { name: string; reason: string }[] = [];

    // Re-implementing the loop with variableMap optimization
    for (const variable of variables) {
      const {
        value: finalValue,
        error: skipReason,
        isCalculated,
      } = this.calculateReadingValue(variable, values, useFunction);

      if (skipReason) {
        skippedVariables.push({ name: variable.name, reason: skipReason });
        this.logger.debug(`Skipped variable ${variable.name}: ${skipReason}`);
        continue;
      }

      if (finalValue === null) continue;

      // History tracking: 
      // 'INSTANT' logs every single change regardless of value.
      // 'ON_CHANGE' only logs if the value actually moved—this saves massive DB space.
      if (variable.historyType === 'INSTANT') {
        historyEntries.push({ id: variable.id, value: finalValue });
      } else if (variable.historyType === 'ON_CHANGE') {
        if (variable.value !== finalValue) {
          this.logger.debug(
            `History ON_CHANGE triggered for ${variable.name}: ${variable.value} -> ${finalValue}`,
          );
          historyEntries.push({ id: variable.id, value: finalValue });
        }
      }

      if (variable.historyType === 'INSTANT') {
        // Already handled above, but double check
      }

      // Update variable in database
      updatedVariables.push({
        id: variable.id,
        name: variable.name,
        value: finalValue,
        calculated: isCalculated,
      });
    }
    if (updatedVariables.length > 0) {
      // We broadcast the update to the internal Event Bus. 
      // This decouples the core telemetry ingestion from side-effects 
      // like WebSocket emissions or Alarms, making the system much faster.
      this.eventBus.emit(DomainEvent.TELEMETRY_UPDATED, {
        globalConfigId,
        updates: updatedVariables.map((v) => {
          const variable = variableMap.get(v.name); // you already have this map

          return {
            variableId: v.id.toString(),
            variableName: v.name,
            value: v.value,
            isCalculated: v.calculated,
            historyType: variable?.historyType, // 👈 ADD THIS
          };
        }),
      });
    }

    // Side effects (WebSocket, History, Alarms) are now handled by TelemetryListener
    // triggered by the DomainEvent below.

    const calculatedCount = updatedVariables.filter((v) => v.calculated).length;
    const regularCount = updatedVariables.filter((v) => !v.calculated).length;

    return {
      count: updatedVariables.length,
      message: `Updated ${updatedVariables.length} variable${updatedVariables.length !== 1 ? 's' : ''} (${regularCount} raw, ${calculatedCount} calculated)`,
      details: {
        totalVariables: variables.length,
        updatedVariables: updatedVariables.length,
        rawVariables: regularCount,
        calculatedVariables: calculatedCount,
        inputValuesProvided: values.length,
      },
      updatedVariables: updatedVariables.map(v => ({ ...v, id: v.id.toString() })),
    };
  }

  async findAllReadingVariables(globalConfigId: number): Promise<ReadingVariableResponseDto[]> {
    const records = await this.prisma.readingVariable.findMany({
      where: {
        globalConfigId: BigInt(globalConfigId),
      },
      orderBy: { sequenceNo: 'asc' },
    });
    return plainToInstance(ReadingVariableResponseDto, records, {
      excludeExtraneousValues: true,
    });
  }

  async findAllActiveReadingVariables(): Promise<ReadingVariableResponseDto[]> {
    const records = await this.prisma.readingVariable.findMany({
      where: {
        globalConfig: {
          isActive: true,
        },
      },
      select: {
        id: true,
        name: true,
        value: true,
        globalConfigId: true,
        historyType: true,
        loggingTime: true,
        sequenceNo: true,
        isActive: true,
        functionName: true,
        startIndex: true,
        lastRunAt: true,
        next_run_at: true,
      },
      orderBy: [{ globalConfigId: 'asc' }, { sequenceNo: 'asc' }],
    });
    return plainToInstance(ReadingVariableResponseDto, records, {
      excludeExtraneousValues: true,
    });
  }

  async getReadingHistory(
    start: Date,
    end: Date,
    variableIds?: number[],
  ) {
    if (end <= start) {
      throw new BadRequestException('endDate must be greater than startDate');
    }

    const MAX_RANGE = 1000 * 60 * 60 * 24 * 31; // 31 days
    if (end.getTime() - start.getTime() > MAX_RANGE) {
      return {
        message:
          "The requested date range is too large to load in the chart. For periods longer than a month, please use the 'Export TO CSV' feature.",
        excessiveData: true,
      };
    }

    const MAX_VARIABLES = 20;
    if (variableIds && variableIds.length > MAX_VARIABLES) {
      throw new BadRequestException(
        `Maximum ${MAX_VARIABLES} variables allowed`,
      );
    }

    const whereClause: {
      recordedAt: { gte: Date; lte: Date };
      readingVariableId?: { in: bigint[] };
    } = {
      recordedAt: {
        gte: start,
        lte: end,
      },
    };

    if (variableIds?.length) {
      whereClause.readingVariableId = {
        in: variableIds.map((id) => BigInt(id)),
      };
    }

    const history = await this.prisma.readingVariableHistory.findMany({
      where: whereClause,
      take: 50000, // Safety limit to prevent Node.js OOM
      include: {
        readingVariable: {
          select: {
            name: true,
            globalConfigId: true,
          },
        },
      },
      orderBy: {
        recordedAt: 'asc', // better for charts
      },
    });

    // ✅ Group by variable
    const grouped: Record<
      string,
      {
        variableName: string;
        globalConfigId: string;
        points: { t: number; v: number }[];
      }
    > = {};

    for (const h of history) {
      const varId = h.readingVariableId.toString();

      if (!grouped[varId]) {
        grouped[varId] = {
          variableName: h.readingVariable.name,
          globalConfigId: h.readingVariable.globalConfigId.toString(),
          points: [],
        };
      }

      grouped[varId].points.push({
        t: h.recordedAt.getTime(), // unix ms
        v: Number(h.value), // ensure number
      });
    }

    return grouped;
  }

  async deleteAllReadingVariables(globalConfigId: number) {
    const result = await this.prisma.readingVariable.deleteMany({
      where: {
        globalConfigId: BigInt(globalConfigId),
      },
    });

    // Invalidate cache
    const cacheKey = `reading_variables_config_${globalConfigId}`;
    await this.cacheService.del(cacheKey);

    return new ActionResponseDto({
      success: true,
      message: `Deleted ${result.count} reading variables`,
      count: result.count,
    });
  }

  private async bulkUpdateReadingVariables(
    variables: { name: string; value?: string | number | null }[],
    configId?: number,
  ) {
    if (variables.length === 0) return 0;

    const caseParts: string[] = [];
    const values: (string | number | bigint | null)[] = [];
    const names: string[] = [];

    // Construct CASE...WHEN...THEN
    variables.forEach((v) => {
      caseParts.push('WHEN name = ? THEN ?');
      values.push(
        v.name,
        v.value !== undefined && v.value !== null ? String(v.value) : null,
      );
      names.push(v.name);
    });

    const caseSql = caseParts.join(' ');
    const placeholders = names.map(() => '?').join(', ');

    let whereClause = '1 = 1';

    // Add configId param if present (must be added BEFORE IN clause params)
    if (configId) {
      whereClause += ` AND global_config_id = ?`;
      values.push(BigInt(configId));
    }

    // Add names for IN clause (must be added AFTER WHERE clause params)
    names.forEach((name) => values.push(name));

    const sql = `
      UPDATE reading_variable
      SET 
        value = CASE ${caseSql} END,
        updated_at = NOW()
      WHERE ${whereClause}
      AND name IN (${placeholders})
    `;

    // DEBUG: Log the variables and values being passed (reduced logging)
    // console.log('🔍 DEBUG bulkUpdateReadingVariables updated.');

    const result = await this.prisma.$executeRawUnsafe(sql, ...values);
    return result;
  }

  private async insertReadingHistoryRawSql(
    entries: { id: bigint; value: string }[],
  ) {
    if (entries.length === 0) return;
    const chunks = this.chunk(entries, SQL_CHUNK_SIZE);
    for (const chunk of chunks) {
      await this.bulkInsertHistoryFromEntries(chunk);
    }
  }

  private async bulkInsertHistoryFromEntries(
    entries: { id: bigint; value: string }[],
  ) {
    // Prepare history records with tiny offsets to ensure uniqueness in the same millisecond
    const now = Date.now();
    const historyRecords = entries.map((entry, i) => ({
      readingVariableId: entry.id,
      value: entry.value,
      recordedAt: new Date(now + i),
    }));

    if (historyRecords.length === 0) return;

    // Insert all history records at once
    await this.prisma.readingVariableHistory.createMany({
      data: historyRecords,
      skipDuplicates: true,
    });
  }

  private calculateReadingValue(
    variable: ReadingVariableModel,
    values: string[],
    useFunction: boolean,
  ): { value: string | null; error: string | null; isCalculated: boolean } {
    let finalValue: string | null = null;
    let error: string | null = null;
    let isCalculated = false;

    if (useFunction && variable.functionName) {
      const count = PARAMETER_COUNT_MAP[variable.functionName];
      // console.log('🔍 DEBUG count:', count);
      const startIdx = variable.startIndex ?? 0;
      // console.log('🔍 DEBUG startIdx:', startIdx);

      if (count !== undefined && startIdx + count <= values.length) {
        const inputs = values.slice(startIdx, startIdx + count);
        // console.log('🔍 DEBUG inputs:', inputs);
        const fn = DerivedFunctionHandlers[variable.functionName];

        if (fn) {
          finalValue = String(fn(inputs));
          isCalculated = true;
        } else {
          error = `Function '${variable.functionName}' not found`;
        }
      } else {
        error = `Not enough values (need ${count}, have ${values.length - startIdx})`;
      }
    } else {
      const targetIndex = variable.sequenceNo - 1;
      if (targetIndex >= 0 && targetIndex < values.length) {
        finalValue = values[targetIndex];
      } else {
        error = `No input value at index ${targetIndex} (sequenceNo ${variable.sequenceNo})`;
      }
    }

    return { value: finalValue, error, isCalculated };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  async exportReadingHistoryToExcel(
    start: Date,
    end: Date,
    variableIds?: number[],
  ): Promise<Workbook> {

    const whereClause: any = {
      recordedAt: {
        gte: start,
        lte: end,
      },
    };

    if (variableIds?.length) {
      whereClause.readingVariableId = {
        in: variableIds.map((id) => BigInt(id)),
      };
    }

    const history = await this.prisma.readingVariableHistory.findMany({
      where: whereClause,
      take: 100000,
      include: {
        readingVariable: {
          select: {
            name: true,
            globalConfigId: true,
          },
        },
      },
      orderBy: {
        recordedAt: 'asc',
      },
    });

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Reading History');

    // 🟢 STEP 1: Collect unique variable names
    const variableSet = new Set<string>();
    history.forEach((h) => {
      variableSet.add(h.readingVariable.name);
    });
    const variableNames = Array.from(variableSet);

    // 🟢 STEP 2: Group data by timestamp (Local IST)
    const grouped = new Map<string, Record<string, any>>();

    history.forEach((h) => {
      const timestamp = TimeUtils.toLocalString(h.recordedAt);

      if (!grouped.has(timestamp)) {
        grouped.set(timestamp, { timestamp });
      }

      const row = grouped.get(timestamp)!;
      row[h.readingVariable.name] = Number(h.value);
    });

    // 🟢 STEP 3: Define columns
    worksheet.columns = [
      { header: 'Timestamp (Local)', key: 'timestamp', width: 25 },
      ...variableNames.map((name) => ({
        header: name,
        key: name,
        width: 15,
      })),
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };

    // 🟢 STEP 4: Add rows
    grouped.forEach((row) => {
      const fullRow: any = {
        timestamp: row.timestamp,
      };

      variableNames.forEach((name) => {
        fullRow[name] = row[name] ?? null;
      });

      worksheet.addRow(fullRow);
    });

    return workbook;
  }

  async clearCache() {
    this.logger.warn('[ReadingVariables] Clearing all Redis caches.');
    // Clear live values hash
    await this.cacheService.del('variables:values:reading');

    // Clear configuration caches (individual configs)
    // Since we don't have a list of all IDs here, we can use a pattern if supported,
    // or just rely on the fact that restore/reset will wipe everything.
    // Our AppCacheService.clear() wipes the entire cache store.
    await this.cacheService.clear();
  }

  async rebuildCache() {
    this.logger.log('[System] Rebuilding variable cache...');
    const activeVars = await this.findAllActiveReadingVariables();
    const data: Record<string, string> = {};

    for (const v of activeVars) {
      data[v.id.toString()] = v.value ?? '0';
    }

    if (Object.keys(data).length > 0) {
      await this.cacheService.hmset('variables:values:reading', data);
    }
    this.logger.log(`[ReadingVariables] Rebuilt cache for ${activeVars.length} variables.`);
  }
}

