/**
 * Normalizes a task date string into a user-friendly format.
 */
export function normalizeTaskDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}

/**
 * Adds a specified number of days to a base date.
 */
export function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}
