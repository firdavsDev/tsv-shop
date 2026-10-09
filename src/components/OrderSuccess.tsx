"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { getDict, type Locale } from "@/i18n";
import { formatPhone } from "@/lib/format";
import { site } from "@/lib/site";

export function OrderSuccess({ locale, id, phone }: { locale: Locale; id: string; phone: string }) {
  const t = getDict(locale);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus(); // announce the result to screen readers
  }, []);
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <div aria-hidden className="mx-auto grid size-14 place-items-center rounded-full border border-fg/30 text-2xl">
        ✓
      </div>
      <h1 ref={heading} tabIndex={-1} className="mt-6 font-display text-4xl outline-none">
        {t.success.title}
      </h1>
      <p className="label mt-3 text-muted">
        {t.success.order} <span className="tabular-nums text-fg">{id}</span>
      </p>
      <p className="mt-6 text-[16px] leading-relaxed">
        {t.success.callYou}
        <br />
        <b className="tabular-nums">{formatPhone(phone)}</b>
      </p>
      <p className="mt-1 text-muted">{t.success.toConfirm}</p>
      <div className="mt-10 grid gap-3">
        <Link href={`/${locale}`} className="label flex h-12 items-center justify-center bg-btn text-btn-fg">
          {t.success.continue}
        </Link>
        <a href={site.instagramUrl} target="_blank" rel="noopener" className="label flex h-12 items-center justify-center border border-fg">
          {t.success.instagram}
        </a>
      </div>
    </div>
  );
}
