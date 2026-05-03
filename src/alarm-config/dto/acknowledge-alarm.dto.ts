import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsArray } from 'class-validator';

export class AcknowledgeAlarmDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  userId?: number;
}

export class AcknowledgeBatchDto {
  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsNotEmpty()
  @IsArray()
  @IsNumber({}, { each: true })
  ids: number[];

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  userId?: number;
}
