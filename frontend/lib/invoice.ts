export interface InvoiceLine {
  quantity: number;
  unitPrice: number;
}

const cents = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100);

/**
 * Live preview of invoice totals. Mirrors the server algorithm (integer cents);
 * the API remains the source of truth and recomputes on save.
 */
export function computeInvoiceTotals(lines: InvoiceLine[], taxRate: number) {
  const lineTotals = lines.map((line) =>
    Math.round((cents(line.quantity) * cents(line.unitPrice)) / 100),
  );
  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0);
  const tax = Math.round((subtotal * cents(taxRate)) / 10000);
  return {
    lineTotals: lineTotals.map((value) => value / 100),
    subtotal: subtotal / 100,
    tax: tax / 100,
    total: (subtotal + tax) / 100,
  };
}
