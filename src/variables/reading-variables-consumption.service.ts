import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Workbook } from 'exceljs';
import { plainToInstance } from 'class-transformer';
import { ConsumptionResponseDto } from './dto/response/consumption-response.dto';
import { TimeUtils } from '../common/utils/time-utils';

@Injectable()
export class ReadingVariablesConsumptionService {
  private readonly logger = new Logger(ReadingVariablesConsumptionService.name);

  constructor(private readonly prisma: PrismaService) { }

  async getConsumptionData(
    variableId: number,
    type: 'day' | 'week' | 'month',
    count: number,
  ): Promise<ConsumptionResponseDto> {
    // 🔒 BOUNDARY VALIDATION

    if (
      (type === 'day' && count > 365) ||
      (type === 'week' && count > 52) ||
      (type === 'month' && count > 12)
    ) {
      throw new BadRequestException('Max 1 year only');
    }

    // 🕒 TIME RANGE
    const now = new Date();
    const startDate = new Date(now);

    if (type === 'day') {
      startDate.setDate(startDate.getDate() - count);
    } else if (type === 'week') {
      startDate.setDate(startDate.getDate() - count * 7);
    } else {
      startDate.setMonth(startDate.getMonth() - count);
    }

    // 🧠 GROUPING
    let groupBy = '';
    if (type === 'day') {
      groupBy = 'DATE(recorded_at)';
    } else if (type === 'week') {
      groupBy = "DATE_FORMAT(recorded_at, '%x-W%v')";
    } else {
      groupBy = "DATE_FORMAT(recorded_at, '%Y-%m')";
    }

    // 🔥 QUERY
    const query = `
      SELECT 
        ${groupBy} as period,
        (MAX(CAST(value AS DECIMAL(18,2))) - MIN(CAST(value AS DECIMAL(18,2)))) as consumption
      FROM reading_variable_utility_history
      WHERE reading_variable_id = ?
        AND recorded_at >= ?
        AND recorded_at < ?
        AND value REGEXP '^-?[0-9]+(\\\\.[0-9]+)?$'
      GROUP BY period
      ORDER BY period ASC
    `;

    let data: any[];

    try {
      data = await this.prisma.$queryRawUnsafe(
        query,
        Number(variableId),
        startDate,
        now,
      );
    } catch (err) {
      this.logger.error('SQL ERROR:', err);
      throw new BadRequestException('Database query failed');
    }

    // 🔄 NORMALIZE
    const normalized = data
      .map((d) => ({
        period:
          typeof d.period === 'string'
            ? d.period
            : new Date(d.period).toLocaleDateString('en-CA'),
        consumption: Number(d.consumption ?? 0),
      }))
      .filter((d) => !isNaN(d.consumption));

    // ❗ EMPTY CASE
    if (!normalized.length) {
      return {
        data: {
          list: [],
          summary: {
            highest: null,
            lowest: null,
            average: 0,
          },
          meta: { type, count },
        },
      };
    }

    // 📊 SUMMARY
    const consumptions = normalized.map((d) => d.consumption);

    const highest = normalized.reduce((a, b) =>
      b.consumption > a.consumption ? b : a,
    );

    const lowest = normalized.reduce((a, b) =>
      b.consumption < a.consumption ? b : a,
    );

    const average =
      consumptions.reduce((a, b) => a + b, 0) / consumptions.length;

    // ✅ FINAL RETURN (FIXED STRUCTURE)
    const result = {
      data: {
        list: normalized,
        summary: {
          highest: {
            period: highest.period,
            value: highest.consumption,
          },
          lowest: {
            period: lowest.period,
            value: lowest.consumption,
          },
          average: Number(average.toFixed(2)),
        },
        meta: {
          type,
          count,
        },
      },
    };
    return plainToInstance(ConsumptionResponseDto, result);
  }

  // async exportConsumptionToExcel(
  //   startDate: string | number,
  //   endDate: string | number,
  //   type: 'day' | 'week' | 'month',
  //   variableIds?: number[],
  // ): Promise<Workbook> {
  //   const start = isNaN(Number(startDate))
  //     ? new Date(startDate)
  //     : new Date(Number(startDate));

  //   const end = isNaN(Number(endDate))
  //     ? new Date(endDate)
  //     : new Date(Number(endDate));

  //   if (isNaN(start.getTime()) || isNaN(end.getTime())) {
  //     throw new BadRequestException('Invalid date format');
  //   }

  //   // 🧠 GROUPING
  //   let groupBy = '';
  //   if (type === 'day') {
  //     groupBy = 'DATE(h.recorded_at)';
  //   } else if (type === 'week') {
  //     groupBy = "DATE_FORMAT(h.recorded_at, '%x-W%v')";
  //   } else {
  //     groupBy = "DATE_FORMAT(h.recorded_at, '%Y-%m')";
  //   }

  //   const variableFilter = variableIds?.length
  //     ? `AND h.reading_variable_id IN (${variableIds.join(',')})`
  //     : '';

  //   // 🔥 QUERY (Consumption)
  //   const query = `
  //   SELECT 
  //     ${groupBy} as period,
  //     v.name as variableName,
  //     (MAX(CAST(h.value AS DECIMAL(18,2))) - MIN(CAST(h.value AS DECIMAL(18,2)))) as consumption
  //   FROM reading_variable_utility_history h
  //   JOIN reading_variable v ON v.id = h.reading_variable_id
  //   WHERE h.recorded_at >= ?
  //     AND h.recorded_at <= ?
  //     ${variableFilter}
  //   GROUP BY period, v.name
  //   ORDER BY period ASC
  // `;

  //   const rows: any[] = await this.prisma.$queryRawUnsafe(
  //     query,
  //     start,
  //     end,
  //   );

  //   const workbook = new Workbook();
  //   const worksheet = workbook.addWorksheet('Consumption');

  //   // 🟢 STEP 1: Unique variables
  //   const variableSet = new Set<string>();
  //   rows.forEach((r) => variableSet.add(r.variableName));
  //   const variableNames = Array.from(variableSet);

  //   // 🟢 STEP 2: Group by period
  //   const grouped = new Map<string, Record<string, any>>();

  //   rows.forEach((r) => {
  //     const period =
  //       typeof r.period === 'string'
  //         ? r.period
  //         : new Date(r.period).toLocaleDateString('en-CA');

  //     if (!grouped.has(period)) {
  //       grouped.set(period, { period });
  //     }

  //     const row = grouped.get(period)!;
  //     row[r.variableName] = Number(r.consumption ?? 0);
  //   });

  //   // 🟢 STEP 3: Columns
  //   worksheet.columns = [
  //     { header: 'Period', key: 'period', width: 20 },
  //     ...variableNames.map((name) => ({
  //       header: name,
  //       key: name,
  //       width: 15,
  //     })),
  //   ];

  //   worksheet.getRow(1).font = { bold: true };

  //   // 🟢 STEP 4: Rows
  //   grouped.forEach((row) => {
  //     const fullRow: any = {
  //       period: row.period,
  //     };

  //     variableNames.forEach((name) => {
  //       fullRow[name] = row[name] ?? 0;
  //     });

  //     worksheet.addRow(fullRow);
  //   });

  //   return workbook;
  // }

  async exportConsumptionRawToExcel(
    start: Date,
    end: Date,
    variableIds?: number[],
  ): Promise<Workbook> {

    const whereClause: any = {
      recordedAt: {
        gte: start,
        lte: end,
      },
    };

    if (variableIds?.length) {
      whereClause.readingVariableId = {
        in: variableIds.map((id) => BigInt(id)),
      };
    }

    // 🔥 RAW DATA (NO GROUPING)
    const history = await this.prisma.readingVariableUtilityHistory.findMany({
      where: whereClause,
      take: 100000,
      include: {
        readingVariable: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        recordedAt: 'asc',
      },
    });

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Raw Consumption');

    // 🟢 STEP 1: Collect variables
    const variableSet = new Set<string>();
    history.forEach((h) => {
      variableSet.add(h.readingVariable.name);
    });
    const variableNames = Array.from(variableSet);

    // 🟢 STEP 2: Group by timestamp (like your history)
    const grouped = new Map<string, Record<string, any>>();



    history.forEach((h) => {
      const timestamp = TimeUtils.toLocalString(h.recordedAt);

      if (!grouped.has(timestamp)) {
        grouped.set(timestamp, { timestamp });
      }

      const row = grouped.get(timestamp)!;
      row[h.readingVariable.name] = Number(h.value);
    });

    // 🟢 STEP 3: Columns
    worksheet.columns = [
      { header: 'Timestamp (Local)', key: 'timestamp', width: 25 },
      ...variableNames.map((name) => ({
        header: name,
        key: name,
        width: 15,
      })),
    ];

    worksheet.getRow(1).font = { bold: true };

    // 🟢 STEP 4: Rows
    grouped.forEach((row) => {
      const fullRow: any = {
        timestamp: row.timestamp,
      };

      variableNames.forEach((name) => {
        fullRow[name] = row[name] ?? null;
      });

      worksheet.addRow(fullRow);
    });

    return workbook;
  }
}