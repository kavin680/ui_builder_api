import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class ActionResponseDto {
  @ApiProperty({ example: true })
  @Expose()
  success: boolean = true;

  @ApiProperty({ example: 'Operation completed successfully' })
  @Expose()
  message: string;

  @ApiProperty({ example: '123', required: false })
  @Expose()
  @Transform(({ value }) => value?.toString())
  id?: string;

  @ApiProperty({ example: 1, required: false })
  @Expose()
  count?: number;

  constructor(partial: Partial<ActionResponseDto>) {
    Object.assign(this, partial);
  }
}
