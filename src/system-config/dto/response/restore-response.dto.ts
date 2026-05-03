import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ProcessedConfigDto {
  @ApiProperty({ example: '1' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Main Building' })
  @Expose()
  name: string;
}

export class RestoreResponseDto {
  @ApiProperty({ example: true })
  @Expose()
  success: boolean;

  @ApiProperty({ example: 'System configuration restored successfully' })
  @Expose()
  message: string;

  @ApiProperty({ type: [ProcessedConfigDto] })
  @Expose()
  @Type(() => ProcessedConfigDto)
  processedConfigs: ProcessedConfigDto[];

  @ApiProperty({ required: false })
  @Expose()
  data?: any;

  constructor(partial: Partial<RestoreResponseDto>) {
    Object.assign(this, partial);
  }
}
