"use client";

import Link from "next/link";
import { useState } from "react";
import { getDict, type Locale } from "@/i18n";
import { cart, lineKey, useCart } from "@/lib/cart";
import { pick } from "@/lib/localize";
import type { Color } from "@/lib/types";

export type BuyProduct = {
  id: string;
  slug: string;
  title_ru: string;
  title_uz: string | null;
  price: number;
  image: string | null;
  sizes: string[];
  soldOutSizes: string[];
  inStock: boolean;
  colors: Color[];
};

export function ProductBuy({ product: p, locale }: { product: BuyProduct; locale: Locale }) {
  const t = getDict(locale);
  const available = p.sizes.filter((s) => !p.soldOutSizes.includes(s));
  const [size, setSize] = useState<string | null>(p.sizes.length === 1 && available.length === 1 ? available[0] : null);
  const [colorId, setColorId] = useState<string | null>(p.colors.length === 1 ? p.colors[0].id : null);
  const [hint, setHint] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const lines = useCart();

  const color = p.colors.find((c) => c.id === colorId) ?? null;
  const canBuy = p.inStock && (p.sizes.length === 0 || available.length > 0);
  // This exact size + colour is already in the cart → offer the way to the cart instead of adding again.
  const chosen = (p.sizes.length === 0 || size !== null) && (p.colors.length === 0 || color !== null);
  const key = lineKey({ productId: p.id, size, colorId: color?.id ?? null });
  const inCart = chosen && lines.some((l) => lineKey(l) === key);

  function add() {
    if (p.sizes.length && !size) return setHint(t.product.chooseSize);
    if (p.colors.length && !color) return setHint(t.product.chooseColor);
    cart.add({
      productId: p.id,
      slug: p.slug,
      size,
      colorId: color?.id ?? null,
      qty: 1,
      snapshot: {
        title_ru: p.title_ru,
        title_uz: p.title_uz,
        price: p.price,
        image: p.image,
        color_ru: color?.name_ru ?? null,
        color_uz: color?.name_uz ?? null,
      },
    });
    setHint(null);
    setAnnounce(t.product.added);
  }

  return (
    <div className="mt-6 space-y-6">
      {p.sizes.length > 0 && (
        <fieldset>
          <legend className="label mb-2 text-muted">{t.product.size}</legend>
          <div className="flex flex-wrap gap-2">
            {p.sizes.map((s) => {
              const out = p.soldOutSizes.includes(s);
              const on = size === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={out}
                  aria-pressed={on}
                  onClick={() => {
                    setSize(s);
                    setHint(null);
                  }}
                  className={`h-11 min-w-11 border px-3 text-[14px] ${on ? "border-fg bg-fg text-bg" : "border-line"} disabled:text-muted disabled:line-through`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {p.colors.length > 0 && (
        <fieldset>
          <legend className="label mb-2 text-muted">
            {t.product.color}
            {color && <span className="ml-2 normal-case tracking-normal text-fg">{pick(locale, color.name_ru, color.name_uz)}</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {p.colors.map((c) => {
              const on = colorId === c.id;
              const name = pick(locale, c.name_ru, c.name_uz);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={name}
                  title={name}
                  onClick={() => {
                    setColorId(c.id);
                    setHint(null);
                  }}
                  className={`grid size-11 place-items-center rounded-full ${on ? "ring-1 ring-fg" : ""}`}
                >
                  <span className="size-7 rounded-full border border-line" style={{ background: c.hex }} />
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {hint && (
        <p role="alert" className="text-[14px] text-danger">
          {hint}
        </p>
      )}

      {inCart ? (
        <Link
          href={`/${locale}/cart`}
          className="label flex h-12 w-full items-center justify-center gap-2 bg-btn font-medium text-btn-fg"
        >
          {t.product.goToCart} <span aria-hidden>→</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={add}
          disabled={!canBuy}
          className="label h-12 w-full bg-btn font-medium text-btn-fg disabled:opacity-40"
        >
          {canBuy ? t.product.add : t.product.soldOut}
        </button>
      )}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
