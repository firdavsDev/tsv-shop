import Link from "next/link";
import { getDict, type Locale } from "@/i18n";
import { formatNumber, formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import { pick } from "@/lib/localize";
import type { Product } from "@/lib/types";

export function ProductCard({ product: p, locale, priority }: { product: Product; locale: Locale; priority: boolean }) {
  const t = getDict(locale);
  const title = pick(locale, p.title_ru, p.title_uz);
  const img = p.images[0];
  return (
    <Link href={`/${locale}/p/${p.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-well">
        {img ? (
          <img
            src={imageUrl(img, 480)}
            alt={title}
            width={480}
            height={640}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span aria-hidden className="grid size-full place-items-center font-display text-3xl tracking-[0.14em] text-muted/40">
            TSV
          </span>
        )}
        {p.is_new && (
          <span className="absolute left-2 top-2 bg-noir px-1.5 py-0.5 text-[11px] tracking-[0.12em] text-gold">
            {t.catalog.newBadge}
          </span>
        )}
        {!p.in_stock && (
          <span className="label absolute inset-x-0 bottom-0 bg-noir/85 py-2 text-center text-cream">{t.catalog.soldOut}</span>
        )}
      </div>
      <div className="px-2 pt-2 sm:px-0">
        <p className="line-clamp-2 text-[12px] uppercase leading-snug tracking-[0.06em]">{title}</p>
        <p className="mt-1 text-[14px] font-medium tabular-nums text-price">
          {formatPrice(p.price, locale)}
          {p.old_price && <s className="ml-2 text-[12px] font-normal text-muted">{formatNumber(p.old_price)}</s>}
        </p>
      </div>
    </Link>
  );
}
