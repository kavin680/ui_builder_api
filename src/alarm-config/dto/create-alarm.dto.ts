import {
  IsEnum,
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AlarmCondition {
  GT = '>',
  LT = '<',
  GTE = '>=',
  LTE = '<=',
  EQ = '==',
  NEQ = '!=',
}

export enum AlarmPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class CreateAlarmDto {
  @ApiProperty({
    example: 1,
    description: 'Optional ID for preservation',
    required: false,
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    example: 1,
    description: 'Reference to the reading variable ID this alarm monitors',
  })
  @IsNumber()
  readingVariableId: number;

  @ApiProperty({
    example: 'High Temperature Alarm',
    description: 'User-friendly name for this alarm configuration',
  })
  @IsString()
  name: string;

  @ApiProperty({
    enum: AlarmCondition,
    description: 'The mathematical condition to evaluate (>, <, >=, <=, ==, !=)',
    example: '>',
  })
  @IsEnum(AlarmCondition)
  conditionType: AlarmCondition;

  @ApiProperty({
    example: 100.5,
    description: 'Numerical threshold value that triggers the alarm based on the condition',
  })
  @IsNumber()
  thresholdValue: number;

  @ApiProperty({
    enum: AlarmPriority,
    default: 'HIGH',
    description: 'The severity level of the alarm',
    example: 'HIGH',
  })
  @IsEnum(AlarmPriority)
  @IsOptional()
  priority?: AlarmPriority;

  @ApiProperty({
    example: true,
    default: true,
    description: 'Whether this alarm configuration is currently active',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
