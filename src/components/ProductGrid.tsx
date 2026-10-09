import { getDict, type Locale } from "@/i18n";
import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products, locale }: { products: Product[]; locale: Locale }) {
  const t = getDict(locale);
  if (products.length === 0) {
    return <p className="px-4 py-16 text-center text-muted">{t.catalog.empty}</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-0.5 gap-y-7 sm:grid-cols-3 sm:gap-x-4 sm:px-4 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} locale={locale} priority={i < 2} />
        </li>
      ))}
    </ul>
  );
}
