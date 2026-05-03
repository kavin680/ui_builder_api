import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateByIndexReadingVariablesDto {
  @ApiProperty({
    type: [String],
    example: ['A5', 'FF', '1A', '2B'],
    description:
      'Array of values (hex or numeric strings) to update variables in index order',
  })
  @IsArray()
  @IsString({ each: true })
  values: string[];
}
