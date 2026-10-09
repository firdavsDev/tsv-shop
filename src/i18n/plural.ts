/** Russian plural forms: [1 товар, 2 товара, 5 товаров]. */
export function pluralRu(n: number, forms: [one: string, few: string, many: string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}
