import { Controller, Get, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { HistoryConfigService } from './history-config.service';
import { UpdateHistoryConfigDto } from './dto/update-history-config.dto';
import { HistoryConfigResponseDto } from './dto/response/history-config-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('History Configuration')
@ApiBearerAuth()
@Controller('history-config')
export class HistoryConfigController {
  constructor(private readonly historyConfigService: HistoryConfigService) {}

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ENGINEER)
  @ApiOperation({ 
    summary: 'Update history configuration', 
    description: 'Updates the logging strategy (HistoryType) and optional logging interval for a reading variable.' 
  })
  @ApiParam({ name: 'id', description: 'Database ID of the reading variable' })
  @ApiResponse({ status: 200, description: 'History configuration updated successfully', type: HistoryConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Variable not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateHistoryConfigDto: UpdateHistoryConfigDto,
  ) {
    return this.historyConfigService.update(id, updateHistoryConfigDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Disable history logging', 
    description: 'Resets the history type to NONE and clears logging time for the specified variable.' 
  })
  @ApiParam({ name: 'id', description: 'Database ID of the reading variable' })
  @ApiResponse({ status: 200, description: 'History logging disabled successfully', type: ActionResponseDto })
  @ApiResponse({ status: 404, description: 'Variable not found' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.historyConfigService.remove(id);
  }
}
