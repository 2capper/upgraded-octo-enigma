import { format as dateFnsFormat, parseISO } from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

/**
 * Format a date string or Date object in a specific timezone
 * 
 * @param date - The date to format (Date object or ISO string)
 * @param timezone - IANA timezone identifier (e.g., "America/Toronto")
 * @param formatString - date-fns format string (default: "MMM d, yyyy h:mm a")
 * @returns Formatted date string in the specified timezone
 * 
 * @example
 * formatInTimezone('2024-10-31T14:30:00Z', 'America/Toronto', 'MMM d, yyyy h:mm a')
 * // Returns: "Oct 31, 2024 10:30 AM" (EDT)
 */
export function formatInTimezone(
  date: Date | string | null | undefined,
  timezone: string = 'America/Toronto',
  formatString: string = 'MMM d, yyyy h:mm a'
): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const zonedDate = toZonedTime(dateObj, timezone);
    return formatTz(zonedDate, formatString, { timeZone: timezone });
  } catch (error) {
    console.error('Error formatting date in timezone:', error);
    // Fallback to basic formatting without timezone
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return dateFnsFormat(dateObj, formatString);
  }
}

/**
 * Format just the time portion in a specific timezone
 * 
 * @param date - The date to format
 * @param timezone - IANA timezone identifier
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTimeInTimezone(
  date: Date | string | null | undefined,
  timezone: string = 'America/Toronto'
): string {
  return formatInTimezone(date, timezone, 'h:mm a');
}

/**
 * Format just the date portion in a specific timezone
 * 
 * @param date - The date to format
 * @param timezone - IANA timezone identifier
 * @returns Formatted date string (e.g., "Oct 31, 2024")
 */
export function formatDateInTimezone(
  date: Date | string | null | undefined,
  timezone: string = 'America/Toronto'
): string {
  return formatInTimezone(date, timezone, 'MMM d, yyyy');
}
