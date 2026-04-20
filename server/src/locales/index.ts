import vi from './vi.json';
import en from './en.json';

type NestedRecord = { [key: string]: string | NestedRecord };

const translations: Record<string, NestedRecord> = { vi, en };

let currentLang = 'vi';

export function setLanguage(lang: string) {
  if (translations[lang]) currentLang = lang;
}

export function getLanguage(): string {
  return currentLang;
}

export function t(key: string, params?: Record<string, string | number>): string {
  return translate(currentLang, key, params);
}

export function createT(lang: string) {
  const safeLang = translations[lang] ? lang : 'vi';
  return (key: string, params?: Record<string, string | number>) => translate(safeLang, key, params);
}

function translate(lang: string, key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: unknown = translations[lang] || translations.vi;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }

  if (typeof value !== 'string') return key;

  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? `{{${k}}}`));
  }

  return value;
}
