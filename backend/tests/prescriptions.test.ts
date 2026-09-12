import { describe, expect, it } from 'vitest';
import { isValidPrescriptionTransition } from '../src/modules/prescriptions/prescriptions.service.js';

describe('prescription safety state machine', () => {
  it('requires verification before dispensing states', () => {
    expect(isValidPrescriptionTransition('DRAFT', 'RECEIVED')).toBe(true);
    expect(
      isValidPrescriptionTransition('RECEIVED', 'AWAITING_VERIFICATION'),
    ).toBe(true);
    expect(
      isValidPrescriptionTransition('AWAITING_VERIFICATION', 'VERIFIED'),
    ).toBe(true);
    expect(isValidPrescriptionTransition('RECEIVED', 'DISPENSED')).toBe(false);
  });

  it('does not reopen completed or cancelled prescriptions', () => {
    expect(isValidPrescriptionTransition('DISPENSED', 'VERIFIED')).toBe(false);
    expect(isValidPrescriptionTransition('CANCELLED', 'RECEIVED')).toBe(false);
    expect(isValidPrescriptionTransition('VERIFIED', 'CANCELLED')).toBe(true);
  });
});
