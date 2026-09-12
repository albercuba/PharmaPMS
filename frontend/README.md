# PharmaPMS Frontend

Modern React + TypeScript interface for PharmaPMS.

## Development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Localization

Translations live in `src/i18n/locales` and are loaded by `src/i18n/config.ts`.

To add a language:

1. Create a locale JSON file, for example `src/i18n/locales/fr-FR.json`.
2. Copy the shape of `en-US.json` and translate values only.
3. Add the locale to `supportedLocales` in `src/i18n/config.ts`.
4. If the language is right-to-left, set `direction: 'rtl'`.

Use translation keys in components via `useTranslation()` instead of hard-coded user-facing text.

Locale-aware formatting helpers are in `src/i18n/format.ts`.
