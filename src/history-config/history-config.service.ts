import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateHistoryConfigDto } from './dto/update-history-config.dto';
import { HistoryType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { HistoryConfigResponseDto } from './dto/response/history-config-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

@Injectable()
export class HistoryConfigService {
  constructor(private readonly prisma: PrismaService) { }

  async update(id: number, dto: UpdateHistoryConfigDto): Promise<HistoryConfigResponseDto> {
    const data: any = {};
    if (dto.historyType !== undefined) {
      data.historyType = dto.historyType;
      if (dto.historyType !== HistoryType.SCHEDULED && dto.historyType !== HistoryType.UTILITY) {
        data.loggingTime = null;
      }
    }

    if (dto.loggingTime !== undefined) {
      if (
        data.historyType === undefined ||
        data.historyType === HistoryType.SCHEDULED || data.historyType === HistoryType.UTILITY
      ) {
        data.loggingTime = dto.loggingTime;
      }
    }

    try {
      const updated = await this.prisma.readingVariable.update({
        where: { id: BigInt(id) },
        data,
      });
      return this.mapToResponse(updated);
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`History configuration for variable ${id} not found`);
      }
      throw error;
    }
  }

  private mapToResponse(v: any): HistoryConfigResponseDto {
    return plainToInstance(HistoryConfigResponseDto, v, {
      excludeExtraneousValues: true,
    });
  }

  async remove(id: number): Promise<ActionResponseDto> {
    try {
      await this.prisma.readingVariable.update({
        where: { id: BigInt(id) },
        data: { historyType: HistoryType.NONE, loggingTime: null },
      });
      return new ActionResponseDto({
        success: true,
        message: `History configuration for variable ${id} removed`,
        id: id.toString(),
        count: 1,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`History configuration for variable ${id} not found`);
      }
      throw error;
    }
  }
}
