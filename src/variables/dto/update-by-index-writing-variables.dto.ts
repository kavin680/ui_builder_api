import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber } from 'class-validator';

export class UpdateByIndexWritingVariablesDto {
  @ApiProperty({
    type: [Number],
    example: [25.5, 30.2, 15.8, 42.0],
    description: 'Array of numeric values to update variables in index order',
  })
  @IsArray()
  @IsNumber({}, { each: true })
  values: number[];
}
