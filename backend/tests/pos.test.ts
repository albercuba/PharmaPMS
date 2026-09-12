import { describe, expect, it } from 'vitest';
import { calculateSaleTotals } from '../src/modules/pos/pos.service.js';

describe('POS calculations', () => {
  it('calculates subtotal, discount, tax, and total from sale snapshots', () => {
    expect(
      calculateSaleTotals([
        { quantity: 2, unitPrice: 10, taxRate: 0.1, discountAmount: 1 },
        { quantity: 1, unitPrice: 5, taxRate: 0 },
      ]),
    ).toEqual({ subtotal: 25, discountTotal: 1, taxTotal: 1.9, total: 25.9 });
  });

  it('does not allow a discount to produce a negative taxable amount', () => {
    expect(
      calculateSaleTotals([
        { quantity: 1, unitPrice: 5, taxRate: 0.2, discountAmount: 10 },
      ]),
    ).toEqual({ subtotal: 5, discountTotal: 10, taxTotal: 0, total: 0 });
  });
});
