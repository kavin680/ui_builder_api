export function calculateNextRun(
  timeWindows: any[],
  type: 'start' | 'end',
): Date | null {
  if (!timeWindows || timeWindows.length === 0) return null;

  const now = new Date();
  const nextRuns: Date[] = [];

  timeWindows.forEach((tw) => {
    const targetTime = type === 'start' ? tw.startTime : tw.endTime;

    // DIAGNOSTIC LOG: Check Prisma object structure
    console.log(`[TimeCalc] Processing ${type}: ${targetTime.toISOString()} (${typeof targetTime})`);

    // Use UTC methods to extract the "nominal" time stored in MySQL TIME column
    // This ensures that "09:00" in DB is treated as "09:00" regardless of timezone offsets
    const hours = targetTime.getUTCHours();
    const minutes = targetTime.getUTCMinutes();
    const seconds = targetTime.getUTCSeconds();

    const target = new Date(now);
    // Be explicit: set seconds and ms to 0 for strict alignment
    target.setHours(hours, minutes, seconds, 0);

    const dayDiff = (tw.dayOfWeek - now.getDay() + 7) % 7;
    target.setDate(now.getDate() + dayDiff);

    // Final safety: if for some reason the target ended up in the past 
    // (e.g. current second is same as target second but ms is higher), move to next week
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 7);
    }
    nextRuns.push(target);
  });

  // Return the closest upcoming time
  return new Date(Math.min(...nextRuns.map((r) => r.getTime())));
}

/**
 * Checks if the current time falls within any of the provided time windows.
 */
export function isCurrentlyInWindow(timeWindows: any[]): boolean {
  if (!timeWindows || timeWindows.length === 0) return false;

  const now = new Date();
  const currentDay = now.getDay();
  const currentTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  return timeWindows.some((tw) => {
    if (tw.dayOfWeek !== currentDay) return false;

    const startTotalSeconds = tw.startTime.getUTCHours() * 3600 + tw.startTime.getUTCMinutes() * 60 + tw.startTime.getUTCSeconds();
    const endTotalSeconds = tw.endTime.getUTCHours() * 3600 + tw.endTime.getUTCMinutes() * 60 + tw.endTime.getUTCSeconds();

    return currentTotalSeconds >= startTotalSeconds && currentTotalSeconds <= endTotalSeconds;
  });
}
