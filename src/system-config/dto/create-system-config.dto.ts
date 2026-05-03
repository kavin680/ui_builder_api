import {
  IsArray,
  ArrayNotEmpty,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum DataSourceType {
  MQTT = 'MQTT',
  SOCKET = 'SOCKET',
}

export enum HistoryType {
  NONE = 'NONE',
  INSTANT = 'INSTANT',
  ON_CHANGE = 'ON_CHANGE',
  SCHEDULED = 'SCHEDULED',
}

export enum AlarmCondition {
  GT = 'GT',
  LT = 'LT',
  GTE = 'GTE',
  LTE = 'LTE',
  EQ = 'EQ',
  NEQ = 'NEQ',
}

export enum AlarmPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TopicType {
  SUBSCRIBE = 'SUBSCRIBE',
  PUBLISH = 'PUBLISH',
}

export class DataSourceTopicDto {
  @IsString()
  topic: string;

  @IsEnum(TopicType)
  @ApiProperty({ enum: TopicType })
  type: TopicType;
}

export class DataSourceConfigDto {
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'MQTT', enum: DataSourceType })
  @IsEnum(DataSourceType)
  type: DataSourceType;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  port?: number;

  @IsOptional()
  @IsString()
  protocol?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  caPath?: string;

  @IsOptional()
  @IsString()
  certPath?: string;

  @IsOptional()
  @IsString()
  keyPath?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  qos?: number;

  @IsOptional()
  @IsBoolean()
  retain?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DataSourceTopicDto)
  topics?: DataSourceTopicDto[];
}


export class AlarmDto {
  @ApiProperty({ example: '1', required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'High Temp' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'GT', enum: AlarmCondition })
  @IsEnum(AlarmCondition)
  conditionType: AlarmCondition;

  @ApiProperty({ example: 85 })
  @IsNumber()
  @Type(() => Number)
  thresholdValue: number;

  @ApiProperty({ example: 'HIGH', enum: AlarmPriority, required: false })
  @IsOptional()
  @IsEnum(AlarmPriority)
  priority?: AlarmPriority;

  @ApiProperty({ example: true })
  @IsBoolean()
  isEnabled: boolean;
}

export class ReadingVariableDto {
  @ApiProperty({ example: '1', required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: '1', required: false })
  @IsOptional()
  @IsString()
  globalConfigId?: string;

  @ApiProperty({ example: 'Temp_Sensor_01' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Type(() => Number)
  sequenceNo: number;

  @ApiProperty({ example: '23.5', required: false })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiProperty({ example: 'floatABCD', required: false })
  @IsOptional()
  @IsString()
  functionName?: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  startIndex?: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ example: 'INSTANT', enum: HistoryType, required: false })
  @IsOptional()
  @IsEnum(HistoryType)
  historyType?: HistoryType;

  @ApiProperty({ example: 5, required: false, description: 'Logging interval in seconds' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  loggingTime?: number;

  @ApiProperty({ example: '2026-03-27T12:00:00Z', required: false })
  @IsOptional()
  @IsString()
  lastRunAt?: string;

  @ApiProperty({ example: '2026-03-27T12:05:00Z', required: false })
  @IsOptional()
  @IsString()
  next_run_at?: string;

  @ApiProperty({ type: [AlarmDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlarmDto)
  alarms?: AlarmDto[];
}

export class WritingVariableMboDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  value?: number;

  @IsNumber()
  @Type(() => Number)
  sequenceNo: number;
}

export class WritingVariableDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  globalConfigId?: string;

  @IsString()
  name: string;

  @IsNumber()
  @Type(() => Number)
  sequenceNo: number;

  @IsOptional()
  @IsString()
  functionName?: string;

  @IsBoolean()
  isActive: boolean;

  @IsOptional()
  @IsString()
  rawValue?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  value?: number | string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WritingVariableMboDto)
  mboVariables?: WritingVariableMboDto[];
}

export class FreezeTimeWindowDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  freezeConfigId?: string;

  @IsNumber()
  @Type(() => Number)
  dayOfWeek: number;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;
}

export class WritingVariableFreezeMapDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  writingVariableId: string; // Temporary ID from input

  @IsOptional()
  @IsString()
  freezeConfigId?: string;

  @IsOptional()
  @IsString()
  mboVariableId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  valueOnStart?: number | string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  valueOnEnd?: number | string;

  @IsOptional()
  @IsString()
  lastStartTriggeredAt?: string;

  @IsOptional()
  @IsString()
  lastEndTriggeredAt?: string;

  @IsOptional()
  @IsString()
  nextStartRunAt?: string;

  @IsOptional()
  @IsString()
  nextEndRunAt?: string;
}

export class FreezeConfigDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  globalConfigId?: string;

  @IsString()
  name: string;

  @IsBoolean()
  isActive: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FreezeTimeWindowDto)
  timeWindows: FreezeTimeWindowDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WritingVariableFreezeMapDto)
  variables: WritingVariableFreezeMapDto[];
}

export class GlobalConfigDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  maxReadingVariables: number;

  @IsNumber()
  @Type(() => Number)
  maxWritingVariables: number;

  @IsBoolean()
  alterFlag: boolean;

  @IsBoolean()
  isActive: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DataSourceConfigDto)
  dataSourceConfig?: DataSourceConfigDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReadingVariableDto)
  readingVariables: ReadingVariableDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WritingVariableDto)
  writingVariables: WritingVariableDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FreezeConfigDto)
  freezeConfigs: FreezeConfigDto[];
}

export class BackupDataDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => GlobalConfigDto)
  configs: GlobalConfigDto[];
}

export class CreateSystemConfigDto {
  @ApiProperty({ example: '1.0' })
  @IsString()
  version: string;

  @ApiProperty({ example: '2026-04-04T12:00:00Z', required: false })
  @IsOptional()
  @IsString()
  exportedAt?: string;

  @ApiProperty({ type: BackupDataDto })
  @ValidateNested()
  @Type(() => BackupDataDto)
  data: BackupDataDto;
}

