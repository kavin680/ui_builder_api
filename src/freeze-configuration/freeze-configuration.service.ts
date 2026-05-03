import { Injectable } from '@nestjs/common';
import { CreateFreezeConfigurationDto } from './dto/create-freeze-configuration.dto';
import { UpdateFreezeConfigurationDto } from './dto/update-freeze-configuration.dto';
import { PrismaService } from '../prisma/prisma.service';
import { calculateNextRun } from '../common/utils/time-calculation.util';
import { FreezeSchedulerService } from '../scheduler/freeze-scheduler.service';
import { plainToInstance } from 'class-transformer';
import { FreezeConfigResponseDto } from './dto/response/freeze-config-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

@Injectable()
export class FreezeConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly freezeSchedulerService: FreezeSchedulerService,
  ) { }

  async create(createDto: CreateFreezeConfigurationDto, txClient?: any) {
    const { name, isActive, timeWindows, variables, globalConfigId } =
      createDto;
    const prisma = txClient || this.prisma;

    const created = await prisma.freezeConfiguration.create({
      data: {
        id: createDto.id ? BigInt(createDto.id) : undefined,
        name,
        globalConfigId: BigInt(globalConfigId),
        isActive: isActive ?? true,
        // Relations
        timeWindows: {
          create: timeWindows.map((tw) => ({
            id: tw.id ? BigInt(tw.id) : undefined,
            dayOfWeek: tw.dayOfWeek,
            startTime: this.parseTime(tw.startTime),
            endTime: this.parseTime(tw.endTime),
          })),
        },
        variables: {
          create: variables.map((v) => {
            const parsedWindows = timeWindows.map((tw) => ({
              dayOfWeek: tw.dayOfWeek,
              startTime: this.parseTime(tw.startTime),
              endTime: this.parseTime(tw.endTime),
            }));
            const nextStart = calculateNextRun(parsedWindows, 'start');
            const nextEnd = calculateNextRun(parsedWindows, 'end');

            return {
              id: v.id ? BigInt(v.id) : undefined,
              writingVariableId: BigInt(v.writingVariableId),
              mboVariableId: v.mboVariableId ? BigInt(v.mboVariableId) : null,
              valueOnStart: v.valueOnStart,
              valueOnEnd: v.valueOnEnd,
              nextStartRunAt: nextStart,
              nextEndRunAt: nextEnd,
            };
          }),
        },
      },
      include: {
        timeWindows: true,
        variables: { include: { writingVariable: true, mbo: true } },
      },
    });

    if (!txClient) {
      // Sync each mapping to the scheduler
      for (const variable of created.variables) {
        await this.freezeSchedulerService.syncMapping(Number(variable.id));
      }
    }

    return plainToInstance(FreezeConfigResponseDto, created);
  }

  async findAll(): Promise<FreezeConfigResponseDto[]> {
    const result = await this.prisma.freezeConfiguration.findMany({
      include: {
        timeWindows: true,
        variables: { include: { writingVariable: true, mbo: true } },
      },
      orderBy: { id: 'desc' },
    });
    return plainToInstance(FreezeConfigResponseDto, result);
  }

  async findByGlobalConfigId(globalConfigId: number): Promise<FreezeConfigResponseDto[]> {
    const result = await this.prisma.freezeConfiguration.findMany({
      where: { globalConfigId: BigInt(globalConfigId) },
      include: {
        timeWindows: true,
        variables: { include: { writingVariable: true, mbo: true } },
      },
      orderBy: { id: 'desc' },
    });
    return plainToInstance(FreezeConfigResponseDto, result);
  }

  async findOne(id: number): Promise<FreezeConfigResponseDto | null> {
    const result = await this.prisma.freezeConfiguration.findUniqueOrThrow({
      where: { id: BigInt(id) },
      include: {
        timeWindows: true,
        variables: { include: { writingVariable: true, mbo: true } },
      },
    });
    return plainToInstance(FreezeConfigResponseDto, result);
  }

  async update(id: number, updateDto: UpdateFreezeConfigurationDto) {
    const updateData: any = {};
    if (updateDto.name) updateData.name = updateDto.name;
    if (updateDto.globalConfigId)
      updateData.globalConfigId = BigInt(updateDto.globalConfigId);
    if (updateDto.isActive !== undefined)
      updateData.isActive = updateDto.isActive;

    const nestedData: any = { ...updateData };

    if (updateDto.timeWindows) {
      nestedData.timeWindows = {
        deleteMany: {}, // Delete all existing
        create: updateDto.timeWindows.map((tw) => ({
          dayOfWeek: tw.dayOfWeek,
          startTime: this.parseTime(tw.startTime),
          endTime: this.parseTime(tw.endTime),
        })),
      };
    }

    if (updateDto.variables) {
      // Deduplicate by writingVariableId
      const uniqueVars = new Map();
      updateDto.variables.forEach((v) => {
        const key = `${v.writingVariableId}_${v.mboVariableId || 'main'}`;
        if (!uniqueVars.has(key))
          uniqueVars.set(key, v);
      });

      const parsedWindows = (updateDto.timeWindows || []).map((tw) => ({
        dayOfWeek: tw.dayOfWeek,
        startTime: this.parseTime(tw.startTime),
        endTime: this.parseTime(tw.endTime),
      }));

      nestedData.variables = {
        deleteMany: {},
        create: Array.from(uniqueVars.values()).map((v: any) => ({
          writingVariableId: BigInt(v.writingVariableId),
          mboVariableId: v.mboVariableId ? BigInt(v.mboVariableId) : null,
          valueOnStart: v.valueOnStart,
          valueOnEnd: v.valueOnEnd,
          nextStartRunAt:
            parsedWindows.length > 0
              ? calculateNextRun(parsedWindows, 'start')
              : null,
          nextEndRunAt:
            parsedWindows.length > 0
              ? calculateNextRun(parsedWindows, 'end')
              : null,
        })),
      };
    }

    const updated = await this.prisma.freezeConfiguration.update({
      where: { id: BigInt(id) },
      data: nestedData,
      include: {
        timeWindows: true,
        variables: { include: { writingVariable: true, mbo: true } },
      },
    });
    // Resync all mappings for this config
    for (const variable of updated.variables) {
      await this.freezeSchedulerService.syncMapping(Number(variable.id));
    }

    return plainToInstance(FreezeConfigResponseDto, updated);
  }

  async remove(id: number) {
    const deleted = await this.prisma.freezeConfiguration.delete({
      where: { id: BigInt(id) },
      include: {
        timeWindows: true,
        variables: { include: { writingVariable: true, mbo: true } },
      },
    });
    // Unsync all mappings for the deleted config
    for (const variable of deleted.variables) {
      await this.freezeSchedulerService.unsyncMapping(Number(variable.id));
    }

    return new ActionResponseDto({
      success: true,
      message: `Deleted freeze configuration ${id}`,
      id: id.toString(),
      count: 1,
    });
  }

  private parseTime(timeStr: string): Date {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    // Use UTC to store the "nominal" time exactly as entered, 
    // ensuring timezone-independent extraction via getUTCHours/Minutes.
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds || 0, 0));
  }

}
