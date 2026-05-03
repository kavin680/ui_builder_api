import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AlarmConfigService } from './alarm-config.service';
import { AlarmEvaluationService } from './alarm-evaluation.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateAlarmDto } from './dto/create-alarm.dto';
import { UpdateAlarmDto } from './dto/update-alarm.dto';
import { AlarmHistoryQueryDto } from './dto/alarm-history-query.dto';
import { AcknowledgeAlarmDto, AcknowledgeBatchDto } from './dto/acknowledge-alarm.dto';
import { AlarmResponseDto, PaginatedAlarmHistoryResponseDto, AlarmHistoryRecordDto } from './dto/response/alarm-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

@ApiTags('Alarm Configuration')
@ApiBearerAuth()
@Controller('alarm-config')
export class AlarmConfigController {
  constructor(
    private readonly alarmConfigService: AlarmConfigService,
    private readonly alarmEvalService: AlarmEvaluationService,
  ) { }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ENGINEER)
  @ApiOperation({ summary: 'Create a new alarm configuration', description: 'Defines a new alarm threshold and condition for a specific reading variable.' })
  @ApiResponse({ status: 201, description: 'Alarm configuration created successfully', type: AlarmResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  create(@Body() createAlarmDto: CreateAlarmDto) {
    return this.alarmConfigService.create(createAlarmDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve all alarm configurations', description: 'Returns a list of all defined alarms and their settings.' })
  @ApiResponse({ status: 200, description: 'List of all alarm configurations', type: [AlarmResponseDto] })
  findAll() {
    return this.alarmConfigService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'List currently active alarms', description: 'Retrieves all alarms that are currently in a triggered state.' })
  @ApiResponse({ status: 200, description: 'List of active alarm instances', type: [AlarmHistoryRecordDto] })
  getActiveAlarms() {
    return this.alarmConfigService.getActiveAlarms();
  }

  @Get('history')
  @ApiOperation({
    summary: 'Query alarm event history',
    description: 'Returns a paginated list of alarm trigger and clear events, filterable by date and specific alarm ID.',
  })
  @ApiResponse({ status: 200, description: 'Paginated alarm history', type: PaginatedAlarmHistoryResponseDto })
  getHistory(@Query() query: AlarmHistoryQueryDto) {
    return this.alarmConfigService.getHistory(query);
  }

  @Get('history/export')
  @ApiOperation({
    summary: 'Export alarm history to CSV',
    description: 'Returns a CSV file of alarm trigger and clear events, filterable by date and specific alarm ID.',
  })
  async exportHistory(@Res() res: Response, @Query() query: AlarmHistoryQueryDto) {
    const workbook = await this.alarmConfigService.exportHistoryToExcel(query);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=alarm-history.csv');

    await workbook.csv.write(res);
    res.end();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get alarm configuration by ID',
    description: 'Fetches detailed settings for a specific alarm configuration.',
  })
  @ApiParam({
    name: 'id',
    description: 'Internal database ID of the alarm config',
  })
  @ApiResponse({ status: 200, description: 'Alarm configuration details', type: AlarmResponseDto })
  @ApiResponse({ status: 404, description: 'Alarm configuration not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.alarmConfigService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an alarm configuration',
    description:
      'Modify threshold, condition, or status of an existing alarm.',
  })
  @ApiParam({
    name: 'id',
    description: 'Internal database ID of the alarm config to update',
  })
  @ApiResponse({ status: 200, description: 'Alarm configuration updated', type: AlarmResponseDto })
  @ApiResponse({ status: 404, description: 'Alarm configuration not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAlarmDto: UpdateAlarmDto,
  ) {
    return this.alarmConfigService.update(id, updateAlarmDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete an alarm configuration',
    description:
      'Permanently removes an alarm configuration and clears any active instances of it.',
  })
  @ApiParam({
    name: 'id',
    description: 'Internal database ID of the alarm config to delete',
  })
  @ApiResponse({ status: 204, description: 'Alarm configuration deleted', type: ActionResponseDto })
  @ApiResponse({ status: 404, description: 'Alarm configuration not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.alarmConfigService.remove(id);
  }

  @Post(':id/acknowledge')
  @Roles(UserRole.ADMIN, UserRole.ENGINEER, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'Acknowledge an active alarm',
    description: 'Marks a currently active alarm as acknowledged by a user.',
  })
  @ApiParam({
    name: 'id',
    description: 'Internal database ID of the active alarm instance',
  })
  @ApiResponse({ status: 200, description: 'Alarm acknowledged', type: ActionResponseDto })
  acknowledge(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AcknowledgeAlarmDto,
  ) {
    return this.alarmConfigService.acknowledge(id, dto.userId);
  }

  @Post('acknowledgeAll')
  @ApiOperation({ summary: 'Acknowledge all active alarms' })
  @ApiResponse({ status: 200, description: 'All alarms acknowledged', type: ActionResponseDto })
  acknowledgeAll(@Body() dto: AcknowledgeAlarmDto) {
    return this.alarmConfigService.acknowledgeAll(dto.userId);
  }

  @Post('acknowledge-batch')
  @ApiOperation({ summary: 'Acknowledge multiple alarms by ID' })
  @ApiResponse({ status: 200, description: 'Batch acknowledge successful', type: ActionResponseDto })
  acknowledgeBatch(@Body() dto: AcknowledgeBatchDto) {
    return this.alarmConfigService.acknowledgeBatch(dto.ids, dto.userId);
  }

  @Post('test/:id')
  @ApiOperation({ summary: 'Trigger a manual alarm check for testing' })
  testAlarm(@Param('id', ParseIntPipe) id: number, @Body('value') value: string) {
    return this.alarmEvalService.handleValueChange(BigInt(id), value);
  }
}
