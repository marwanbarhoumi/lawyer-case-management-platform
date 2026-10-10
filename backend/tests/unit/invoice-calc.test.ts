import { calculateInvoiceTotals, invoiceBalance } from '../../src/utils/invoice-calc';

describe('calculateInvoiceTotals', () => {
  it('computes line totals, subtotal, tax and total', () => {
    const result = calculateInvoiceTotals(
      [
        { description: 'Consultation', quantity: 2, unitPrice: 1500 },
        { description: 'Drafting', quantity: 1, unitPrice: 4000 },
      ],
      20,
    );
    expect(result.items.map((item) => item.total)).toEqual([3000, 4000]);
    expect(result.items.map((item) => item.position)).toEqual([0, 1]);
    expect(result.subtotal).toBe(7000);
    expect(result.tax).toBe(1400);
    expect(result.total).toBe(8400);
  });

  it('avoids floating point drift with decimals', () => {
    const result = calculateInvoiceTotals(
      [
        { description: 'A', quantity: 3, unitPrice: 0.1 },
        { description: 'B', quantity: 1.5, unitPrice: 33.33 },
      ],
      7,
    );
    expect(result.items[0].total).toBe(0.3);
    expect(result.items[1].total).toBe(50);
    expect(result.subtotal).toBe(50.3);
    expect(result.tax).toBe(3.52);
    expect(result.total).toBe(53.82);
  });

  it('supports a zero tax rate', () => {
    const result = calculateInvoiceTotals(
      [{ description: 'A', quantity: 1, unitPrice: 999.99 }],
      0,
    );
    expect(result.tax).toBe(0);
    expect(result.total).toBe(999.99);
  });
});

describe('invoiceBalance', () => {
  it('returns the remaining amount and never goes negative', () => {
    expect(invoiceBalance(100.1, 40.05)).toBe(60.05);
    expect(invoiceBalance(100, 150)).toBe(0);
  });
});
