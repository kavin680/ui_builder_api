import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class SocketTelemetryUpdateDto {
  @ApiProperty({ example: '1' })
  @Expose()
  variableId: string;

  @ApiProperty({ example: 'Temperature' })
  @Expose()
  variableName: string;

  @ApiProperty({ example: '25.5' })
  @Expose()
  value: string;

  @ApiProperty({ example: true })
  @Expose()
  @Transform(({ value }) => !!value)
  isCalculated: boolean;

  constructor(partial: Partial<SocketTelemetryUpdateDto>) {
    Object.assign(this, partial);
  }
}

export class SocketTelemetryBatchDto {
  @ApiProperty({ type: [SocketTelemetryUpdateDto] })
  @Expose()
  data: SocketTelemetryUpdateDto[];

  @ApiProperty({ example: '2026-04-22T10:00:00.000Z' })
  @Expose()
  timestamp: string;

  constructor(partial: Partial<SocketTelemetryBatchDto>) {
    Object.assign(this, partial);
    this.timestamp = new Date().toISOString();
  }
}
