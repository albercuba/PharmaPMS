import type { FastifyRequest } from 'fastify';
import { ZodError, type ZodIssue } from 'zod';
import enUS from './locales/en-US.json' with { type: 'json' };
import deDE from './locales/de-DE.json' with { type: 'json' };
import arSA from './locales/ar-SA.json' with { type: 'json' };
import { selectLocale } from './locale.js';

const catalogs = { 'en-US': enUS, 'de-DE': deDE, 'ar-SA': arSA } as const;
type ErrorKey = keyof typeof enUS.errors;

export function resolveRequestLocale(
  request: FastifyRequest,
  preferredLocale?: string,
) {
  const requested =
    request.headers['x-ui-locale'] ?? request.headers['accept-language'];
  const requestedLocale = Array.isArray(requested)
    ? requested[0]
    : requested
        ?.split(',')[0]
        ?.trim()
        .replace(/;q=.*$/, '');
  return selectLocale(preferredLocale ?? requestedLocale);
}

function messageFor(locale: string, key: ErrorKey) {
  const catalog =
    catalogs[locale as keyof typeof catalogs] ?? catalogs['en-US'];
  return catalog.errors[key] ?? catalogs['en-US'].errors[key];
}

function validationKey(issue: ZodIssue): ErrorKey {
  if (
    issue.code === 'invalid_format' &&
    'format' in issue &&
    issue.format === 'email'
  )
    return 'invalidEmail';
  if (issue.code === 'too_small') return 'tooShort';
  if (
    issue.code === 'invalid_type' &&
    'received' in issue &&
    issue.received === 'undefined'
  )
    return 'required';
  return 'invalidFormat';
}

export function localizedValidationError(
  request: FastifyRequest,
  error: ZodError,
) {
  const locale = resolveRequestLocale(request);
  return {
    error: 'VALIDATION_ERROR',
    message: messageFor(locale, 'validation'),
    locale,
    details: error.issues.map((issue) => ({
      path: issue.path,
      code: issue.code,
      message: messageFor(locale, validationKey(issue)),
    })),
  };
}

export function localizedApiError(
  request: FastifyRequest,
  code: string,
  key: ErrorKey,
) {
  const locale = resolveRequestLocale(request);
  return { error: code, message: messageFor(locale, key), locale };
}
