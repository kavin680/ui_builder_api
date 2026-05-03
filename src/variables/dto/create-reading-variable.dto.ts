import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DerivedFunction } from '../../const/function-registry';

import { HistoryType } from '@prisma/client';

export class CreateReadingVariableDto {
  @ApiProperty({
    example: '1',
    description: 'ID of the variable (for updates)',
    required: false,
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 1, description: 'ID of the global configuration' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  globalConfigId: number;

  @ApiProperty({ example: 'Temperature', description: 'Name of the variable' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: null,
    description: 'Value of the variable (string or number)',
    required: false,
  })
  @IsOptional()
  value?: string | number;

  @ApiProperty({
    example: 1,
    description: 'Sequence number of the variable',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sequenceNo?: number;

  @ApiProperty({
    example: true,
    description: 'Whether the variable is active',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: 'SUM',
    required: false,
    enum: DerivedFunction,
    description:
      'Function name for derived variables',
  })
  @IsOptional()
  @IsEnum(DerivedFunction)
  functionName?: DerivedFunction;

  @ApiProperty({
    example: 0,
    required: false,
    description: 'Start index in input array for derived calculation',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  startIndex?: number;

  @ApiProperty({
    example: HistoryType.NONE,
    required: false,
    enum: HistoryType,
    description: 'Type of historical logging',
  })
  @IsOptional()
  @IsEnum(HistoryType)
  historyType?: HistoryType;

  @ApiProperty({
    example: 60,
    required: false,
    description: 'Interval for historical logging (seconds) for TIME/SCHEDULED types',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  loggingTime?: number;
}
