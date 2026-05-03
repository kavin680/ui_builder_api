import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { HistoryType } from '@prisma/client';

export class UpdateHistoryConfigDto {
  @ApiProperty({
    enum: HistoryType,
    example: HistoryType.INSTANT,
    description: 'Type of history logging',
    required: false,
  })
  @IsOptional()
  @IsEnum(HistoryType)
  historyType?: HistoryType;

  @ApiProperty({
    example: 60,
    description: 'Logging time in minutes',
    required: false,
  })
  @IsOptional()
  @IsInt()
  loggingTime?: number;
}
