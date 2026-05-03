import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ConsumptionType {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class GetConsumptionDto {
  @ApiProperty({ description: 'Internal database ID of the reading variable' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  variableId: number;

  @ApiProperty({ enum: ConsumptionType, description: 'Time interval for consumption calculation' })
  @IsNotEmpty()
  @IsEnum(ConsumptionType)
  type: ConsumptionType;

  @ApiProperty({ description: 'Number of intervals to retrieve' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count: number;
}
