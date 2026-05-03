import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsDate, IsArray, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ExportConsumptionRawDto {
  @ApiProperty({
    description: 'ISO date string or Unix timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({
    description: 'ISO date string or Unix timestamp',
    example: '2023-01-02T00:00:00Z',
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated list of variable IDs',
    example: '1,2,3',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((id) => Number(id));
    }
    return value;
  })
  @IsArray()
  @IsNumber({}, { each: true })
  variableIds?: number[];
}
