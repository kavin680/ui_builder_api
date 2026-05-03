import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
  ParseBoolPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SystemConfigService } from './system-config.service';
import { CreateSystemConfigDto } from './dto/create-system-config.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RestoreResponseDto } from './dto/response/restore-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

@ApiTags('System Configuration')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Post('reset')
  @ApiOperation({ summary: 'Clear all system configurations' })
  @ApiResponse({ status: 200, description: 'Systems reset successfully', type: ActionResponseDto })
  reset() {
    return this.systemConfigService.resetSystemConfig();
  }

  @Post('restore')
  @ApiOperation({ 
    summary: 'Restore system configuration from JSON body or File upload',
    description: 'Accepts either a JSON body matching the DTO or a .json file upload. Use dryRun=true to validate without saving.' 
  })
  @ApiQuery({ name: 'dryRun', required: false, type: Boolean })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        version: { type: 'string' },
        data: { type: 'object' }
      }
    },
    required: false
  })
  @ApiResponse({ status: 200, description: 'System configuration restored', type: RestoreResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  async restore(
    @Body() body: CreateSystemConfigDto,
    @UploadedFile() file: any,
    @Query('dryRun', new ParseBoolPipe({ optional: true })) dryRun?: boolean,
  ) {
    let restoreData: CreateSystemConfigDto;

    if (file) {
      try {
        restoreData = JSON.parse(file.buffer.toString());
      } catch (e) {
        throw new BadRequestException('Invalid JSON file format.');
      }
    } else {
      restoreData = body;
    }

    if (!restoreData || !restoreData.version || !restoreData.data) {
      throw new BadRequestException(
        'Invalid restore data. Metadata (version) and data fields are required.',
      );
    }

    return this.systemConfigService.restoreSystemConfig(
      restoreData,
      dryRun === true,
    );
  }

  @ApiOperation({ summary: 'Backup system configuration as JSON file' })
  @Get('backup')
  async backup(@Res() res: Response) {
    const backupData = await this.systemConfigService.backupSystemConfig();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=system-config-backup-${new Date().toISOString().split('T')[0]}.json`,
    );
    
    return res.send(backupData);
  }
}
