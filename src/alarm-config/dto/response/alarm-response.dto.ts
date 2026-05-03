import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { AlarmCondition, AlarmPriority } from '@prisma/client';

export class AlarmStatusResponseDto {
  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ example: false })
  @Expose()
  isAcknowledged: boolean;

  @ApiProperty({ example: '2026-04-22T10:00:00.000Z', required: false })
  @Expose()
  activeSince: Date | null;

  @ApiProperty({ example: '2026-04-22T10:05:00.000Z', required: false })
  @Expose()
  acknowledgedAt: Date | null;

  @ApiProperty({ example: null, required: false })
  @Expose()
  clearedAt: Date | null;

  constructor(partial: Partial<AlarmStatusResponseDto>) {
    Object.assign(this, partial);
  }
}

export class AlarmResponseDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => (value !== null && value !== undefined ? value.toString() : null))
  id: string;

  @ApiProperty({ example: '10' })
  @Expose()
  @Transform(({ value }) => (value !== null && value !== undefined ? value.toString() : null))
  readingVariableId: string;

  @ApiProperty({ example: 'High Temperature' })
  @Expose()
  name: string;

  @ApiProperty({ enum: AlarmCondition, example: AlarmCondition.GT })
  @Expose()
  conditionType: AlarmCondition;

  @ApiProperty({ example: 80.0 })
  @Expose()
  @Transform(({ value }) => (value !== null && value !== undefined ? Number(value) : null))
  thresholdValue: number;

  @ApiProperty({ enum: AlarmPriority, example: AlarmPriority.HIGH })
  @Expose()
  priority: AlarmPriority;

  @ApiProperty({ example: true })
  @Expose()
  isEnabled: boolean;

  @ApiProperty({ type: AlarmStatusResponseDto, required: false })
  @Expose()
  @Type(() => AlarmStatusResponseDto)
  status?: AlarmStatusResponseDto;

  constructor(partial: Partial<AlarmResponseDto>) {
    Object.assign(this, partial);
  }
}

export class AlarmHistoryRecordDto {
  @ApiProperty({ example: '1' })
  @Expose()
  id: string;

  @ApiProperty({ example: '1' })
  @Expose()
  alarmId: string;

  @ApiProperty({ example: '10' })
  @Expose()
  variableId: string;

  @ApiProperty({ example: 'I' })
  @Expose()
  type: string;

  @ApiProperty({ example: 'High Temperature' })
  @Expose()
  name: string;

  @ApiProperty({ example: '85.5' })
  @Expose()
  value: string;

  @ApiProperty({ example: '2026-04-22' })
  @Expose()
  date: string;

  @ApiProperty({ example: '10:00:00' })
  @Expose()
  time: string;

  constructor(partial: Partial<AlarmHistoryRecordDto>) {
    Object.assign(this, partial);
  }
}

export class PaginatedAlarmHistoryResponseDto {
  @ApiProperty({ example: 100 })
  @Expose()
  total: number;

  @ApiProperty({ example: 1 })
  @Expose()
  page: number;

  @ApiProperty({ example: 20 })
  @Expose()
  limit: number;

  @ApiProperty({ example: 5 })
  @Expose()
  totalPages: number;

  @ApiProperty({ type: [AlarmHistoryRecordDto] })
  @Expose()
  @Type(() => AlarmHistoryRecordDto)
  records: AlarmHistoryRecordDto[];

  constructor(partial: Partial<PaginatedAlarmHistoryResponseDto>) {
    Object.assign(this, partial);
  }
}
