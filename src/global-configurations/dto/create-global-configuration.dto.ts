import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum DataSourceType {
  MQTT = 'MQTT',
  SOCKET = 'SOCKET',
}

export enum TopicType {

  SUBSCRIBE = 'SUBSCRIBE',
  PUBLISH = 'PUBLISH',
}

export class CreateDataSourceTopicDto {
  @ApiProperty({
    description: 'The MQTT topic string or Socket.IO event name',
    example: 'iot/sensors/data',
  })
  @IsString()
  topic: string;

  @ApiProperty({
    enum: TopicType,
    description: 'The type of topic (SUBSCRIBE or PUBLISH)',
    example: 'SUBSCRIBE',
  })
  @IsEnum(TopicType)
  type: TopicType;

  // Metadata fields (ignored in create but whitelisted for validation)
  @ApiProperty({ required: false })
  @IsOptional()
  id?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  configId?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  createdAt?: any;
}

export class CreateDataSourceConfigurationDto {
  @ApiProperty({
    enum: DataSourceType,
    description: 'The type of data source (MQTT or SOCKET)',
    example: 'MQTT',
  })
  @IsEnum(DataSourceType)
  type: DataSourceType;

  @ApiProperty({
    required: false,
    description: 'MQTT broker address OR Socket server URL',
    example: 'broker.hivemq.com',
  })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiProperty({
    required: false,
    description: 'Port number for the connection',
    example: 1883,
  })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiProperty({
    required: false,
    description: 'Protocol to use (e.g., mqtt, mqtts, ws, wss)',
    example: 'mqtt',
  })
  @IsOptional()
  @IsString()
  protocol?: string;

  @ApiProperty({
    required: false,
    description: 'Username for authentication',
    example: 'user123',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({
    required: false,
    description: 'Password for authentication',
    example: 'pass123',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({
    required: false,
    description: 'Path to CA certificate file',
  })
  @IsOptional()
  @IsString()
  caPath?: string;

  @ApiProperty({
    required: false,
    description: 'Path to client certificate file',
  })
  @IsOptional()
  @IsString()
  certPath?: string;

  @ApiProperty({
    required: false,
    description: 'Path to client private key file',
  })
  @IsOptional()
  @IsString()
  keyPath?: string;

  @ApiProperty({
    required: false,
    description: 'Base64 or PEM content of CA certificate (saved to disk, path stored in caPath)',
  })
  @IsOptional()
  @IsString()
  caContent?: string;

  @ApiProperty({
    required: false,
    description: 'Base64 or PEM content of client certificate (saved to disk, path stored in certPath)',
  })
  @IsOptional()
  @IsString()
  certContent?: string;

  @ApiProperty({
    required: false,
    description: 'Base64 or PEM content of client private key (saved to disk, path stored in keyPath)',
  })
  @IsOptional()
  @IsString()
  keyContent?: string;

  @ApiProperty({ required: false, description: 'Alias for caContent' })
  @IsOptional()
  @IsString()
  serverCertificate?: string;

  @ApiProperty({ required: false, description: 'Alias for certContent' })
  @IsOptional()
  @IsString()
  clientCertificate?: string;

  @ApiProperty({ required: false, description: 'Alias for keyContent' })
  @IsOptional()
  @IsString()
  clientKey?: string;

  @ApiProperty({
    required: false,
    default: 0,
    description: 'MQTT Quality of Service level (0, 1, or 2)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  qos?: number;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Whether MQTT messages should be retained by the broker',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  retain?: boolean;

  @ApiProperty({
    type: [CreateDataSourceTopicDto],
    description: 'List of topics to subscribe or publish to',
    required: false,
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateDataSourceTopicDto)
  topics?: CreateDataSourceTopicDto[];

  @ApiProperty({
    required: false,
    default: true,
    description: 'Whether this data source configuration is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Legacy fields (ignored in service but kept here to prevent validation errors)
  @ApiProperty({ required: false, description: 'Legacy: Subscribe topic (use topics array instead)' })
  @IsOptional()
  @IsString()
  subscribeTopic?: string;

  @ApiProperty({ required: false, description: 'Legacy: Publish topic (use topics array instead)' })
  @IsOptional()
  @IsString()
  publishTopic?: string;

  @ApiProperty({ required: false, description: 'Legacy: Subscribe topics array' })
  @IsOptional()
  @IsString({ each: true })
  subscribeTopics?: string[];

  @ApiProperty({ required: false, description: 'Legacy: Publish topics array' })
  @IsOptional()
  @IsString({ each: true })
  publishTopics?: string[];

  @ApiProperty({ required: false, description: 'Legacy: Socket.io namespace' })
  @IsOptional()
  @IsString()
  namespace?: string;

  @ApiProperty({ required: false, description: 'Legacy: Socket.io event name' })
  @IsOptional()
  @IsString()
  event?: string;
}


export class CreateGlobalConfigurationDto {
  @ApiProperty({
    description: 'Optional ID for preservation during restore',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    description: 'Unique name for the global configuration',
    example: 'Factory Floor 1 Config',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Detailed description of what this configuration covers',
    example: 'Monitoring and control for the heating elements in zone 1',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Whether to apply derived functions to the incoming or outgoing values',
    example: true,
  })
  @IsBoolean()
  alterFlag: boolean;

  @ApiProperty({
    description: 'General active status for this entire configuration set',
    example: true,
  })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'Maximum number of reading variables allowed for this configuration',
    example: 64,
  })
  @IsNumber()
  maxReadingVariables: number;

  @ApiProperty({
    description: 'Maximum number of writing variables allowed for this configuration',
    example: 32,
  })
  @IsNumber()
  maxWritingVariables: number;

  @ApiProperty({
    type: CreateDataSourceConfigurationDto,
    required: false,
    description: 'Embedded data source settings (MQTT/Socket)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDataSourceConfigurationDto)
  dataSourceConfig?: CreateDataSourceConfigurationDto;
}
