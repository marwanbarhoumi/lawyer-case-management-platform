import { APP_TIMEZONE } from '@/i18n/config';

function zonedParts(date: Date, timeZone: string) {
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
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Converts a wall-clock date + time in the firm's timezone into an ISO instant.
 * Independent of the browser timezone, so every user enters hearings the same way.
 */
export function zonedDateTimeToIso(date: string, time: string, timeZone = APP_TIMEZONE): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const parts = zonedParts(new Date(asUtc), timeZone);
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  const offset = zonedAsUtc - asUtc;
  return new Date(asUtc - offset).toISOString();
}

/** Splits an ISO instant into `YYYY-MM-DD` and `HH:mm` in the firm's timezone. */
export function isoToZonedInputs(
  iso: string,
  timeZone = APP_TIMEZONE,
): { date: string; time: string } {
  const parts = zonedParts(new Date(iso), timeZone);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** `YYYY-MM-DD` of an instant in the firm's timezone. */
export function zonedDay(date: Date | string, timeZone = APP_TIMEZONE): string {
  return isoToZonedInputs(typeof date === 'string' ? date : date.toISOString(), timeZone).date;
}

/** Value for `<input type="date">` from an ISO string (or empty). */
export function toDateInput(value: string | null | undefined): string {
  return value ? zonedDay(value) : '';
}

/** Calendar days from today until the given instant, in the firm's timezone (negative when past). */
export function daysUntil(value: string | Date): number {
  const toUtc = (day: string) =>
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  return Math.round((toUtc(zonedDay(value)) - toUtc(todayInput())) / 86_400_000);
}

export function todayInput(offsetDays = 0): string {
  return zonedDay(new Date(Date.now() + offsetDays * 86_400_000));
}
