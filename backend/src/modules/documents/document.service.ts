import type { PrismaClient } from '@prisma/client';
import { selectLocale, supportedLocales } from '../localization/locale.js';

export type DocumentKind =
  | 'PRESCRIPTION_LABEL'
  | 'PATIENT_INSTRUCTIONS'
  | 'RECEIPT'
  | 'INVOICE'
  | 'PURCHASE_ORDER'
  | 'BARCODE_LABEL'
  | 'PRICE_LABEL';
const labels = {
  'en-US': {
    prescription: 'Prescription label',
    instructions: 'Patient instructions',
    receipt: 'Receipt',
    invoice: 'Invoice',
    purchase: 'Purchase order',
    patient: 'Patient',
    medicine: 'Medicine',
    quantity: 'Quantity',
    instructionsText: 'Instructions',
    total: 'Total',
    date: 'Date',
    notTranslated:
      'Validated translation unavailable; original instructions shown.',
  },
  'de-DE': {
    prescription: 'Rezeptetikett',
    instructions: 'Patientenhinweise',
    receipt: 'Quittung',
    invoice: 'Rechnung',
    purchase: 'Bestellung',
    patient: 'Patient',
    medicine: 'Arzneimittel',
    quantity: 'Menge',
    instructionsText: 'Anweisung',
    total: 'Gesamt',
    date: 'Datum',
    notTranslated:
      'Keine geprüfte Übersetzung verfügbar; Originalanweisung wird angezeigt.',
  },
  'ar-SA': {
    prescription: 'ملصق الوصفة',
    instructions: 'تعليمات المريض',
    receipt: 'إيصال',
    invoice: 'فاتورة',
    purchase: 'أمر شراء',
    patient: 'المريض',
    medicine: 'الدواء',
    quantity: 'الكمية',
    instructionsText: 'التعليمات',
    total: 'الإجمالي',
    date: 'التاريخ',
    notTranslated: 'لا تتوفر ترجمة معتمدة؛ تظهر التعليمات الأصلية.',
  },
} as const;
function escapeHtml(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] as string,
  );
}
function localeFor(requested?: string) {
  return selectLocale(requested);
}
function shell(locale: string, title: string, body: string) {
  const direction = supportedLocales[locale]?.direction ?? 'ltr';
  return `<!doctype html><html lang="${escapeHtml(locale)}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;direction:${direction};margin:2rem;max-width:48rem}table{border-collapse:collapse;width:100%}th,td{text-align:start;border-bottom:1px solid #ccc;padding:.6rem}.notice{border:1px solid #b96b00;padding:.75rem}</style></head><body>${body}</body></html>`;
}

export function renderReceipt(input: {
  locale?: string;
  receiptNumber: string;
  currency: string;
  createdAt: Date | string;
  items: Array<{ name: string; quantity: number; lineTotal: number }>;
  total: number;
}) {
  const locale = localeFor(input.locale);
  const t = labels[locale as keyof typeof labels] ?? labels['en-US'];
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(input.createdAt));
  const rows = input.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${new Intl.NumberFormat(locale, { style: 'currency', currency: input.currency }).format(item.lineTotal)}</td></tr>`,
    )
    .join('');
  return shell(
    locale,
    t.receipt,
    `<h1>${t.receipt}</h1><p>${escapeHtml(input.receiptNumber)} · ${escapeHtml(date)}</p><table><thead><tr><th>${t.medicine}</th><th>${t.quantity}</th><th>${t.total}</th></tr></thead><tbody>${rows}</tbody></table><h2>${t.total}: ${new Intl.NumberFormat(locale, { style: 'currency', currency: input.currency }).format(input.total)}</h2>`,
  );
}

export async function renderPrescriptionDocument(
  db: PrismaClient,
  input: {
    organizationId: string;
    prescriptionId: string;
    requestedLocale?: string;
    kind: 'PRESCRIPTION_LABEL' | 'PATIENT_INSTRUCTIONS';
  },
) {
  const prescription = await db.prescription.findFirst({
    where: { id: input.prescriptionId, organizationId: input.organizationId },
    include: { patient: true, items: true },
  });
  if (!prescription) throw new Error('Prescription was not found');
  const locale = localeFor(
    input.requestedLocale ?? prescription.patient.preferredLocale,
  );
  const t = labels[locale as keyof typeof labels] ?? labels['en-US'];
  const title =
    input.kind === 'PRESCRIPTION_LABEL' ? t.prescription : t.instructions;
  const rows = prescription.items
    .map((item) => {
      const mismatch =
        item.instructionsLocale !== locale && item.instructionsLocale !== 'und';
      return `<section><h2>${escapeHtml(item.medicineNameSnapshot)}${item.strengthSnapshot ? ` · ${escapeHtml(item.strengthSnapshot)}` : ''}</h2><p><strong>${t.quantity}:</strong> ${item.prescribedQuantity}</p><p><strong>${t.instructionsText}:</strong> ${escapeHtml(item.dosageInstructions)}</p>${mismatch ? `<p class="notice">${t.notTranslated}</p>` : ''}</section>`;
    })
    .join('');
  return {
    locale,
    patientLocale: prescription.patient.preferredLocale,
    html: shell(
      locale,
      title,
      `<h1>${title}</h1><p>${t.patient}: ${escapeHtml(prescription.patient.firstName)} ${escapeHtml(prescription.patient.lastName)}</p>${rows}`,
    ),
  };
}

export async function renderSaleReceipt(
  db: PrismaClient,
  input: { organizationId: string; saleId: string; requestedLocale?: string },
) {
  const sale = await db.sale.findFirst({
    where: { id: input.saleId, organizationId: input.organizationId },
    include: {
      items: { include: { product: { include: { translations: true } } } },
    },
  });
  if (!sale) throw new Error('Sale was not found');
  const locale = localeFor(input.requestedLocale);
  return renderReceipt({
    locale,
    receiptNumber: sale.receiptNumber,
    currency: sale.currency,
    createdAt: sale.createdAt,
    total: Number(sale.total),
    items: sale.items.map((item) => ({
      name:
        item.product.translations.find(
          (translation) => translation.locale === locale,
        )?.displayName ??
        item.product.translations[0]?.displayName ??
        item.product.sku ??
        item.product.id,
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
    })),
  });
}
