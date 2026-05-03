import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ConsumptionPeriodDto {
  @ApiProperty({ example: '2026-04-22' })
  @Expose()
  period: string;

  @ApiProperty({ example: 45.5 })
  @Expose()
  consumption: number;
}

export class ConsumptionSummaryPointDto {
  @ApiProperty({ example: '2026-04-21' })
  @Expose()
  period: string;

  @ApiProperty({ example: 100.0 })
  @Expose()
  value: number;
}

export class ConsumptionSummaryDto {
  @ApiProperty({ type: ConsumptionSummaryPointDto, required: false })
  @Expose()
  @Type(() => ConsumptionSummaryPointDto)
  highest: ConsumptionSummaryPointDto | null;

  @ApiProperty({ type: ConsumptionSummaryPointDto, required: false })
  @Expose()
  @Type(() => ConsumptionSummaryPointDto)
  lowest: ConsumptionSummaryPointDto | null;

  @ApiProperty({ example: 50.25 })
  @Expose()
  average: number;
}

export class ConsumptionMetaDto {
  @ApiProperty({ example: 'day' })
  @Expose()
  type: string;

  @ApiProperty({ example: 7 })
  @Expose()
  count: number;
}

export class ConsumptionDataDto {
  @ApiProperty({ type: [ConsumptionPeriodDto] })
  @Expose()
  @Type(() => ConsumptionPeriodDto)
  list: ConsumptionPeriodDto[];

  @ApiProperty({ type: ConsumptionSummaryDto })
  @Expose()
  @Type(() => ConsumptionSummaryDto)
  summary: ConsumptionSummaryDto;

  @ApiProperty({ type: ConsumptionMetaDto })
  @Expose()
  @Type(() => ConsumptionMetaDto)
  meta: ConsumptionMetaDto;
}

export class ConsumptionResponseDto {
  @ApiProperty({ type: ConsumptionDataDto })
  @Expose()
  @Type(() => ConsumptionDataDto)
  data: ConsumptionDataDto;

  constructor(partial: Partial<ConsumptionResponseDto>) {
    Object.assign(this, partial);
  }
}
