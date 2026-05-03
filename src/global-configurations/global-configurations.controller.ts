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
import { GlobalConfigurationsService } from './global-configurations.service';
import { CreateGlobalConfigurationDto } from './dto/create-global-configuration.dto';
import { UpdateGlobalConfigurationDto } from './dto/update-global-configuration.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { GlobalConfigResponseDto } from './dto/response/global-config-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

@ApiTags('Global Configurations')
@ApiBearerAuth()
@Controller('global-configurations')
export class GlobalConfigurationsController {
  constructor(
    private readonly globalConfigurationsService: GlobalConfigurationsService,
  ) { }

  // Creating a configuration is often the first step in setting up a new 
  // industrial sensor or controller. This initializes the metadata and
  // sets up the communication (MQTT/Socket) parameters.
  // ... keeping the rest the same

  @Post()
  @ApiOperation({ summary: 'Create a new global configuration', description: 'Initializes a configuration with basic info and optional data source settings.' })
  @ApiResponse({ status: 201, description: 'Configuration created successfully', type: GlobalConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid configuration data' })
  create(@Body() createGlobalConfigurationDto: CreateGlobalConfigurationDto) {
    return this.globalConfigurationsService.create(
      createGlobalConfigurationDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve all global configurations', description: 'Returns a list of all existing configurations including their data source details.' })
  @ApiResponse({ status: 200, description: 'List of configurations', type: [GlobalConfigResponseDto] })
  findAll() {
    // We include data source details by default because the frontend 
    // usually needs them to show connection status or settings.
    return this.globalConfigurationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get configuration by ID', description: 'Fetches detailed information for a single global configuration.' })
  @ApiParam({ name: 'id', description: 'Database ID of the configuration' })
  @ApiResponse({ status: 200, description: 'Configuration details', type: GlobalConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.globalConfigurationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing configuration', description: 'Partial updates for configuration fields or data source settings.' })
  @ApiParam({ name: 'id', description: 'Database ID of the configuration to update' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully', type: GlobalConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateGlobalConfigurationDto: UpdateGlobalConfigurationDto,
  ) {
    return this.globalConfigurationsService.update(
      id,
      updateGlobalConfigurationDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a configuration', description: 'Removes the configuration and all associated variables/MBOs.' })
  @ApiParam({ name: 'id', description: 'Database ID of the configuration to delete' })
  @ApiResponse({ status: 200, description: 'Configuration deleted successfully', type: ActionResponseDto })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    // WARNING: Deletion is cascading in the DB, so deleting a config 
    // will also wipe all linked variables and history data.
    return this.globalConfigurationsService.remove(id);
  }
}
