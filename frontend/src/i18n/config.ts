import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enUS from "./locales/en-US.json";
import deDE from "./locales/de-DE.json";
import arSA from "./locales/ar-SA.json";

export type SupportedLocale = "en-US" | "de-DE" | "ar-SA";
export type TextDirection = "ltr" | "rtl";

export const defaultLocale: SupportedLocale = "en-US";

export const supportedLocales: Record<
  SupportedLocale,
  { label: string; direction: TextDirection; currency: string }
> = {
  "en-US": { label: "English", direction: "ltr", currency: "USD" },
  "de-DE": { label: "Deutsch", direction: "ltr", currency: "EUR" },
  "ar-SA": { label: "العربية", direction: "rtl", currency: "SAR" },
};

const resources = {
  "en-US": { translation: enUS },
  "de-DE": { translation: deDE },
  "ar-SA": { translation: arSA },
};

const savedLocale = window.localStorage.getItem(
  "pharmapms.locale",
) as SupportedLocale | null;
const initialLocale =
  savedLocale && savedLocale in supportedLocales ? savedLocale : defaultLocale;

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: defaultLocale,
  interpolation: {
    escapeValue: false,
  },
});

export function applyDocumentLocale(locale: SupportedLocale) {
  const metadata = supportedLocales[locale];
  document.documentElement.lang = locale;
  document.documentElement.dir = metadata.direction;
  window.localStorage.setItem("pharmapms.locale", locale);
}

applyDocumentLocale(initialLocale);

export default i18n;
