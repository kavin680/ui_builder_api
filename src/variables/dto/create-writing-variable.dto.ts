import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DerivedFunction } from '../../const/function-registry';

export class CreateWritingVariableDto {
  @ApiProperty({
    example: '1',
    description:
      'Unique identifier for the writing variable (used for idempotent creation/updates)',
    required: false,
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    example: 1,
    description:
      'Reference to the Global Configuration ID this variable belongs to',
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  globalConfigId: number;

  @ApiProperty({ example: 'PumpStatus', description: 'Name of the variable' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 0,
    description:
      'Sequence number for ordering variables within a configuration',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  sequenceNo?: number;

  @ApiProperty({
    example: 25.5,
    required: false,
    description: 'Initial value of the variable',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'object' && value !== null) {
      // convert Decimal-like object to number
      return Number(value?.d?.join('') ?? 0);
    }
    return Number(value);
  })
  @IsNumber()
  value?: number;

  @ApiProperty({
    example: ['1', '0', '1', '1'],
    required: false,
    description: 'Raw bit array for MBO/Byte operations (array of strings)',
    type: [String],
  })
  @IsOptional()
  rawValue?: string[];

  @ApiProperty({
    example: 'BYTE',
    required: false,
    enum: DerivedFunction,
    description: 'Function name for variable transformations',
  })
  @IsOptional()
  @IsEnum(DerivedFunction)
  functionName?: DerivedFunction;

  @ApiProperty({
    example: true,
    description: 'Whether the variable is active and should be processed',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    example: false,
    description:
      'MBO generation flag (deprecated, triggers on "byte" function)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  hasMbo?: boolean;

  @ApiProperty({
    example: 0,
    description: 'Start index for MBO/Byte operations',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  startIndex?: number;

  @ApiProperty({
    description: 'Nested MBO variables for restoration',
    required: false,
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  mboVariables?: any[];
}
