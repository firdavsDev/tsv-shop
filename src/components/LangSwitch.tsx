"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getDict, type Locale } from "@/i18n";
import { CaretDownIcon, CheckIcon } from "./icons";

const LANGUAGES: { code: Locale; name: string }[] = [
  { code: "ru", name: "Русский" },
  { code: "uz", name: "Oʻzbekcha" },
];

/** Compact "RU ▾" dropdown (native <details>, works without JS) that keeps the current page. */
export function LangSwitch({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const pathname = usePathname() ?? `/${locale}`;
  const ref = useRef<HTMLDetailsElement>(null);
  const hrefFor = (code: Locale) => pathname.replace(/^\/(ru|uz)(?=\/|$)/, `/${code}`);

  // Close on a tap outside or Esc, like a native select.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const d = ref.current;
      if (d?.open && !d.contains(e.target as Node)) d.removeAttribute("open");
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const d = ref.current;
      if (e.key === "Escape" && d?.open) {
        d.removeAttribute("open");
        d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} key={locale} className="relative">
      <summary
        aria-label={`${t.nav.language}: ${LANGUAGES.find((l) => l.code === locale)?.name}`}
        className="flex h-11 cursor-pointer list-none items-center gap-1 px-2 text-[12px] tracking-[0.12em] text-cream [&::-webkit-details-marker]:hidden"
      >
        {locale.toUpperCase()}
        <CaretDownIcon />
      </summary>
      <ul className="absolute right-0 top-full z-40 mt-1 min-w-40 border border-noir-3 bg-noir py-1 shadow-lg shadow-black/40">
        {LANGUAGES.map((l) => {
          const current = l.code === locale;
          return (
            <li key={l.code}>
              <Link
                href={hrefFor(l.code)}
                hrefLang={l.code}
                lang={l.code}
                aria-current={current ? "true" : undefined}
                onClick={() => ref.current?.removeAttribute("open")}
                className={`flex h-11 items-center justify-between gap-4 px-4 text-[14px] ${current ? "text-gold" : "text-cream hover:text-gold"}`}
              >
                {l.name}
                {current && <CheckIcon />}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
