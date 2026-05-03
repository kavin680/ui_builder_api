import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { FreezeConfigurationService } from './freeze-configuration.service';
import { CreateFreezeConfigurationDto } from './dto/create-freeze-configuration.dto';
import { UpdateFreezeConfigurationDto } from './dto/update-freeze-configuration.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { FreezeConfigResponseDto } from './dto/response/freeze-config-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

@ApiTags('Freeze Configuration')
@ApiBearerAuth()
@Controller('freeze-configuration')
export class FreezeConfigurationController {
  constructor(
    private readonly freezeConfigurationService: FreezeConfigurationService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new freeze configuration',
    description:
      'Sets up a schedule for freezing variable values during specific time windows.',
  })
  @ApiResponse({ status: 201, description: 'Freeze configuration created', type: FreezeConfigResponseDto })
  create(@Body() createFreezeConfigurationDto: CreateFreezeConfigurationDto) {
    return this.freezeConfigurationService.create(createFreezeConfigurationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all freeze configurations' })
  @ApiResponse({ status: 200, description: 'List of freeze configurations', type: [FreezeConfigResponseDto] })
  findAll() {
    return this.freezeConfigurationService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get freeze configuration by ID' })
  @ApiParam({ name: 'id', description: 'Internal database ID' })
  @ApiResponse({ status: 200, description: 'Freeze configuration details', type: FreezeConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.freezeConfigurationService.findOne(id);
  }

  @Get('by-global-id/:globalId')
  @ApiOperation({ summary: 'Get freeze config by global config ID' })
  @ApiParam({ name: 'globalId', description: 'Global configuration ID' })
  @ApiResponse({ status: 200, description: 'Freeze configuration details', type: [FreezeConfigResponseDto] })
  @ApiResponse({ status: 404, description: 'Not found' })
  findByGlobalConfigId(@Param('globalId', ParseIntPipe) globalId: number) {
    return this.freezeConfigurationService.findByGlobalConfigId(globalId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a freeze configuration' })
  @ApiParam({ name: 'id', description: 'Internal database ID' })
  @ApiResponse({ status: 200, description: 'Updated successfully', type: FreezeConfigResponseDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFreezeConfigurationDto: UpdateFreezeConfigurationDto,
  ) {
    return this.freezeConfigurationService.update(
      id,
      updateFreezeConfigurationDto,
    );
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Deleted successfully', type: ActionResponseDto })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.freezeConfigurationService.remove(id);
  }
}
