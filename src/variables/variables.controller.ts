import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReadingVariablesService } from './reading-variables.service';
import { WritingVariablesService } from './writing-variables.service';
import { CreateReadingVariableDto } from './dto/create-reading-variable.dto';
import { CreateWritingVariableDto } from './dto/create-writing-variable.dto';
import { UpdateWritingVariableDto } from './dto/update-writing-variable.dto';
import { UpdateWritingVariableMboDto } from './dto/update-writing-variable-mbo.dto';
import { UpdateByIndexReadingVariablesDto } from './dto/update-by-index-reading-variables.dto';
import { ReadingVariableResponseDto } from './dto/response/reading-variable-response.dto';
import { WritingVariableResponseDto, WritingVariableMboResponseDto } from './dto/response/writing-variable-response.dto';
import { UpdateByIndexResponseDto, CombinedVariablesResponseDto } from './dto/response/batch-variable-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';
import { GetConsumptionDto } from './dto/get-consumption.dto';
import { ExportConsumptionRawDto } from './dto/export-consumption-raw.dto';
import { ConsumptionResponseDto } from './dto/response/consumption-response.dto';
import { GetReadingHistoryDto } from './dto/get-reading-history.dto';
import {
  PARAMETER_COUNT_MAP,
  FUNCTION_REGISTRY,
} from '../const/function-registry';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ReadingVariablesConsumptionService } from './reading-variables-consumption.service';

@ApiTags('Variables')
@ApiBearerAuth()
@Controller('variables')
export class VariablesController {
  constructor(
    private readonly readingVariablesService: ReadingVariablesService,
    private readonly readingVariablesConsumptionService: ReadingVariablesConsumptionService,
    private readonly writingVariablesService: WritingVariablesService,
  ) { }

  @Get('functions')
  @ApiOperation({
    summary: 'Get available functions and parameter counts',
    description:
      'Returns a map of available derived variable functions and their required parameter counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Map of functions to parameter counts',
    schema: {
      type: 'object',
      additionalProperties: { type: 'integer' },
      example: {
        SUM: 1,
        COUNT: 2,
        MAX: 3,
        MIN: 4,
        AVERAGE: 5,
      },
    },
  })
  getAvailableFunctions() {
    return PARAMETER_COUNT_MAP;
  }

  @Get('reading/functions')
  @ApiOperation({ summary: 'Get available reading functions', description: 'Returns a map of functions applicable to reading variables.' })
  @ApiResponse({ status: 200, description: 'Map of reading functions' })
  getReadingFunctions() {
    // Filter registry for READ functions
    const result: Record<string, number> = {};
    Object.values(FUNCTION_REGISTRY).forEach((def) => {
      if (def.usage === 'READ' || def.usage === 'BOTH') {
        result[def.name] = def.paramCount;
      }
    });
    return result;
  }

  @Get('writing/functions')
  @ApiOperation({ summary: 'Get available writing functions', description: 'Returns a map of functions applicable to writing variables.' })
  @ApiResponse({ status: 200, description: 'Map of writing functions' })
  getWritingFunctions() {
    // Filter registry for WRITE functions
    const result: Record<string, number> = {};
    Object.values(FUNCTION_REGISTRY).forEach((def) => {
      if (def.usage === 'WRITE' || def.usage === 'BOTH') {
        result[def.name] = def.paramCount;
      }
    });
    return result;
  }

  @Get('reading/history')
  @ApiOperation({
    summary: 'Get reading variable history',
    description:
      'Retrieves historic values for specified reading variables within a date range.',
  })
  getReadingHistory(@Query() query: GetReadingHistoryDto) {
    return this.readingVariablesService.getReadingHistory(
      query.startDate,
      query.endDate,
      query.variableIds,
    );
  }

  @Get('reading/history/export')
  @ApiOperation({
    summary: 'Export reading variable history to CSV',
    description:
      'Exports historic values for specified reading variables within a date range to a CSV file.',
  })
  async exportReadingHistory(
    @Res() res: Response,
    @Query() query: GetReadingHistoryDto,
  ) {
    const workbook =
      await this.readingVariablesService.exportReadingHistoryToExcel(
        query.startDate,
        query.endDate,
        query.variableIds,
      );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reading-history.csv',
    );

    await workbook.csv.write(res);
    res.end();
  }

  @Get('reading/consumption')
  @ApiOperation({
    summary: 'Get reading variable consumption',
    description: 'Calculates consumption metrics for a variable over a period.',
  })
  @ApiResponse({ status: 200, description: 'Consumption metrics', type: ConsumptionResponseDto })
  async getConsumption(@Query() query: GetConsumptionDto) {
    return this.readingVariablesConsumptionService.getConsumptionData(
      query.variableId,
      query.type,
      query.count,
    );
  }

  @Get('reading/consumption/export')
  @ApiOperation({
    summary: 'Export raw consumption data to Excel',
    description: 'Generates an Excel file with detailed consumption readings.',
  })
  async exportConsumptionRaw(
    @Query() query: ExportConsumptionRawDto,
    @Res() res: Response,
  ) {
    const workbook =
      await this.readingVariablesConsumptionService.exportConsumptionRawToExcel(
        query.startDate,
        query.endDate,
        query.variableIds,
      );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=consumption-${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  // ==================== READING VARIABLES ====================

  @Post('reading')
  @Roles(UserRole.ADMIN, UserRole.ENGINEER)
  @ApiOperation({
    summary: 'Create or update a reading variable',
    description: 'Creates or updates a single reading variable.',
  })
  @ApiResponse({
    status: 201,
    description: 'Variable created successfully',
    type: ActionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiBody({ type: CreateReadingVariableDto })
  createReadingVariable(@Body() dto: CreateReadingVariableDto) {
    return this.readingVariablesService.createReadingVariable(dto);
  }

  @Get('reading')
  @ApiOperation({
    summary: 'Get all active reading variables',
    description:
      'Retrieves all reading variables from all active configurations',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all active reading variables',
    type: [ReadingVariableResponseDto],
  })
  getAllActiveReading() {
    return this.readingVariablesService.findAllActiveReadingVariables();
  }

  @Get('reading/:globalConfigId')
  @ApiOperation({
    summary: 'Get reading variables by config ID',
    description: 'Retrieves all reading variables for a specific configuration',
  })
  @ApiParam({
    name: 'globalConfigId',
    type: 'number',
    description: 'Global configuration ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of reading variables',
    type: [ReadingVariableResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  getReadingByConfig(
    @Param('globalConfigId', ParseIntPipe) globalConfigId: number,
  ) {
    return this.readingVariablesService.findAllReadingVariables(globalConfigId);
  }

  @Patch('reading/batch/by-index/:globalConfigId')
  @ApiOperation({
    summary: 'Update reading variables by index',
    description:
      'Updates reading variable values in order. First value updates first variable, second updates second, etc. Used for MQTT/IoT data updates.',
  })
  @ApiParam({
    name: 'globalConfigId',
    type: 'number',
    description: 'Global configuration ID',
  })
  @ApiBody({ type: UpdateByIndexReadingVariablesDto })
  @ApiResponse({
    status: 200,
    description: 'Variables updated successfully',
    type: UpdateByIndexResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  updateReadingByIndex(
    @Param('globalConfigId', ParseIntPipe) globalConfigId: number,
    @Body() dto: UpdateByIndexReadingVariablesDto,
  ) {
    return this.readingVariablesService.updateReadingVariablesByIndex(
      globalConfigId,
      dto.values,
    );
  }

  @Delete('reading/:globalConfigId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete all reading variables for a config',
    description:
      'Deletes all reading variables associated with a specific configuration',
  })
  @ApiParam({
    name: 'globalConfigId',
    type: 'number',
    description: 'Global configuration ID',
  })
  @ApiResponse({ status: 204, description: 'Variables deleted successfully', type: ActionResponseDto })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  deleteReadingByConfig(
    @Param('globalConfigId', ParseIntPipe) globalConfigId: number,
  ) {
    return this.readingVariablesService.deleteAllReadingVariables(
      globalConfigId,
    );
  }

  // ==================== WRITING VARIABLES ====================

  @Post('writing')
  @Roles(UserRole.ADMIN, UserRole.ENGINEER)
  @ApiOperation({
    summary: 'Create or update a writing variable',
    description: 'Creates or updates a single writing variable.',
  })
  @ApiResponse({
    status: 201,
    description: 'Variable created successfully',
    type: ActionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiBody({ type: CreateWritingVariableDto })
  createWritingVariable(@Body() dto: CreateWritingVariableDto) {
    return this.writingVariablesService.createWritingVariable(dto);
  }

  @Get('writing')
  @ApiOperation({
    summary: 'Get all active writing variables',
    description:
      'Retrieves all writing variables from all active configurations',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all active writing variables',
    type: [WritingVariableResponseDto],
  })
  getAllActiveWriting() {
    return this.writingVariablesService.findAllActiveWritingVariables();
  }

  @Get('writing/:globalConfigId')
  @ApiOperation({
    summary: 'Get writing variables by config ID',
    description: 'Retrieves all writing variables for a specific configuration',
  })
  @ApiParam({
    name: 'globalConfigId',
    type: 'number',
    description: 'Global configuration ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of writing variables',
    type: [WritingVariableResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  getWritingByConfig(
    @Param('globalConfigId', ParseIntPipe) globalConfigId: number,
  ) {
    return this.writingVariablesService.findAllWritingVariables(globalConfigId);
  }

  @Patch('writing')
  @Roles(UserRole.ADMIN, UserRole.ENGINEER, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'Update a writing variable',
    description: 'Updates a single writing variable value. Also triggers MBO updates if applicable.',
  })
  @ApiResponse({ status: 200, description: 'Variable updated successfully', type: WritingVariableResponseDto })
  @ApiResponse({ status: 404, description: 'Variable not found' })
  @ApiBody({ type: UpdateWritingVariableDto })
  updateWritingVariable(@Body() dto: UpdateWritingVariableDto) {
    return this.writingVariablesService.updateWritingVariable(dto);
  }

  @Delete('writing/:globalConfigId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete all writing variables for a config',
    description:
      'Deletes all writing variables associated with a specific configuration',
  })
  @ApiParam({
    name: 'globalConfigId',
    type: 'number',
    description: 'Global configuration ID',
  })
  @ApiResponse({ status: 204, description: 'Variables deleted successfully', type: ActionResponseDto })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  deleteWritingByConfig(
    @Param('globalConfigId', ParseIntPipe) globalConfigId: number,
  ) {
    return this.writingVariablesService.deleteAllWritingVariables(
      globalConfigId,
    );
  }

  // ==================== MBO ====================

  @Get('writing/mbo/:writingVariableId')
  @ApiOperation({
    summary: 'Get MBO variables by writing variable ID',
    description:
      'Retrieves all MBO generated variables for a specific parent writing variable',
  })
  @ApiParam({
    name: 'writingVariableId',
    type: 'number',
    description: 'Parent writing variable ID',
  })
  @ApiResponse({ status: 200, description: 'List of MBO variables', type: [WritingVariableMboResponseDto] })
  @ApiResponse({ status: 404, description: 'Parent variable not found' })
  getMboByWritingVariable(
    @Param('writingVariableId', ParseIntPipe) writingVariableId: number,
  ) {
    return this.writingVariablesService.findAllMboByWritingVariable(
      writingVariableId,
    );
  }

  @Patch('writing/mbo')
  @ApiOperation({
    summary: 'Update an MBO variable',
    description: 'Updates a single MBO variable record by its ID',
  })
  @ApiBody({ type: UpdateWritingVariableMboDto })
  @ApiResponse({
    status: 200,
    description: 'MBO variable updated successfully',
    type: WritingVariableMboResponseDto,
  })
  updateMboVariable(@Body() dto: UpdateWritingVariableMboDto) {
    return this.writingVariablesService.updateMboVariable(dto);
  }

  @Get('writing/encoded/:globalConfigId')
  @ApiOperation({
    summary: 'Get encoded writing variables',
    description: 'Retrieves all writing variables with encoded values',
  })
  @ApiParam({
    name: 'globalConfigId',
    type: 'number',
    description: 'Global configuration ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of writing variables',
    type: [WritingVariableResponseDto],
  })
  getAllEncodedWritingVariables(
    @Param('globalConfigId', ParseIntPipe) globalConfigId: number,
  ) {
    return this.writingVariablesService.findAllEncodedWritingVariables(
      globalConfigId,
    );
  }

  // ==================== COMBINED ====================

  @Get(':globalConfigId')
  @ApiOperation({
    summary: 'Get all variables for a config',
    description:
      'Retrieves both reading and writing variables for a specific configuration',
  })
  @ApiParam({
    name: 'globalConfigId',
    type: 'number',
    description: 'Global configuration ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Combined list of reading and writing variables',
    type: CombinedVariablesResponseDto,
  })
  async getAllVariables(
    @Param('globalConfigId', ParseIntPipe) globalConfigId: number,
  ) {
    const [readingVariables, writingVariables] = await Promise.all([
      this.readingVariablesService.findAllReadingVariables(globalConfigId),
      this.writingVariablesService.findAllWritingVariables(globalConfigId),
    ]);

    return {
      readingVariables,
      writingVariables,
    };
  }
}
