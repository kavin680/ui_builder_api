import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class FreezeTimeWindowResponseDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => value?.toString())
  id: string;

  @ApiProperty({ example: 1, description: '1 (Mon) to 7 (Sun)' })
  @Expose()
  dayOfWeek: number;

  @ApiProperty({ example: '08:00:00' })
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toTimeString().split(' ')[0] : value)
  startTime: string;

  @ApiProperty({ example: '17:00:00' })
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toTimeString().split(' ')[0] : value)
  endTime: string;
}

export class FreezeConfigResponseDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => value?.toString())
  id: string;

  @ApiProperty({ example: 'Day Shift' })
  @Expose()
  name: string;

  @ApiProperty({ example: '10' })
  @Expose()
  @Transform(({ value }) => value?.toString())
  globalConfigId: string;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ type: [FreezeTimeWindowResponseDto] })
  @Expose()
  @Type(() => FreezeTimeWindowResponseDto)
  timeWindows: FreezeTimeWindowResponseDto[];

  constructor(partial: Partial<FreezeConfigResponseDto>) {
    Object.assign(this, partial);
  }
}
