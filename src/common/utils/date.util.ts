/**
 * Calculates the difference in calendar days between two dates.
 * Uses the system timezone by default, which should be set to Asia/Tashkent
 * according to project requirements.
 *
 * @param date1 The first date
 * @param date2 The second date
 * @returns The number of calendar days between date1 and date2
 */
export function getCalendarDayDifference(date1: Date | string, date2: Date | string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  // Set to midnight in local time
  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();

  const diffMs = t1 - t2;
  return Math.abs(Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Checks if a date is within a certain number of calendar days from now.
 *
 * @param date The date to check
 * @param days The maximum number of calendar days
 * @returns True if the date is within the specified window
 */
export function isWithinCalendarDays(date: Date | string, days: number): boolean {
  const diff = getCalendarDayDifference(new Date(), date);
  return diff < days;
}
