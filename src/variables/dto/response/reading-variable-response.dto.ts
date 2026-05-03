import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { HistoryType } from '@prisma/client';

export class ReadingVariableResponseDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => (value !== null && value !== undefined ? value.toString() : null))
  id: string;

  @ApiProperty({ example: '10' })
  @Expose()
  @Transform(({ value }) => (value !== null && value !== undefined ? value.toString() : null))
  globalConfigId: string;

  @ApiProperty({ example: 'Temperature' })
  @Expose()
  name: string;

  @ApiProperty({ example: 1 })
  @Expose()
  sequenceNo: number;

  @ApiProperty({ example: '23.5', required: false })
  @Expose()
  value: string | null;

  @ApiProperty({ example: 'floatABCD', required: false })
  @Expose()
  functionName: string | null;

  @ApiProperty({ example: 0, required: false })
  @Expose()
  startIndex: number | null;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ enum: HistoryType, example: HistoryType.INSTANT })
  @Expose()
  historyType: HistoryType;

  @ApiProperty({ example: 60, required: false })
  @Expose()
  loggingTime: number | null;

  @ApiProperty({ example: '2026-04-22T10:00:00.000Z', required: false })
  @Expose()
  lastRunAt: Date | null;

  @ApiProperty({ example: '2026-04-22T10:05:00.000Z', required: false })
  @Expose()
  next_run_at: Date | null;

  constructor(partial: Partial<ReadingVariableResponseDto>) {
    Object.assign(this, partial);
  }
}
