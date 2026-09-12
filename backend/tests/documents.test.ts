import { describe, expect, it } from 'vitest';
import { renderReceipt } from '../src/modules/documents/document.service.js';

describe('document rendering', () => {
  it('renders receipt totals using the requested locale and Unicode safely', () => {
    const html = renderReceipt({
      locale: 'de-DE',
      receiptNumber: 'R-1',
      currency: 'EUR',
      createdAt: '2026-09-12T10:00:00Z',
      items: [{ name: 'Müller & Sohn', quantity: 2, lineTotal: 12.5 }],
      total: 12.5,
    });
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('Müller &amp; Sohn');
    expect(html).toContain('12,50');
  });

  it('falls back to English for unsupported document locales', () => {
    const html = renderReceipt({
      locale: 'tr-TR',
      receiptNumber: 'R-2',
      currency: 'USD',
      createdAt: new Date(),
      items: [],
      total: 0,
    });
    expect(html).toContain('lang="en-US"');
    expect(html).toContain('Receipt');
  });
});
