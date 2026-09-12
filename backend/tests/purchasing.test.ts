import { describe, expect, it } from 'vitest';
import { isValidPurchaseOrderTransition } from '../src/modules/purchasing/purchasing.service.js';

describe('purchase order lifecycle', () => {
  it('allows submission and receiving transitions', () => {
    expect(isValidPurchaseOrderTransition('DRAFT', 'SUBMITTED')).toBe(true);
    expect(
      isValidPurchaseOrderTransition('SUBMITTED', 'PARTIALLY_RECEIVED'),
    ).toBe(true);
    expect(
      isValidPurchaseOrderTransition('PARTIALLY_RECEIVED', 'RECEIVED'),
    ).toBe(true);
  });

  it('rejects reopening completed or cancelled orders', () => {
    expect(isValidPurchaseOrderTransition('RECEIVED', 'SUBMITTED')).toBe(false);
    expect(isValidPurchaseOrderTransition('CANCELLED', 'RECEIVED')).toBe(false);
    expect(isValidPurchaseOrderTransition('DRAFT', 'RECEIVED')).toBe(false);
  });
});
