import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateWritingVariableMboDto {
  @ApiProperty({ example: 1, description: 'ID of the MBO variable' })
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @ApiProperty({
    example: 'Pump_0',
    description: 'Name of the MBO variable',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 100.5,
    description: 'Value of the MBO variable',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  value?: number;
}
