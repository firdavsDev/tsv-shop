"use client";

import Link from "next/link";
import { getDict, type Locale } from "@/i18n";
import { countItems, useCart } from "@/lib/cart";
import { BagIcon } from "./icons";

export function CartBadge({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const n = countItems(useCart());
  return (
    <Link
      href={`/${locale}/cart`}
      aria-label={n ? `${t.nav.cart}: ${n}` : t.nav.cart}
      className="relative grid size-11 place-items-center"
    >
      <BagIcon />
      {n > 0 && (
        <span
          aria-hidden
          className="absolute right-0.5 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[11px] font-medium leading-none text-noir"
        >
          {n}
        </span>
      )}
    </Link>
  );
}
