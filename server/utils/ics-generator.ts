import { formatInTimeZone } from 'date-fns-tz';

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  startDateTime: Date;
  endDateTime: Date;
  status: string;
}

function formatICSDate(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyyMMdd'T'HHmmss");
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) {
    return line;
  }
  
  const folded = [];
  let current = line.substring(0, maxLength);
  let remaining = line.substring(maxLength);
  
  folded.push(current);
  
  while (remaining.length > 0) {
    const chunk = remaining.substring(0, maxLength - 1);
    folded.push(' ' + chunk);
    remaining = remaining.substring(maxLength - 1);
  }
  
  return folded.join('\r\n');
}

export function generateICSFile(events: CalendarEvent[], timezone: string, calendarName: string): string {
  const now = new Date();
  const timestamp = formatInTimeZone(now, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dugout Desk//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
    `X-WR-TIMEZONE:${timezone}`,
  ];
  
  for (const event of events) {
    const dtstart = formatICSDate(event.startDateTime, timezone);
    const dtend = formatICSDate(event.endDateTime, timezone);
    
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:booking-${event.id}@dugoutdesk.ca`);
    lines.push(`DTSTAMP:${timestamp}`);
    lines.push(`DTSTART;TZID=${timezone}:${dtstart}`);
    lines.push(`DTEND;TZID=${timezone}:${dtend}`);
    lines.push(`SUMMARY:${escapeICSText(event.summary)}`);
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
    lines.push(`LOCATION:${escapeICSText(event.location)}`);
    lines.push(`STATUS:${event.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`);
    lines.push('END:VEVENT');
  }
  
  lines.push('END:VCALENDAR');
  
  return lines.map(foldLine).join('\r\n');
}
