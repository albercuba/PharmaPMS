import { describe, expect, it } from 'vitest';
import {
  selectLocale,
  supportedLocales,
} from '../src/modules/localization/locale.js';

describe('localization', () => {
  it('supports example LTR and RTL locales', () => {
    expect(supportedLocales['en-US'].direction).toBe('ltr');
    expect(supportedLocales['ar-SA'].direction).toBe('rtl');
  });

  it('falls back when a locale is unavailable', () => {
    expect(selectLocale('fr-FR')).toBe('en-US');
    expect(selectLocale('de-DE')).toBe('de-DE');
    expect(selectLocale('de')).toBe('de-DE');
    expect(selectLocale(undefined, 'de-DE')).toBe('de-DE');
  });
});
