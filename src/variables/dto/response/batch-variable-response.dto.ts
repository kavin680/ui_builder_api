import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ReadingVariableResponseDto } from './reading-variable-response.dto';
import { WritingVariableResponseDto } from './writing-variable-response.dto';

export class UpdateByIndexRecordDto {
  @ApiProperty({ example: 'Temperature' })
  @Expose()
  name: string;

  @ApiProperty({ example: '23.5' })
  @Expose()
  value: string | number;

  @ApiProperty({ example: true })
  @Expose()
  calculated: boolean;
}

export class UpdateByIndexResponseDto {
  @ApiProperty({ example: 5 })
  @Expose()
  count: number;

  @ApiProperty({ example: 'Updated 5 variables' })
  @Expose()
  message: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @Expose()
  details: Record<string, any>;

  @ApiProperty({ type: [UpdateByIndexRecordDto] })
  @Expose()
  @Type(() => UpdateByIndexRecordDto)
  updatedVariables: UpdateByIndexRecordDto[];

  constructor(partial: Partial<UpdateByIndexResponseDto>) {
    Object.assign(this, partial);
  }
}

export class CombinedVariablesResponseDto {
  @ApiProperty({ type: [ReadingVariableResponseDto] })
  @Expose()
  @Type(() => ReadingVariableResponseDto)
  readingVariables: ReadingVariableResponseDto[];

  @ApiProperty({ type: [WritingVariableResponseDto] })
  @Expose()
  @Type(() => WritingVariableResponseDto)
  writingVariables: WritingVariableResponseDto[];

  constructor(partial: Partial<CombinedVariablesResponseDto>) {
    Object.assign(this, partial);
  }
}
