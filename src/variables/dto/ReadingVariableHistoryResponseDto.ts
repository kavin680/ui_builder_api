import { ApiProperty } from '@nestjs/swagger';

export class ReadingVariableHistoryResponseDto {
  @ApiProperty({ description: 'ID of the history record', example: '1' })
  id: string;

  @ApiProperty({ description: 'ID of the reading variable', example: '1' })
  readingVariableId: string;

  @ApiProperty({
    description: 'Name of the reading variable',
    example: 'Temperature',
  })
  variableName: string;

  @ApiProperty({ description: 'ID of the global configuration', example: '1' })
  globalConfigId: string;

  @ApiProperty({ description: 'Value recorded', example: '25.5' })
  value: string;

  @ApiProperty({
    description: 'Time when the value was recorded',
    type: Date,
    example: '2026-02-25T06:15:59.000Z',
  })
  recordedAt: Date;
}
