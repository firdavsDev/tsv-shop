import type { Locale } from "@/i18n";

const NBSP = " ";

/** 489000 → "489 000" with no-break spaces, so prices never wrap. */
export function formatNumber(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

export function formatPrice(n: number, locale: Locale): string {
  return `${formatNumber(n)}${NBSP}${locale === "uz" ? "soʻm" : "сум"}`;
}

/** +998901234567 → "+998 90 123 45 67" */
export function formatPhone(e164: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
