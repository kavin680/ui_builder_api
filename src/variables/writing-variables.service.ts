import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWritingVariableDto } from './dto/create-writing-variable.dto';
import { UpdateWritingVariableDto } from './dto/update-writing-variable.dto';

import { DerivedFunctionHandlers } from '../const/derived-function-handlers';
import { UpdateWritingVariableMboDto } from './dto/update-writing-variable-mbo.dto';
import { GlobalConfigurationsService } from '../global-configurations/global-configurations.service';
import { OnEvent } from '@nestjs/event-emitter';
import { SYSTEM_EVENTS } from '../common/const/events';

import { WritingVariable as WritingVariableModel } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { WritingVariableResponseDto, WritingVariableMboResponseDto } from './dto/response/writing-variable-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

// ReadingVariableModel can be used directly or we can keep a local interface if needed for specific logic
// But here we'll use WritingVariableModel where appropriate

interface WritingVariableCreateData {
  name: string;
  value: number | string | null;
  globalConfigId: bigint;
  rawValue: string | null;
  functionName: string | null;
  sequenceNo: number;
  hasMbo: boolean;
  isActive?: boolean;
}

interface WritingVariableUpdateData {
  name?: string;
  value?: number | string | null;
  rawValue?: string | null;
  functionName?: string | null;
  sequenceNo?: number;
  hasMbo?: boolean;
  isActive?: boolean;
}

@Injectable()
export class WritingVariablesService {
  private readonly logger = new Logger(WritingVariablesService.name);
  private readonly globalConfigCache = new Map<number, boolean>();
  private readonly encodedCache = new Map<number, any[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly globalConfigService: GlobalConfigurationsService,
  ) { }

  @OnEvent(SYSTEM_EVENTS.RESET)
  async handleSystemReset() {
    await this.clearCache();
  }

  async clearCache(globalConfigId?: number) {
    if (globalConfigId) {
      this.logger.debug(`[Cache] Clearing encoded cache for globalConfig ${globalConfigId}`);
      this.encodedCache.delete(globalConfigId);
    } else {
      this.logger.debug(`[Cache] Clearing all encoded caches`);
      this.encodedCache.clear();
      this.globalConfigCache.clear();
    }
  }

  async findAllEncodedWritingVariables(globalConfigId: number) {
    const cached = this.encodedCache.get(globalConfigId);
    if (cached) return cached;

    const result = await this.prisma.writingVariable.findMany({
      where: {
        globalConfigId: BigInt(globalConfigId),
        isActive: true,
      },
      select: {
        rawValue: true,
      },
      orderBy: { id: 'asc' },
    });

    this.encodedCache.set(globalConfigId, result);
    return result;
  }

  async createWritingVariable(dto: CreateWritingVariableDto, txClient?: any) {
    // Fetch global config using cache if possible
    let useFunction = this.globalConfigCache.get(Number(dto.globalConfigId));
    if (useFunction === undefined) {
      const globalConfig = await this.globalConfigService.findOne(
        Number(dto.globalConfigId),
      );
      useFunction = globalConfig?.alterFlag ?? false;
      this.globalConfigCache.set(Number(dto.globalConfigId), useFunction);
    }

    const resolvedValue = dto.value ?? 0;
    let calculatedRawValue: any = dto.rawValue;
    if (calculatedRawValue === undefined || calculatedRawValue === null) {
      if (useFunction && dto.functionName) {
        const calculated = this.calculateRawValue(
          resolvedValue,
          dto.functionName,
        );
        if (calculated !== null) {
          calculatedRawValue = calculated;
        }
      } else {
        // Use string representation of the resolved value
        calculatedRawValue = String(resolvedValue);
      }
    }

    let finalRawValue: string | null = null;
    if (calculatedRawValue !== null) {
      finalRawValue =
        typeof calculatedRawValue === 'string'
          ? calculatedRawValue
          : JSON.stringify(calculatedRawValue);
    }

    const isByteFunction =
      dto.functionName === 'BYTE' || dto.functionName === 'BYTE_SWAP';
    const hasMboActual = isByteFunction || !!(dto.mboVariables && dto.mboVariables.length > 0);
    const createData: WritingVariableCreateData & { id?: bigint } = {
      id: dto.id ? BigInt(dto.id) : undefined,
      name: dto.name,
      value: resolvedValue,
      globalConfigId: BigInt(dto.globalConfigId),
      rawValue: finalRawValue,
      functionName: dto.functionName ?? null,

      sequenceNo: dto.sequenceNo ?? 0,
      hasMbo: hasMboActual,
    };
    if (dto.isActive !== undefined) createData.isActive = dto.isActive;

    const updateData: WritingVariableUpdateData = {
      name: dto.name,
      value: resolvedValue,
      rawValue: finalRawValue,
      functionName: dto.functionName ?? null,

      sequenceNo: dto.sequenceNo ?? 0,
      hasMbo: hasMboActual,
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

    const prisma = txClient || this.prisma;

    const performUpsertAndMbo = async (tx: any) => {
      const upserted = await tx.writingVariable.upsert({
        where: whereClause as any,
        create: createData as any,
        update: updateData as any,
      });

      // Handle MBO generation/restoration with a sync approach (Preserve IDs and Names)
      const existingMbos = await tx.writingVariableMbo.findMany({
        where: { writingVariableId: upserted.id },
      });
      const existingMboMap = new Map<number, any>(
        existingMbos.map((m: any) => [m.sequenceNo, m]),
      );

      if (dto.mboVariables && dto.mboVariables.length > 0) {
        // Restore from explicit list (e.g., during System Restore)
        const processedSequenceNos = new Set<number>();

        for (const mboDataRaw of (dto.mboVariables as any[])) {
          const mbo = mboDataRaw as any;
          const sequenceNo = mbo.sequenceNo ?? 0;
          processedSequenceNos.add(sequenceNo);
          const existing = existingMboMap.get(sequenceNo);

          const mboData: any = {
            writingVariableId: upserted.id,
            name: mbo.name || `${dto.name}_${sequenceNo}`,
            value: mbo.value !== undefined ? Number(mbo.value) : (dto.value ?? 0),
            sequenceNo: sequenceNo,
          };

          if (existing) {
            await tx.writingVariableMbo.update({
              where: { id: existing.id },
              data: mboData,
            });
          } else {
            if (mbo.id) mboData.id = BigInt(mbo.id);
            await tx.writingVariableMbo.create({
              data: mboData,
            });
          }
        }

        // Cleanup: Delete MBOs not in the DTO list
        const idsToDelete = existingMbos
          .filter((m: any) => !processedSequenceNos.has(m.sequenceNo))
          .map((m: any) => m.id);
        if (idsToDelete.length > 0) {
          await tx.writingVariableMbo.deleteMany({
            where: { id: { in: idsToDelete } },
          });
        }
      } else if (dto.functionName === 'BYTE' || dto.functionName === 'BYTE_SWAP') {
        const mboCount = 8;
        const valForMbo = dto.value ?? 0;
        const processedSequenceNos = new Set<number>();

        for (let i = 0; i < mboCount; i++) {
          const sequenceNo = (dto.sequenceNo ?? 0) + i;
          processedSequenceNos.add(sequenceNo);
          const existing = existingMboMap.get(sequenceNo);

          const mboData = {
            writingVariableId: upserted.id,
            name: `${dto.name}_${i}`,
            value: valForMbo,
            sequenceNo: sequenceNo,
          };

          if (existing) {
            await tx.writingVariableMbo.update({
              where: { id: existing.id },
              data: mboData,
            });
          } else {
            await tx.writingVariableMbo.create({
              data: mboData,
            });
          }
        }

        // Cleanup: Delete extra MBOs
        const idsToDelete = existingMbos
          .filter((m: any) => !processedSequenceNos.has(m.sequenceNo))
          .map((m: any) => m.id);
        if (idsToDelete.length > 0) {
          await tx.writingVariableMbo.deleteMany({
            where: { id: { in: idsToDelete } },
          });
        }
        // This is the MBO (Manual/Backup/Override) logic. 
        // For 'BYTE' type variables, we automatically generate 8 child variables
        // representing each individual bit. This allows a user to toggle a single 
        // relay (bit) without knowing the decimal value of the whole byte.
        await tx.writingVariableMbo.deleteMany({
          where: { writingVariableId: upserted.id },
        });
      }
      return upserted;
    };

    const record = txClient
      ? await performUpsertAndMbo(txClient)
      : await this.prisma.$transaction(async (tx) => {
        return await performUpsertAndMbo(tx);
      });

    this.clearCache(Number(dto.globalConfigId));
    return new ActionResponseDto({
      success: true,
      message: 'Writing variable created/updated successfully',
      id: record.id.toString(),
      count: 1,
    });
  }

  async findAllWritingVariables(globalConfigId: number): Promise<WritingVariableResponseDto[]> {
    const records = await this.prisma.writingVariable.findMany({
      where: { globalConfigId: BigInt(globalConfigId) },
      include: { mboVariables: true },
      orderBy: { name: 'asc' },
    });
    return plainToInstance(WritingVariableResponseDto, records, {
      excludeExtraneousValues: true,
    });
  }

  async findAllActiveWritingVariables(): Promise<WritingVariableResponseDto[]> {
    const records = await this.prisma.writingVariable.findMany({
      where: {
        globalConfig: {
          isActive: true,
        },
      },
      include: { mboVariables: true },
      orderBy: [{ globalConfigId: 'asc' }, { name: 'asc' }],
    });

    const cleaned = records.map((r) => ({
      ...r,

      // ✅ FIX BigInt
      id: r.id.toString(),
      globalConfigId: r.globalConfigId.toString(),

      // ✅ FIX Decimal
      value: r.value !== null ? Number(r.value) : null,

      // sequenceNo already number ✅

      mboVariables: r.mboVariables.map((m) => ({
        ...m,

        // ✅ FIX BigInt
        id: m.id.toString(),
        writingVariableId: m.writingVariableId.toString(),

        // ✅ FIX Decimal
        value: m.value !== null ? Number(m.value) : 0,
      })),
    }));

    return plainToInstance(WritingVariableResponseDto, cleaned);
  }

  async deleteAllWritingVariables(globalConfigId: number) {
    const result = await this.prisma.writingVariable.deleteMany({
      where: {
        globalConfigId: BigInt(globalConfigId),
      },
    });

    return new ActionResponseDto({
      success: true,
      message: `Deleted ${result.count} writing variables`,
      count: result.count,
    });
  }

  async findAllMboByWritingVariable(writingVariableId: number): Promise<WritingVariableMboResponseDto[]> {
    const records = await this.prisma.writingVariableMbo.findMany({
      where: { writingVariableId: BigInt(writingVariableId) },
      orderBy: { sequenceNo: 'asc' },
    });
    return plainToInstance(WritingVariableMboResponseDto, records, { excludeExtraneousValues: true });
  }

  async updateMboVariable(data: UpdateWritingVariableMboDto) {
    const updateData: {
      name?: string;
      value?: number | string;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.value !== undefined) updateData.value = data.value;

    const updated = await this.prisma.writingVariableMbo.update({
      where: { id: BigInt(data.id) },
      data: updateData,
      include: { writingVariable: true },
    });

    if (data.value !== undefined) {
      const allMbos = await this.prisma.writingVariableMbo.findMany({
        where: { writingVariableId: updated.writingVariableId },
        orderBy: { sequenceNo: 'asc' },
      });

      // If a bit (MBO) is updated, we recalculate the parent variable's 
      // decimal value by combining all bits in sequence order.
      // e.g. [1,0,1,0,0,0,0,0] -> 160
      const binaryStr = allMbos.map((m) => m.value?.toString() || '0').join('');

      // Use parseInt with base 2 to correctly convert binary string back to number
      const decimalValue = parseInt(binaryStr, 2);

      // Update parent variable using the existing variable info
      await this.performWritingVariableUpdate(updated.writingVariable, {
        id: Number(updated.writingVariableId),
        value: decimalValue,
      });
    }

    return plainToInstance(WritingVariableMboResponseDto, updated, { excludeExtraneousValues: true });
  }

  async updateWritingVariable(data: UpdateWritingVariableDto) {
    // Fetch existing variable info to perform update efficiently
    const variable = await this.prisma.writingVariable.findUnique({
      where: { id: BigInt(data.id) },
    });

    if (!variable) return null;
    return this.performWritingVariableUpdate(variable, data);
  }

  private async performWritingVariableUpdate(
    variable: WritingVariableModel,
    data: UpdateWritingVariableDto,
  ) {
    const updateData: {
      value?: number | string;
      rawValue?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (data.value !== undefined) updateData.value = data.value;
    if (data.rawValue !== undefined)
      updateData.rawValue = String(data.rawValue);

    if (data.value !== undefined) {
      let alterFlag = this.globalConfigCache.get(
        Number(variable.globalConfigId),
      );

      if (alterFlag === undefined) {
        const globalConfig = (await this.globalConfigService.findOne(
          Number(variable.globalConfigId),
        )) as { alterFlag: boolean } | null;
        alterFlag = globalConfig?.alterFlag ?? false;
        this.globalConfigCache.set(Number(variable.globalConfigId), alterFlag);
      }

      let rawValue: string | null =
        data.value !== null ? String(data.value) : null;

      if (alterFlag && variable.functionName) {
        const calculated = this.calculateRawValue(
          Number(data.value),
          variable.functionName,
        );
        if (calculated !== null) {
          rawValue = calculated;
        }
      }
      updateData.rawValue = rawValue;
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const updatedResult = await tx.writingVariable.update({
          where: { id: variable.id },
          data: updateData,
        });

        if (updatedResult.hasMbo && data.value !== undefined) {
          if (
            updatedResult.functionName === 'BYTE' ||
            updatedResult.functionName === 'BYTE_SWAP'
          ) {
            // Ensure we always have 8 bits for consistency
            const binaryStr = Number(data.value).toString(2).padStart(8, '0');
            const bits = binaryStr.slice(-8).split('').map(Number); // Take only last 8 bits

            // Update bits sequentially in transaction
            for (let i = 0; i < bits.length; i++) {
              await tx.writingVariableMbo.updateMany({
                where: {
                  writingVariableId: updatedResult.id,
                  sequenceNo: (updatedResult.sequenceNo || 0) + i,
                },
                data: { value: bits[i], updatedAt: new Date() },
              });
            }
          } else {
            await tx.writingVariableMbo.updateMany({
              where: { writingVariableId: updatedResult.id },
              data: { value: data.value, updatedAt: new Date() },
            });
          }
        }

        return updatedResult;
      },
      {
        timeout: 10000, // Increase timeout to 10s to avoid "Transaction not found" under load
      },
    );

    this.clearCache(Number(variable.globalConfigId));
    return plainToInstance(WritingVariableResponseDto, result, { excludeExtraneousValues: true });
  }

  private calculateRawValue(
    value: number,
    functionName: string,
  ): string | null {
    const handler = DerivedFunctionHandlers[functionName];
    if (handler) {
      try {
        // Special handling for BYTE functions which expect binary string input in current handlers
        const input =
          functionName === 'BYTE' || functionName === 'BYTE_SWAP'
            ? [Number(value).toString(2).padStart(8, '0')]
            : [value];

        const result = handler(input);
        if (typeof result === 'string') return result;
        return Array.isArray(result) ? JSON.stringify(result) : String(result);
      } catch (err: unknown) {
        const error = err as Error;
        this.logger.error(
          `Error calculating rawValue for function ${functionName}: ${error.message}`,
        );
      }
    }
    return null;
  }
}
