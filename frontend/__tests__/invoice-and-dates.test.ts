import { isoToZonedInputs, zonedDateTimeToIso, zonedDay } from '@/lib/dates';
import { isAcceptedFile } from '@/lib/files';
import { computeInvoiceTotals } from '@/lib/invoice';

describe('computeInvoiceTotals', () => {
  it('computes line totals, subtotal, tax and total in cents', () => {
    const totals = computeInvoiceTotals(
      [
        { quantity: 2, unitPrice: 1500 },
        { quantity: 1.5, unitPrice: 800.5 },
      ],
      20,
    );
    expect(totals.lineTotals).toEqual([3000, 1200.75]);
    expect(totals.subtotal).toBe(4200.75);
    expect(totals.tax).toBe(840.15);
    expect(totals.total).toBe(5040.9);
  });

  it('avoids floating point drift', () => {
    const totals = computeInvoiceTotals([{ quantity: 3, unitPrice: 0.1 }], 0);
    expect(totals.total).toBe(0.3);
  });

  it('treats invalid numbers as zero', () => {
    const totals = computeInvoiceTotals([{ quantity: Number.NaN, unitPrice: 100 }], 20);
    expect(totals.total).toBe(0);
  });
});

describe('firm timezone conversions', () => {
  it('converts a wall-clock time in UTC+1 to the right instant', () => {
    expect(zonedDateTimeToIso('2026-01-15', '10:00', 'Europe/Paris')).toBe(
      '2026-01-15T09:00:00.000Z',
    );
  });

  it('handles daylight saving time', () => {
    expect(zonedDateTimeToIso('2026-07-15', '10:00', 'Europe/Paris')).toBe(
      '2026-07-15T08:00:00.000Z',
    );
  });

  it('round-trips an instant to date and time inputs', () => {
    const iso = zonedDateTimeToIso('2026-03-02', '08:30', 'Africa/Casablanca');
    expect(isoToZonedInputs(iso, 'Africa/Casablanca')).toEqual({
      date: '2026-03-02',
      time: '08:30',
    });
  });

  it('computes the calendar day in the firm timezone, not UTC', () => {
    expect(zonedDay('2026-01-15T23:30:00.000Z', 'Europe/Paris')).toBe('2026-01-16');
    expect(zonedDay('2026-01-15T23:30:00.000Z', 'UTC')).toBe('2026-01-15');
  });
});

describe('isAcceptedFile', () => {
  it('accepts whitelisted extensions only', () => {
    expect(isAcceptedFile(new File(['x'], 'jugement.PDF'))).toBe(true);
    expect(isAcceptedFile(new File(['x'], 'photo.jpeg'))).toBe(true);
    expect(isAcceptedFile(new File(['x'], 'script.exe'))).toBe(false);
    expect(isAcceptedFile(new File(['x'], 'page.html'))).toBe(false);
  });
});
