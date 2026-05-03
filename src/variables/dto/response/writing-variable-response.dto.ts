import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class WritingVariableMboResponseDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => (value !== null && value !== undefined ? value.toString() : null))
  id: string;

  @ApiProperty({ example: 'Temperature_Bit_0' })
  @Expose()
  name: string;

  @ApiProperty({ example: 1 })
  @Expose()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  })
  value: number;

  @ApiProperty({ example: 0 })
  @Expose()
  sequenceNo: number;

  constructor(partial: Partial<WritingVariableMboResponseDto>) {
    Object.assign(this, partial);
  }
}

export class WritingVariableResponseDto {
  @ApiProperty({ example: '1' })
  @Expose()
  @Transform(({ value }) => (value !== null && value !== undefined ? value.toString() : null))
  id: string;

  @ApiProperty({ example: '10' })
  @Expose()
  @Transform(({ value }) => (value !== null && value !== undefined ? value.toString() : null))
  globalConfigId: string;

  @ApiProperty({ example: 'SetPoint' })
  @Expose()
  name: string;

  @ApiProperty({ example: 1 })
  @Expose()
  sequenceNo: number;

  @ApiProperty({ example: 'BYTE', required: false })
  @Expose()
  functionName: string | null;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ example: '255', required: false })
  @Expose()
  rawValue: string | null;

  @ApiProperty({ example: 25.5, required: false })
  @Expose()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  })
  value: number | null;

  @ApiProperty({ example: true })
  @Expose()
  hasMbo: boolean;

  @ApiProperty({ type: [WritingVariableMboResponseDto], required: false })
  @Expose()
  @Type(() => WritingVariableMboResponseDto)
  mboVariables?: WritingVariableMboResponseDto[];

  constructor(partial: Partial<WritingVariableResponseDto>) {
    Object.assign(this, partial);
  }
}
