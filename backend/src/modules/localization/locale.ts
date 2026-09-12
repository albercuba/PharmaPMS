export type LocaleMetadata = {
  label: string;
  direction: 'ltr' | 'rtl';
  currency: string;
};

export const supportedLocales: Record<string, LocaleMetadata> = {
  'en-US': { label: 'English', direction: 'ltr', currency: 'USD' },
  'de-DE': { label: 'Deutsch', direction: 'ltr', currency: 'EUR' },
  'ar-SA': { label: 'العربية', direction: 'rtl', currency: 'SAR' },
};

export function selectLocale(
  requested: string | null | undefined,
  fallback = 'en-US',
) {
  if (requested && requested in supportedLocales) return requested;
  if (requested) {
    const language = requested.split('-')[0]?.toLowerCase();
    const regionalLocale = Object.keys(supportedLocales).find(
      (locale) => locale.split('-')[0]?.toLowerCase() === language,
    );
    if (regionalLocale) return regionalLocale;
  }
  if (fallback in supportedLocales) return fallback;
  return 'en-US';
}
