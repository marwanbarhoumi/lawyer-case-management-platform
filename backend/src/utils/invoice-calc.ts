export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceLineResult extends InvoiceLineInput {
  total: number;
  /** Zero-based line order, persisted so the invoice prints in the order it was entered. */
  position: number;
}

export interface InvoiceTotals {
  items: InvoiceLineResult[];
  subtotal: number;
  tax: number;
  total: number;
}

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

/**
 * Computes line totals, subtotal, tax and total using integer cents to avoid
 * floating-point drift. Each line is rounded to the cent, then tax is applied
 * on the rounded subtotal.
 */
export function calculateInvoiceTotals(
  items: InvoiceLineInput[],
  taxRatePercent: number,
): InvoiceTotals {
  const lines = items.map((item) => {
    const quantityHundredths = toCents(item.quantity);
    const lineCents = Math.round((quantityHundredths * toCents(item.unitPrice)) / 100);
    return { ...item, totalCents: lineCents };
  });
  const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const taxCents = Math.round((subtotalCents * toCents(taxRatePercent)) / 10000);
  return {
    items: lines.map(({ totalCents, ...line }, position) => ({
      ...line,
      total: fromCents(totalCents),
      position,
    })),
    subtotal: fromCents(subtotalCents),
    tax: fromCents(taxCents),
    total: fromCents(subtotalCents + taxCents),
  };
}

/** Remaining balance in currency units, never negative. */
export function invoiceBalance(total: number, amountPaid: number): number {
  return Math.max(0, fromCents(toCents(total) - toCents(amountPaid)));
}
