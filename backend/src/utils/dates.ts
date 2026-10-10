import { env } from '../config/env';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Returns the calendar date (YYYY-MM-DD) of an instant in the given timezone. */
export function calendarDay(date: Date, timeZone = env.APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Number of calendar days between two instants in the given timezone (target - from). */
export function calendarDaysBetween(from: Date, target: Date, timeZone = env.APP_TIMEZONE): number {
  const toUtc = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round(
    (toUtc(calendarDay(target, timeZone)) - toUtc(calendarDay(from, timeZone))) / DAY_MS,
  );
}

/** Offset in milliseconds between UTC and the given timezone at the given instant. */
function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Start of the calendar day (00:00 in the timezone) containing `date`, shifted by `addDays`. */
export function startOfDay(date: Date, addDays = 0, timeZone = env.APP_TIMEZONE): Date {
  const [y, m, d] = calendarDay(date, timeZone).split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d + addDays);
  const offset = timezoneOffsetMs(new Date(utcMidnight), timeZone);
  return new Date(utcMidnight - offset);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Start of the month containing `date`, shifted by `addMonths`, in the timezone. */
export function startOfMonth(date: Date, addMonths = 0, timeZone = env.APP_TIMEZONE): Date {
  const [y, m] = calendarDay(date, timeZone).split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1 + addMonths, 1);
  const offset = timezoneOffsetMs(new Date(utcMidnight), timeZone);
  return new Date(utcMidnight - offset);
}

export function monthKey(date: Date, timeZone = env.APP_TIMEZONE): string {
  return calendarDay(date, timeZone).slice(0, 7);
}
