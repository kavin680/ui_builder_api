import { Logger } from '@nestjs/common';

const logger = new Logger('PrismaTxUtil');

/** Prisma error codes that are safe to retry */
const RETRYABLE_CODES = new Set(['P2034', 'P2024', 'P1001']);

/**
 * Wraps a Prisma transaction or async DB call with retry logic.
 * Retries on deadlocks (P2034), pool timeouts (P2024), and connection errors (P1001).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 150,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (attempt < retries && code && RETRYABLE_CODES.has(code)) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // exponential backoff
        logger.warn(
          `Transient DB error [${code}] on attempt ${attempt}/${retries}. Retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  // TypeScript requires a return here but the loop always throws or returns
  throw new Error('withRetry: unreachable');
}

/**
 * Splits an array into fixed-size chunks.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Wraps a DB operation (or transaction) and logs its duration.
 * Warns if it takes longer than `warnThresholdMs` (default 5000ms).
 */
export async function withTxMonitor<T>(
  label: string,
  fn: () => Promise<T>,
  warnThresholdMs = 5000,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    if (duration > warnThresholdMs) {
      logger.warn(`[SLOW TX] "${label}" took ${duration}ms (threshold: ${warnThresholdMs}ms)`);
    } else {
      logger.debug(`[TX] "${label}" completed in ${duration}ms`);
    }
    return result;
  } catch (err: any) {
    const duration = Date.now() - start;
    logger.error(
      `[TX FAILED] "${label}" failed after ${duration}ms — code: ${err?.code ?? 'unknown'} — ${err?.message}`,
    );
    throw err;
  }
}
