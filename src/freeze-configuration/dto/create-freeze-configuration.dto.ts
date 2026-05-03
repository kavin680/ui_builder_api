import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FreezeTimeWindowDto {
  @ApiProperty({ example: 1, description: 'Optional ID', required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    example: 1,
    description: 'Day of week (0=Sunday ... 6=Saturday)',
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  dayOfWeek: number;

  @ApiProperty({
    example: '08:00',
    description: 'Start time (HH:mm or HH:mm:ss)',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, {
    message: 'startTime must be in HH:mm or HH:mm:ss format',
  })
  startTime: string;

  @ApiProperty({
    example: '18:00',
    description: 'End time (HH:mm or HH:mm:ss)',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, {
    message: 'endTime must be in HH:mm or HH:mm:ss format',
  })
  endTime: string;
}

export class WritingVariableFreezeDto {
  @ApiProperty({ example: 1, description: 'Optional ID', required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 1, description: 'Writing Variable ID' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  writingVariableId: number;

  @ApiProperty({
    example: 1,
    description: 'Optional MBO Variable ID',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  mboVariableId?: number;

  @ApiProperty({
    example: 10.5,
    description: 'Value to set on freeze start',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  valueOnStart?: number;

  @ApiProperty({
    example: 0,
    description: 'Value to set on freeze end',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  valueOnEnd?: number;
}

export class CreateFreezeConfigurationDto {
  @ApiProperty({ example: 1, description: 'Optional ID', required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    example: 'Night Shift Freeze',
    description: 'Configuration name',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 1, description: 'Global Configuration ID' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  globalConfigId: number;

  @ApiProperty({ example: true, description: 'Is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [FreezeTimeWindowDto], description: 'Time windows' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FreezeTimeWindowDto)
  timeWindows: FreezeTimeWindowDto[];

  @ApiProperty({
    type: [WritingVariableFreezeDto],
    description: 'Variables to freeze',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WritingVariableFreezeDto)
  variables: WritingVariableFreezeDto[];
}
