import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { HistoryType } from '@prisma/client';

export class HistoryConfigResponseDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => value?.toString())
  id: string;

  @ApiProperty({ example: 'Temperature' })
  @Expose()
  name: string;

  @ApiProperty({ enum: HistoryType, example: HistoryType.SCHEDULED })
  @Expose()
  historyType: HistoryType;

  @ApiProperty({ example: 60, required: false })
  @Expose()
  loggingTime: number | null;

  constructor(partial: Partial<HistoryConfigResponseDto>) {
    Object.assign(this, partial);
  }
}
