import type { Locale } from "@/i18n";

/** Uzbek text when present, otherwise Russian (Russian is always filled in). */
export function pick(locale: Locale, ru: string, uz?: string | null): string {
  return locale === "uz" && uz?.trim() ? uz : ru;
}

export function pickOptional(locale: Locale, ru: string | null, uz: string | null): string | null {
  return locale === "uz" && uz?.trim() ? uz : ru;
}
