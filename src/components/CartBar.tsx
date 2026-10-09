"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict, type Locale } from "@/i18n";
import { cartTotal, countItems, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

/** Sticky bottom bar on phones once the cart has items. Hidden on the cart page itself. */
export function CartBar({ locale }: { locale: Locale }) {
  const lines = useCart();
  const pathname = usePathname() ?? "";
  const t = getDict(locale);
  const n = countItems(lines);
  if (n === 0 || pathname.endsWith("/cart")) return null;
  return (
    <>
      {/* Room for the fixed bar under the footer; noir so it reads as part of the footer, not a white strip. */}
      <div className="h-16 bg-noir md:hidden" aria-hidden />
      <Link
        href={`/${locale}/cart`}
        className="label fixed inset-x-0 bottom-0 z-30 flex min-h-14 items-center justify-between bg-bar px-5 font-medium text-bar-fg md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <span>
          {t.cart.bar} · {n}
        </span>
        <span className="tabular-nums text-bar-accent">{formatPrice(cartTotal(lines), locale)} →</span>
      </Link>
    </>
  );
}
