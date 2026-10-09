import { ru, type Dict } from "./ru";
import { uz } from "./uz";

export const locales = ["ru", "uz"] as const;
export type Locale = (typeof locales)[number];
export type { Dict };

export function isLocale(v: string): v is Locale {
  return v === "ru" || v === "uz";
}

const dicts: Record<Locale, Dict> = { ru, uz };

export function getDict(locale: Locale): Dict {
  return dicts[locale];
}
