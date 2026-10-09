/**
 * Normalize an Uzbek mobile number to E.164 (+998XXXXXXXXX).
 * Accepts what people type or autofill: "90 123 45 67", "+998 (90) 123-45-67", "998901234567", "8 90 123 45 67".
 */
export function normalizeUzPhone(input: string): string | null {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("8")) digits = digits.slice(1); // old "8 90 …" habit
  if (digits.length === 9) digits = `998${digits}`;
  if (digits.length !== 12 || !digits.startsWith("998")) return null;
  // Operator/area codes start with 2–9 (no 0x/1x codes exist).
  if (!/^[2-9]\d$/.test(digits.slice(3, 5))) return null;
  return `+${digits}`;
}

/**
 * Input mask for the local part (the field shows a fixed "+998"). Renders "90 123 45 67".
 * Only strips a leading 998 when there are more than 9 digits, so Beeline "99 8…" numbers survive.
 */
export function maskLocalPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
  else if (d.length === 10 && d.startsWith("8")) d = d.slice(1);
  d = d.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}
