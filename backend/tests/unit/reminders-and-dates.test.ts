import { reminderStageFor } from '../../src/services/reminder.service';
import { calendarDay, calendarDaysBetween, startOfDay } from '../../src/utils/dates';
import { formatSequence, nextSequenceValue } from '../../src/utils/sequence';

describe('reminderStageFor', () => {
  it.each([
    [8, null],
    [7, '7d'],
    [5, '7d'],
    [3, '3d'],
    [2, '3d'],
    [1, '1d'],
    [0, '0d'],
    [-1, null],
  ])('%i days before the hearing -> %s', (days, stage) => {
    expect(reminderStageFor(days)).toBe(stage);
  });
});

describe('date helpers', () => {
  it('computes calendar days in a timezone, not 24h blocks', () => {
    const lateEvening = new Date('2026-03-10T23:30:00Z');
    const nextMorning = new Date('2026-03-11T08:00:00Z');
    expect(calendarDaysBetween(lateEvening, nextMorning, 'UTC')).toBe(1);
    expect(calendarDaysBetween(lateEvening, nextMorning, 'Asia/Tokyo')).toBe(0);
  });

  it('returns the start of the day in the requested timezone', () => {
    const date = new Date('2026-06-15T12:00:00Z');
    expect(startOfDay(date, 0, 'UTC').toISOString()).toBe('2026-06-15T00:00:00.000Z');
    expect(startOfDay(date, 1, 'Europe/Paris').toISOString()).toBe('2026-06-15T22:00:00.000Z');
    expect(calendarDay(date, 'UTC')).toBe('2026-06-15');
  });
});

describe('sequence helpers', () => {
  it('formats and increments identifiers', () => {
    expect(formatSequence('INV', 2026, 7)).toBe('INV-2026-0007');
    expect(nextSequenceValue('INV-2026-0041')).toBe(42);
    expect(nextSequenceValue(null)).toBe(1);
  });
});
