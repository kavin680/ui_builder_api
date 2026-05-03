import { IsOptional, IsInt, IsString, Min, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AlarmHistoryQueryDto {
  @ApiProperty({
    required: false,
    description: 'Start date for filtering history (ISO 8601 string or numeric timestamp)',
    example: '2026-03-01T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiProperty({
    required: false,
    description: 'End date for filtering history (ISO 8601 string or numeric timestamp)',
    example: '2026-03-11T23:59:59Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiProperty({
    required: false,
    default: 1,
    description: 'Page number for pagination',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    required: false,
    default: 20,
    description: 'Number of records per page',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    required: false,
    description: 'Filter history by specific alarm configuration ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  alarmId?: number;

  @ApiProperty({
    required: false,
    description: 'Filter history by alarm name (LIKE search)',
    example: 'Temperature',
  })
  @IsOptional()
  @IsString()
  alarmName?: string;
}
