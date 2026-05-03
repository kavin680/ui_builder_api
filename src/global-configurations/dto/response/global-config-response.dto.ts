import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type, Exclude } from 'class-transformer';
import { DataSourceType } from '@prisma/client';

export enum TopicType {
  SUBSCRIBE = 'SUBSCRIBE',
  PUBLISH = 'PUBLISH',
}

export class DataSourceTopicResponseDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => value?.toString())
  id: string;

  @ApiProperty({ example: 'telemetry/sensors' })
  @Expose()
  topic: string;

  @ApiProperty({ enum: TopicType, example: TopicType.SUBSCRIBE })
  @Expose()
  type: TopicType;
}

export class DataSourceConfigResponseDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => value?.toString())
  id: string;

  @ApiProperty({ enum: DataSourceType, example: DataSourceType.MQTT })
  @Expose()
  type: DataSourceType;

  @ApiProperty({ example: 'localhost', required: false })
  @Expose()
  host: string | null;

  @ApiProperty({ example: 1883, required: false })
  @Expose()
  port: number | null;

  @ApiProperty({ example: 'mqtt', required: false })
  @Expose()
  protocol: string | null;

  @ApiProperty({ example: 'admin', required: false })
  @Expose()
  username: string | null;

  @Exclude()
  password?: string | null;

  @ApiProperty({ example: '/etc/certs/ca.pem', required: false })
  @Expose()
  caPath: string | null;

  @ApiProperty({ example: '/etc/certs/cert.pem', required: false })
  @Expose()
  certPath: string | null;

  @ApiProperty({ example: '/etc/certs/key.pem', required: false })
  @Expose()
  keyPath: string | null;

  @ApiProperty({ example: 0, required: false })
  @Expose()
  qos: number | null;

  @ApiProperty({ example: false, required: false })
  @Expose()
  retain: boolean | null;

  @ApiProperty({ required: false })
  @Expose()
  @Transform(({ obj }) => {
    if (!obj.topics) return null;
    const sub = obj.topics.find((t: any) => t.type === 'SUBSCRIBE');
    return sub ? sub.topic : null;
  })
  subscribeTopic: string | null;

  @ApiProperty({ required: false })
  @Expose()
  @Transform(({ obj }) => {
    if (!obj.topics) return null;
    const pub = obj.topics.find((t: any) => t.type === 'PUBLISH');
    return pub ? pub.topic : null;
  })
  publishTopic: string | null;

  @ApiProperty({ required: false })
  @Expose()
  @Transform(({ obj }) => {
    if (!obj.topics) return [];
    return obj.topics
      .filter((t: any) => t.type === 'SUBSCRIBE')
      .map((t: any) => t.topic);
  })
  subscribeTopics: string[];

  @ApiProperty({ required: false })
  @Expose()
  @Transform(({ obj }) => {
    if (!obj.topics) return [];
    return obj.topics
      .filter((t: any) => t.type === 'PUBLISH')
      .map((t: any) => t.topic);
  })
  publishTopics: string[];

  @ApiProperty({ type: [DataSourceTopicResponseDto], required: false })
  @Expose()
  @Type(() => DataSourceTopicResponseDto)
  topics: DataSourceTopicResponseDto[];

  constructor(partial: Partial<DataSourceConfigResponseDto>) {
    Object.assign(this, partial);
  }
}


export class GlobalConfigResponseDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => value?.toString())
  id: string;

  @ApiProperty({ example: 'Default Configuration' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'Primary config for production site', required: false })
  @Expose()
  description: string | null;

  @ApiProperty({ example: 100 })
  @Expose()
  maxReadingVariables: number;

  @ApiProperty({ example: 50 })
  @Expose()
  maxWritingVariables: number;

  @ApiProperty({ example: true })
  @Expose()
  alterFlag: boolean;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ type: DataSourceConfigResponseDto, required: false })
  @Expose()
  @Type(() => DataSourceConfigResponseDto)
  dataSourceConfig?: DataSourceConfigResponseDto;

  constructor(partial: Partial<GlobalConfigResponseDto>) {
    Object.assign(this, partial);
  }
}
