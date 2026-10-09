"use client";

import { useRef, useState } from "react";
import { getDict, type Locale } from "@/i18n";
import { imageUrl } from "@/lib/images";
import { ChevronIcon } from "./icons";

/** Swipeable photos (CSS scroll-snap). Counter + dots; arrow buttons on wider screens. */
export function Gallery({ images, alt, locale }: { images: string[]; alt: string; locale: Locale }) {
  const t = getDict(locale);
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div aria-hidden className="grid aspect-[3/4] place-items-center bg-well font-display text-4xl tracking-[0.14em] text-muted/40">
        TSV
      </div>
    );
  }

  const onScroll = () => {
    const el = ref.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (delta: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: (index + delta) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={ref} onScroll={onScroll} className="snap-strip flex overflow-x-auto" aria-label={alt}>
        {images.map((key, n) => (
          <img
            key={key}
            src={imageUrl(key, 1200)}
            alt={`${alt} — ${n + 1}`}
            width={1200}
            height={1600}
            loading={n === 0 ? "eager" : "lazy"}
            fetchPriority={n === 0 ? "high" : undefined}
            decoding="async"
            className="aspect-[3/4] w-full shrink-0 bg-well object-cover"
          />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <span className="absolute right-3 top-3 bg-bg/85 px-2 py-0.5 text-[12px] tabular-nums text-fg">
            {t.product.photoOf(index + 1, images.length)}
          </span>
          <div aria-hidden className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((key, n) => (
              <span key={key} className={`size-1.5 rounded-full bg-fg ${n === index ? "" : "opacity-30"}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label={t.product.prev}
            className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center bg-bg/85 text-fg disabled:opacity-0 md:grid"
          >
            <ChevronIcon dir="left" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === images.length - 1}
            aria-label={t.product.next}
            className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center bg-bg/85 text-fg disabled:opacity-0 md:grid"
          >
            <ChevronIcon dir="right" />
          </button>
        </>
      )}
    </div>
  );
}
