import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlarmDto } from './dto/create-alarm.dto';
import { UpdateAlarmDto } from './dto/update-alarm.dto';
import { AlarmsGateway } from './alarms.gateway';
import { AlarmEvaluationService } from './alarm-evaluation.service';
import { AlarmHistoryQueryDto } from './dto/alarm-history-query.dto';
import { AlarmCondition, AlarmPriority } from '@prisma/client';

import { AppCacheService } from '../common/cache/cache.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEvent } from '../common/events/domain-events';
import { withRetry, withTxMonitor, chunk } from '../common/utils/prisma-tx.util';
import { plainToInstance } from 'class-transformer';
import { TimeUtils } from '../common/utils/time-utils';
import { AlarmResponseDto, PaginatedAlarmHistoryResponseDto, AlarmHistoryRecordDto } from './dto/response/alarm-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

// type PrismaCond = 'GT' | 'LT' | 'GTE' | 'LTE' | 'EQ' | 'NEQ';

@Injectable()
export class AlarmConfigService {
  private readonly logger = new Logger(AlarmConfigService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly evalService: AlarmEvaluationService,
    private readonly cacheService: AppCacheService,
    private readonly eventBus: DomainEventBus,
  ) { }

  /**
   * Called explicitly from SystemInitializerService after the DB is confirmed ready.
   * No longer blocks the NestJS bootstrap lifecycle (onModuleInit).
   */
  async initialize() {
    this.logger.log('[System] Warming up alarm cache...');
    const alarms = await this.prisma.alarm.findMany({
      where: { isEnabled: true },
      include: { status: true },
    });

    const allStatuses = await this.prisma.alarmStatus.findMany();

    // Group by variableId
    const grouped = new Map<string, any[]>();
    for (const a of alarms) {
      const vid = a.readingVariableId.toString();
      let list = grouped.get(vid);
      if (!list) {
        list = [];
        grouped.set(vid, list);
      }
      list.push(a);
    }

    // Set config caches
    for (const [vid, list] of grouped.entries()) {
      await this.cacheService.set(`alarm_config:variable:${vid}`, list, 3600);
    }

    // Set status caches for ALL alarms
    for (const s of allStatuses) {
      await this.cacheService.set(`alarm_status:${s.alarmId}`, {
        isActive: s.isActive,
        isAcknowledged: s.isAcknowledged,
      });
    }

    this.logger.log(`[System] Alarm cache warmed: ${alarms.length} alarms, ${allStatuses.length} statuses.`);
  }

  async refreshAlarmCache(variableId: bigint) {
    const alarms = await this.prisma.alarm.findMany({
      where: { readingVariableId: variableId, isEnabled: true },
      include: { status: true },
    });

    const cacheKey = `alarm_config:variable:${variableId}`;
    this.logger.log(`Storing in cache (set) ${cacheKey}`);
    await this.cacheService.set(
      cacheKey,
      alarms,
      3600,
    );

    // Also ensure status is in cache
    for (const a of alarms) {
      if (a.status) {
        const cacheKey = `alarm_status:${a.id}`;
        this.logger.log(`Storing in cache (set) ${cacheKey}`);
        await this.cacheService.set(cacheKey, {
          isActive: a.status.isActive,
          isAcknowledged: a.status.isAcknowledged,
        });
      }
    }
  }

  async create(dto: CreateAlarmDto, txClient?: any) {
    const data = {
      id: dto.id ? BigInt(dto.id) : undefined,
      readingVariableId: BigInt(dto.readingVariableId),
      name: dto.name,
      conditionType: this.map(dto.conditionType),
      thresholdValue: dto.thresholdValue,
      priority: (dto.priority as AlarmPriority) ?? AlarmPriority.MEDIUM,
      isEnabled: dto.isEnabled ?? true,
    };

    const performCreation = async (tx: any) => {
      const created = await tx.alarm.create({ data });
      await tx.alarmStatus.create({
        data: { alarmId: created.id, isActive: false, isAcknowledged: false },
      });
      return created;
    };

    const alarm = txClient
      ? await performCreation(txClient)
      : await withRetry(() =>
          withTxMonitor('alarm-create', () =>
            this.prisma.$transaction((tx) => performCreation(tx)),
          ),
        );

    if (!txClient) {
      await this.refreshAlarmCache(data.readingVariableId);
    }
    return plainToInstance(AlarmResponseDto, alarm);
  }

  async findAll(): Promise<AlarmResponseDto[]> {
    const records = await this.prisma.alarm.findMany({
      include: { status: true },
    });
    return plainToInstance(AlarmResponseDto, records);
  }

  async findOne(id: number): Promise<AlarmResponseDto | null> {
    const record = await this.prisma.alarm.findUnique({
      where: { id: BigInt(id) },
      include: { status: true },
    });
    return plainToInstance(AlarmResponseDto, record);
  }

  async update(id: number, dto: UpdateAlarmDto) {
    const data: {
      name?: string;
      thresholdValue?: number;
      priority?: AlarmPriority;
      isEnabled?: boolean;
      conditionType?: AlarmCondition;
    } = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.thresholdValue !== undefined)
      data.thresholdValue = dto.thresholdValue;
    if (dto.priority !== undefined)
      data.priority = dto.priority as AlarmPriority;
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;

    if (dto.conditionType) data.conditionType = this.map(dto.conditionType);
    const a = await this.prisma.alarm.update({
      where: { id: BigInt(id) },
      data,
    });

    await this.refreshAlarmCache(a.readingVariableId);
    return plainToInstance(AlarmResponseDto, a);
  }

  async remove(id: number) {
    const alarm = await this.prisma.alarm.findUnique({ where: { id: BigInt(id) } });
    const res = await this.prisma.alarm.delete({ where: { id: BigInt(id) } });
    if (alarm) {
      await this.refreshAlarmCache(alarm.readingVariableId);
      await this.cacheService.del(`alarm_status:${id}`);
    }
    return new ActionResponseDto({
      success: true,
      message: `Deleted alarm ${id}`,
      id: id.toString(),
      count: 1,
    });
  }

  async acknowledge(id: number, userId?: number) {
    const s = await this.prisma.alarmStatus.findUnique({
      where: { alarmId: BigInt(id) },
    });
    if (s) {
      const type = s.isActive ? 'IA' : 'IOA';
      await withRetry(() =>
        withTxMonitor(`alarm-ack:${id}`, () =>
          this.prisma.$transaction(
            async (tx) => {
              await tx.alarmStatus.update({
                where: { alarmId: BigInt(id) },
                data: { isAcknowledged: true, acknowledgedAt: new Date() },
              });
              await tx.alarmHistory.create({
                data: { alarmId: BigInt(id), eventType: type as any, valueAtEvent: 'N/A', userId },
              });
            },
            { timeout: 20000 },
          ),
        ),
      );
      // Redis updated AFTER successful commit
      const cacheKey = `alarm_status:${id}`;
      await this.cacheService.set(cacheKey, { isActive: s.isActive, isAcknowledged: true }, 86400);

      const alarm = await this.prisma.alarm.findUnique({ where: { id: BigInt(id) } });
      if (alarm) {
        this.eventBus.emit(DomainEvent.ALARM_ACKNOWLEDGED, {
          alarmId: id.toString(),
          variableId: alarm.readingVariableId.toString(),
          name: alarm.name,
          type: type as any,
          priority: alarm.priority,
          value: 'N/A',
          timestamp: new Date(),
        });
      }
    }
    return new ActionResponseDto({
      success: true,
      message: 'Acknowledgment processed',
      id: id.toString(),
    });
  }

  async acknowledgeAll(userId?: number) {
    const active = await this.prisma.alarmStatus.findMany({
      where: { isActive: true, isAcknowledged: false },
    });
    if (active.length === 0)
      return { count: 0, message: 'No alarms to acknowledge' };

    const now = new Date();
    // Chunk into batches of 100 to avoid long-running locks and unbounded queries
    const batches = chunk(active, 100);
    for (const batch of batches) {
      const ids = batch.map((s) => s.alarmId);
      await withRetry(() =>
        withTxMonitor(`alarm-ack-all:batch-${ids.length}`, () =>
          this.prisma.$transaction(
            async (tx) => {
              await tx.alarmStatus.updateMany({
                where: { alarmId: { in: ids } },
                data: { isAcknowledged: true, acknowledgedAt: now },
              });
              await tx.alarmHistory.createMany({
                data: ids.map((id) => ({
                  alarmId: id,
                  eventType: 'IA' as any,
                  valueAtEvent: 'N/A',
                  userId,
                })),
              });
            },
            { timeout: 15000 },
          ),
        ),
      );
      // Update Redis AFTER each batch commits
      for (const s of batch) {
        await this.cacheService.set(`alarm_status:${s.alarmId}`, { isActive: s.isActive, isAcknowledged: true }, 86400);
      }
    }

    for (const s of active) {
      const alarm = await this.prisma.alarm.findUnique({ where: { id: s.alarmId } });
      if (alarm) {
        this.eventBus.emit(DomainEvent.ALARM_ACKNOWLEDGED, {
          alarmId: s.alarmId.toString(),
          variableId: alarm.readingVariableId.toString(),
          name: alarm.name,
          type: 'IA',
          priority: alarm.priority,
          value: 'N/A',
          timestamp: new Date(),
        });
      }
    }
    return new ActionResponseDto({
      success: true,
      message: `${active.length} alarms acknowledged`,
      count: active.length,
    });
  }

  async acknowledgeBatch(ids: number[], userId?: number) {
    const bigIntIds = ids.map((id) => BigInt(id));
    const statuses = await this.prisma.alarmStatus.findMany({
      where: { alarmId: { in: bigIntIds }, isAcknowledged: false },
    });

    if (statuses.length === 0)
      return { count: 0, message: 'No unacknowledged alarms to acknowledge' };

    const now = new Date();
    const batches = chunk(statuses, 100);
    for (const batch of batches) {
      const targetIds = batch.map((s) => s.alarmId);
      await withRetry(() =>
        withTxMonitor(`alarm-ack-batch:${targetIds.length}`, () =>
          this.prisma.$transaction(
            async (tx) => {
              await tx.alarmStatus.updateMany({
                where: { alarmId: { in: targetIds } },
                data: { isAcknowledged: true, acknowledgedAt: now },
              });
              await tx.alarmHistory.createMany({
                data: batch.map((s) => ({
                  alarmId: s.alarmId,
                  eventType: (s.isActive ? 'IA' : 'IOA') as any,
                  valueAtEvent: 'N/A',
                  userId,
                })),
              });
            },
            { timeout: 15000 },
          ),
        ),
      );
      // Update Redis AFTER commit
      for (const s of batch) {
        await this.cacheService.set(`alarm_status:${s.alarmId}`, { isActive: s.isActive, isAcknowledged: true }, 86400);
      }
    }

    for (const s of statuses) {
      const type = s.isActive ? 'IA' : 'IOA';
      const alarm = await this.prisma.alarm.findUnique({ where: { id: s.alarmId } });
      if (alarm) {
        this.eventBus.emit(DomainEvent.ALARM_ACKNOWLEDGED, {
          alarmId: s.alarmId.toString(),
          variableId: alarm.readingVariableId.toString(),
          name: alarm.name,
          type: type as any,
          priority: alarm.priority,
          value: 'N/A',
          timestamp: new Date(),
        });
      }
    }

    return new ActionResponseDto({
      success: true,
      message: `${statuses.length} alarms acknowledged`,
      count: statuses.length,
    });
  }

  private map(c: string): AlarmCondition {
    const m: Record<string, AlarmCondition> = {
      '>': AlarmCondition.GT,
      '<': AlarmCondition.LT,
      '>=': AlarmCondition.GTE,
      '<=': AlarmCondition.LTE,
      '==': AlarmCondition.EQ,
      '!=': AlarmCondition.NEQ,
      GT: AlarmCondition.GT,
      LT: AlarmCondition.LT,
      GTE: AlarmCondition.GTE,
      LTE: AlarmCondition.LTE,
      EQ: AlarmCondition.EQ,
      NEQ: AlarmCondition.NEQ,
    };
    return m[c.trim()] || (c as AlarmCondition);
  }
  private rev(c: string): string {
    const m: Record<string, string> = {
      GT: '>',
      LT: '<',
      GTE: '>=',
      LTE: '<=',
      EQ: '==',
      NEQ: '!=',
    };
    return m[c] || c;
  }

  async getHistory(query: AlarmHistoryQueryDto) {
    const { alarmId, alarmName, startDate, endDate, page = 1, limit = 20 } = query;
    const where: any = {};

    if (alarmId) where.alarmId = BigInt(alarmId);

    if (alarmName) {
      where.alarm = {
        name: {
          contains: alarmName,
        },
      };
    }

    if (startDate || endDate) {
      where.eventTime = {};
      if (startDate) where.eventTime.gte = startDate;
      if (endDate) where.eventTime.lte = endDate;
    }

    const safePage = Math.max(1, Number(page));
    const safeLimit = Math.max(1, Number(limit));

    const [total, data] = await Promise.all([
      this.prisma.alarmHistory.count({ where }),
      this.prisma.alarmHistory.findMany({
        where,
        orderBy: { eventTime: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: { alarm: { select: { name: true, readingVariableId: true } } },
      }),
    ]);

    return new PaginatedAlarmHistoryResponseDto({
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      records: data.map((x) => new AlarmHistoryRecordDto({
        id: x.id.toString(),
        alarmId: x.alarmId.toString(),
        variableId: x.alarm?.readingVariableId?.toString(),
        type: x.eventType,
        name: x.alarm?.name,
        value: x.valueAtEvent,
        date: x.eventTime.toISOString().split('T')[0],
        time: x.eventTime.toTimeString().split(' ')[0],
      })),
    });
  }

  async exportHistoryToExcel(query: AlarmHistoryQueryDto): Promise<Workbook> {
    const { alarmId, alarmName, startDate, endDate } = query;
    const where: any = {};

    if (alarmId) where.alarmId = BigInt(alarmId);

    if (alarmName) {
      where.alarm = {
        name: {
          contains: alarmName,
        },
      };
    }

    if (startDate || endDate) {
      where.eventTime = {};
      if (startDate) where.eventTime.gte = startDate;
      if (endDate) where.eventTime.lte = endDate;
    }

    const data = await this.prisma.alarmHistory.findMany({
      where,
      orderBy: { eventTime: 'desc' },
      include: {
        alarm: {
          select: {
            name: true,
            readingVariable: { select: { name: true } }
          }
        }
      },
    });

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Alarm History');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Time', key: 'time', width: 15 },
      { header: 'Alarm Name', key: 'name', width: 25 },
      { header: 'Variable Name', key: 'variableName', width: 25 },
      { header: 'Event Type', key: 'type', width: 15 },
      { header: 'Value At Event', key: 'value', width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true };

    data.forEach((x) => {
      worksheet.addRow({
        date: x.eventTime.toISOString().split('T')[0],
        time: x.eventTime.toTimeString().split(' ')[0],
        name: x.alarm?.name || '',
        variableName: x.alarm?.readingVariable?.name || '',
        type: x.eventType,
        value: x.valueAtEvent,
      });
    });

    return workbook;
  }

  async getActiveAlarms(): Promise<AlarmHistoryRecordDto[]> {
    const res = await this.prisma.alarmStatus.findMany({
      where: { isActive: true },
      include: { alarm: true },
    });
    return res.map((s) => new AlarmHistoryRecordDto({
      id: s.alarmId.toString(), // Using alarmId as id for active alarms
      alarmId: s.alarmId.toString(),
      variableId: s.alarm.readingVariableId.toString(),
      type: s.isAcknowledged ? 'IA' : 'I',
      name: s.alarm.name,
      value: 'ACTIVE',
      date: TimeUtils.toLocalString(s.activeSince || new Date(), 'YYYY-MM-DD'),
      time: TimeUtils.toLocalString(s.activeSince || new Date(), 'HH:mm:ss'),
    }));
  }
}
