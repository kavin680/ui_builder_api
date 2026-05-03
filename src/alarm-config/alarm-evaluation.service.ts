import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AppCacheService } from '../common/cache/cache.service';
import { Engine } from 'json-rules-engine';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEvent } from '../common/events/domain-events';
import { withRetry, withTxMonitor } from '../common/utils/prisma-tx.util';


type EventType = 'I' | 'IO' | 'IA' | 'IOA' | 'IAO';

@Injectable()
export class AlarmEvaluationService {
  private readonly logger = new Logger(AlarmEvaluationService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: AppCacheService,
    private readonly eventBus: DomainEventBus,
  ) { }

  async handleBatchUpdated(updates: { variableId: bigint; value: string }[]) {
    if (updates.length === 0) return;

    this.logger.log(`[DEBUG] Evaluating batch of ${updates.length} variables. Updates: ${JSON.stringify(updates, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);

    const uniqueIds = [...new Set(updates.map((u) => u.variableId))];
    this.logger.log(`[DEBUG] Unique variable IDs: ${uniqueIds.join(', ')}`);

    // 1. Fetch all alarm configs from Redis
    const configKeys = uniqueIds.map((id) => `alarm_config:variable:${id}`);
    const cachedConfigs = await this.cacheService.mget<any[][]>(configKeys);

    const alarmConfigsMap = new Map<string, any[]>();
    const missingIds: bigint[] = [];

    uniqueIds.forEach((id, i) => {
      if (cachedConfigs[i]) {
        alarmConfigsMap.set(id.toString(), cachedConfigs[i]);
      } else {
        missingIds.push(id);
      }
    });

    // 1b. Fallback to DB for missing configs
    if (missingIds.length > 0) {
      this.logger.log(`[DEBUG] Cache miss for variableIds: ${missingIds.join(', ')}. Fetching from DB.`);
      const dbAlarms = await this.prisma.alarm.findMany({
        where: { readingVariableId: { in: missingIds }, isEnabled: true },
        include: { status: true },
      });

      // Group DB results O(n) and cache them
      const dbGrouped = new Map<string, any[]>();
      for (const alarm of dbAlarms) {
        const key = alarm.readingVariableId.toString();
        let list = dbGrouped.get(key);
        if (!list) {
          list = [];
          dbGrouped.set(key, list);
        }
        list.push(alarm);
      }

      for (const id of missingIds) {
        const variableAlarms = dbGrouped.get(id.toString()) || [];
        alarmConfigsMap.set(id.toString(), variableAlarms);
        await this.cacheService.set(`alarm_config:variable:${id}`, variableAlarms, 300000);
      }
    }

    // 2. Identify all alarm IDs to check statuses
    const allAlarms: any[] = [];
    alarmConfigsMap.forEach((alarms) => allAlarms.push(...alarms));

    if (allAlarms.length === 0) {
      this.logger.log(`[DEBUG] No alarms configured for any variables in this batch.`);
      return;
    }

    // 3. Fetch all alarm statuses from Redis
    const statusKeys = allAlarms.map((a) => `alarm_status:${a.id}`);
    const cachedStatuses = await this.cacheService.mget<{ isActive: boolean; isAcknowledged: boolean }>(
      statusKeys,
    );

    const statusMap = new Map<string, { isActive: boolean; isAcknowledged: boolean }>();
    const missingStatusAlarmIds: bigint[] = [];

    allAlarms.forEach((a, i) => {
      const cached = cachedStatuses[i];
      if (cached !== undefined) {
        statusMap.set(a.id.toString(), cached);
      } else {
        missingStatusAlarmIds.push(BigInt(a.id));
      }
    });

    if (missingStatusAlarmIds.length > 0) {
      this.logger.log(`[DEBUG] Fetching missing statuses for ${missingStatusAlarmIds.length} alarms from DB`);
      const dbStatuses = await this.prisma.alarmStatus.findMany({
        where: { alarmId: { in: missingStatusAlarmIds } },
      });
      for (const s of dbStatuses) {
        statusMap.set(s.alarmId.toString(), { isActive: s.isActive, isAcknowledged: s.isAcknowledged });
        await this.cacheService.set(
          `alarm_status:${s.alarmId}`,
          { isActive: s.isActive, isAcknowledged: s.isAcknowledged },
          86400,
        );
      }
      // Handle IDs that don't exist in DB (shouldn't happen with proper CRUD)
      for (const id of missingStatusAlarmIds) {
        if (!statusMap.has(id.toString())) {
          statusMap.set(id.toString(), { isActive: false, isAcknowledged: false });
        }
      }
    }

    this.logger.log(`[DEBUG] Alarms to evaluate: ${allAlarms.length}. Statuses in map: ${statusMap.size}`);

    // 4. Evaluation Loop: 
    // We iterate through all updates and check them against their respective rules.
    // We use a high-performance Promise.all to run these checks in parallel.
    const evalPromises = updates.flatMap((update) => {
      const variableAlarms =
        alarmConfigsMap.get(update.variableId.toString()) || [];
      return variableAlarms.map((alarm) => {
        const state = statusMap.get(alarm.id.toString()) || { isActive: false, isAcknowledged: false };
        return this.evaluateAlarm(alarm, update.value, state.isActive, state.isAcknowledged);
      });
    });

    await Promise.all(evalPromises);
  }

  async handleValueChange(varId: bigint, valStr: string) {
    return this.handleBatchUpdated([{ variableId: varId, value: valStr }]);
  }

  async evaluateAlarm(alarm: any, valStr: string, currentIsActive: boolean, currentIsAck: boolean) {
    const val = Number(valStr);
    if (isNaN(val)) return;

    // Create a new engine instance for each evaluation to prevent O(n^2) accumulation
    const engine = new Engine();
    const conditionMap: any = {
      '>': 'greaterThan',
      '<': 'lessThan',
      '>=': 'greaterThanInclusive',
      '<=': 'lessThanInclusive',
      '==': 'equal',
      '!=': 'notEqual',
    };

    const operator = conditionMap[this.rev(alarm.conditionType)] || 'equal';

    // Instead of addRule, we could use pre-configured rules, 
    // but since threshold/operator vary per alarm, we at least avoid new Engine() instantiation overhead.
    // For even more performance, we could cache the rule object itself.
    engine.addRule({
      conditions: {
        all: [{
          fact: 'variableValue',
          operator: operator,
          value: Number(alarm.thresholdValue),
        }],
      },
      event: { type: 'alarm-met', params: { alarmId: alarm.id } },
    });

    const { events } = await engine.run({ variableValue: val });
    const met = events.length > 0;
    const clear = !met;

    // We only trigger state changes if the alarm status actually flipped.
    // This prevents "spamming" the database and UI with redundant events
    // when a value is staying in the "danger zone".
    if (met && !currentIsActive) {
      await this.trigger(alarm, true, valStr, false);
    } else if (clear && currentIsActive) {
      await this.trigger(alarm, false, valStr, currentIsAck);
    }
  }

  async trigger(alarm: any, active: boolean, val: string, wasAck: boolean) {
    const id = BigInt(alarm.id);
    const now = new Date();
    const eventType = active ? 'I' : (wasAck ? 'IAO' : 'IO');

    // 1. Persistent DB update WITH retry (deadlock-safe) and monitoring
    try {
      await withRetry(() =>
        withTxMonitor(`alarm-trigger:${id}`, () =>
          this.prisma.$transaction(
            async (tx) => {
              await tx.alarmStatus.update({
                where: { alarmId: id },
                data: {
                  isActive: active,
                  isAcknowledged: active ? false : undefined,
                  activeSince: active ? now : undefined,
                  clearedAt: active ? null : now,
                  acknowledgedAt: active ? null : undefined,
                },
              });
              await tx.alarmHistory.create({
                data: {
                  alarmId: id,
                  eventType: eventType as any,
                  valueAtEvent: val,
                  eventTime: now,
                },
              });
            },
            { timeout: 20000 },
          ),
        ),
      );

      // 2. Only update Redis AFTER the DB transaction commits successfully
      //    This prevents cache-DB desync when the transaction rolls back.
      await this.cacheService.set(
        `alarm_status:${id}`,
        { isActive: active, isAcknowledged: active ? false : wasAck },
        86400,
      );
    } catch (err) {
      this.logger.error(`Failed to trigger alarm ${id} in DB`, err);
      // Do NOT update cache — DB is the source of truth
      return;
    }

    const alarmEventPayload = {
      alarmId: id.toString(),
      variableId: alarm.readingVariableId.toString(),
      name: alarm.name,
      type: eventType as any,
      priority: alarm.priority,
      value: val,
      timestamp: now,
    };

    // We use the Domain Event Bus to notify the UI and logging services.
    // If the alarm is active, it hits the "Triggered" lane (sound sirens, flash red).
    // If it's cleared, it hits the "Cleared" lane (green status).
    if (active) {
      this.eventBus.emit(DomainEvent.ALARM_TRIGGERED, alarmEventPayload);
    } else {
      this.eventBus.emit(DomainEvent.ALARM_CLEARED, alarmEventPayload);
    }

    this.logger.log(
      `Alarm ${id} ${active ? 'Activated' : 'Cleared'} with type ${eventType} value ${val}`,
    );

    if (alarm.status) {
      alarm.status.isActive = active;
      if (active) alarm.status.isAcknowledged = false;
    }
  }

  private rev(c: string): string {
    const m: any = {
      GT: '>',
      LT: '<',
      GTE: '>=',
      LTE: '<=',
      EQ: '==',
      NEQ: '!=',
    };
    return m[c] || c;
  }
}
