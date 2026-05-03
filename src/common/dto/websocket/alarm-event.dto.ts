import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class SocketAlarmEventDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => value?.toString())
  id: string;

  @ApiProperty({ example: '10' })
  @Expose()
  @Transform(({ value }) => value?.toString())
  variableId: string;

  @ApiProperty({ example: 'High Temperature' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'I', description: 'Log type (I: Incident, IO: Incident Open, etc.)' })
  @Expose()
  type: string;

  @ApiProperty({ example: 'HIGH' })
  @Expose()
  priority: string;

  @ApiProperty({ example: '95.5' })
  @Expose()
  value: string;

  @ApiProperty({ example: '2026-04-22T10:00:00.000Z' })
  @Expose()
  timestamp: string;

  @ApiProperty({ example: true })
  @Expose()
  isAcknowledged: boolean;

  constructor(partial?: Partial<SocketAlarmEventDto>) {
    if (partial) {
      Object.assign(this, partial);
      if (partial.timestamp && typeof partial.timestamp !== 'string') {
        try {
          this.timestamp = (partial.timestamp as any).toISOString();
        } catch (e) {
          // Fallback if toISOString fails (e.g. invalid date)
          this.timestamp = new Date().toISOString();
        }
      }
    }
    
    // Ensure we always have a timestamp even if it's missing in partial
    if (!this.timestamp) {
      this.timestamp = new Date().toISOString();
    }
  }
}
