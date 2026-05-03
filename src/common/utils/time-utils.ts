import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Standard utility for timezone-aware date handling.
 * Default timezone is Asia/Kolkata (IST).
 */
export class TimeUtils {
  private static readonly DEFAULT_TZ = process.env.SYSTEM_TIMEZONE || 'Asia/Kolkata';

  /**
   * Converts a UTC Date or ISO string to a local time string.
   * Format: YYYY-MM-DD HH:mm:ss
   */
  static toLocalString(date: Date | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
    return dayjs.utc(date).tz(this.DEFAULT_TZ).format(format);
  }

  /**
   * Returns a standard ISO 8601 UTC string.
   */
  static toISO(date: Date | string): string {
    return dayjs.utc(date).toISOString();
  }

  /**
   * Parses an incoming date string. 
   * If the string has no timezone, it treats it as LOCAL time (System Timezone).
   */
  static fromLocal(dateString: string): Date {
    return dayjs.tz(dateString, this.DEFAULT_TZ).toDate();
  }
}
