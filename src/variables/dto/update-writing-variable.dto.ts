import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsString,
} from 'class-validator';

export class UpdateWritingVariableDto {
  @ApiProperty({
    example: 1,
    description: 'Database ID of the writing variable to update'
  })
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @ApiProperty({
    example: 100.5,
    description: 'New numeric value for the variable',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiProperty({
    example: ['1', '0'],
    description: 'New raw bit values if updating MBO state (array of strings)',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rawValue?: string[];

  @ApiProperty({
    example: false,
    description:
      'MBO generation flag (deprecated, triggers on "byte" function)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  hasMbo?: boolean;
}
