import { format } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export interface ParsedICalEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate: string; // YYYY-MM-DD
  endTime: string; // HH:mm
  rawLocation: string;
}

export async function fetchAndParseICalFeed(feedUrl: string, timezone: string = 'America/Toronto'): Promise<ParsedICalEvent[]> {
  try {
    const response = await fetch(feedUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch iCal feed: ${response.statusText}`);
    }
    
    const icsContent = await response.text();
    return parseICalContent(icsContent, timezone);
  } catch (error) {
    throw new Error(`Error fetching iCal feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function parseICalContent(icsContent: string, timezone: string = 'America/Toronto'): ParsedICalEvent[] {
  const events: ParsedICalEvent[] = [];
  
  const lines = icsContent.split(/\r?\n/);
  let currentEvent: Partial<ParsedICalEvent> | null = null;
  let currentProperty = '';
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentProperty += line.substring(1);
      continue;
    }
    
    line = line.trim();
    if (!line) continue;
    
    if (currentProperty) {
      processProperty(currentProperty, currentEvent, timezone);
      currentProperty = '';
    }
    
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {
        uid: '',
        summary: '',
        description: '',
        location: '',
        rawLocation: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
      };
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.uid && currentEvent.startDate) {
        events.push(currentEvent as ParsedICalEvent);
      }
      currentEvent = null;
    } else {
      currentProperty = line;
    }
  }
  
  if (currentProperty && currentEvent) {
    processProperty(currentProperty, currentEvent, timezone);
  }
  
  return events;
}

function processProperty(property: string, event: Partial<ParsedICalEvent> | null, timezone: string) {
  if (!event) return;
  
  const colonIndex = property.indexOf(':');
  if (colonIndex === -1) return;
  
  const fullKey = property.substring(0, colonIndex);
  const value = property.substring(colonIndex + 1);
  
  const [key, ...params] = fullKey.split(';');
  const paramMap = new Map<string, string>();
  params.forEach(param => {
    const [k, v] = param.split('=');
    if (k && v) paramMap.set(k, v);
  });
  
  const unescapedValue = unescapeICSText(value);
  
  switch (key) {
    case 'UID':
      event.uid = unescapedValue;
      break;
    case 'SUMMARY':
      event.summary = unescapedValue;
      break;
    case 'DESCRIPTION':
      event.description = unescapedValue;
      break;
    case 'LOCATION':
      event.location = unescapedValue;
      event.rawLocation = unescapedValue;
      break;
    case 'DTSTART': {
      const dateTime = parseICalDateTime(unescapedValue, paramMap.get('TZID') || timezone, timezone);
      if (dateTime) {
        event.startDate = dateTime.date;
        event.startTime = dateTime.time;
      }
      break;
    }
    case 'DTEND': {
      const dateTime = parseICalDateTime(unescapedValue, paramMap.get('TZID') || timezone, timezone);
      if (dateTime) {
        event.endDate = dateTime.date;
        event.endTime = dateTime.time;
      }
      break;
    }
  }
}

function parseICalDateTime(dateTimeStr: string, eventTimezone: string, targetTimezone: string): { date: string; time: string } | null {
  try {
    let utcDate: Date;
    
    if (dateTimeStr.endsWith('Z')) {
      const year = parseInt(dateTimeStr.substring(0, 4));
      const month = parseInt(dateTimeStr.substring(4, 6)) - 1;
      const day = parseInt(dateTimeStr.substring(6, 8));
      const hour = parseInt(dateTimeStr.substring(9, 11));
      const minute = parseInt(dateTimeStr.substring(11, 13));
      const second = parseInt(dateTimeStr.substring(13, 15));
      
      utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));
    } else if (dateTimeStr.includes('T')) {
      const year = parseInt(dateTimeStr.substring(0, 4));
      const month = parseInt(dateTimeStr.substring(4, 6)) - 1;
      const day = parseInt(dateTimeStr.substring(6, 8));
      const hour = parseInt(dateTimeStr.substring(9, 11));
      const minute = parseInt(dateTimeStr.substring(11, 13));
      const second = parseInt(dateTimeStr.substring(13, 15));
      
      const localTimeStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
      
      utcDate = fromZonedTime(localTimeStr, eventTimezone);
    } else {
      const year = parseInt(dateTimeStr.substring(0, 4));
      const month = parseInt(dateTimeStr.substring(4, 6)) - 1;
      const day = parseInt(dateTimeStr.substring(6, 8));
      
      const localTimeStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} 12:00:00`;
      utcDate = fromZonedTime(localTimeStr, targetTimezone);
    }
    
    return {
      date: formatInTimeZone(utcDate, targetTimezone, 'yyyy-MM-dd'),
      time: formatInTimeZone(utcDate, targetTimezone, 'HH:mm'),
    };
  } catch (error) {
    console.error('Error parsing iCal date/time:', dateTimeStr, error);
    return null;
  }
}

function unescapeICSText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}
