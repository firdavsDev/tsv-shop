"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getDict, type Locale } from "@/i18n";
import { formatPhone } from "@/lib/format";
import { site, telegramBotUrl } from "@/lib/site";
import { CloseIcon, MenuIcon } from "./icons";

type Item = { slug: string; name: string };

export function Menu({ locale, categories }: { locale: Locale; categories: Item[] }) {
  const t = getDict(locale);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const close = () => ref.current?.close();
  const bot = telegramBotUrl();

  useEffect(() => {
    ref.current?.close(); // navigation happened: close the drawer
  }, [pathname]);

  const link = "flex h-11 items-center label";
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label={t.nav.menu}
        aria-haspopup="dialog"
        className="grid size-11 place-items-center"
      >
        <MenuIcon />
      </button>
      <dialog
        ref={ref}
        aria-label={t.nav.menu}
        className="drawer bg-bg text-fg"
        onClick={(e) => {
          if (e.target === e.currentTarget) close(); // click on the backdrop
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between bg-noir px-2 text-cream">
            <button type="button" onClick={close} aria-label={t.nav.close} className="grid size-11 place-items-center">
              <CloseIcon />
            </button>
            <span className="pr-4 font-display text-xl tracking-[0.14em] text-gold">TSV</span>
          </div>
          <nav aria-label={t.nav.categories} className="flex-1 overflow-y-auto px-5 py-4">
            <ul>
              <li>
                <Link href={`/${locale}`} onClick={close} className={link}>
                  {t.nav.all}
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/${locale}/c/${c.slug}`} onClick={close} className={link}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-8 border-t border-line pt-4 text-[15px]">
              <li>
                <a href={site.instagramUrl} target="_blank" rel="noopener" className="flex h-11 items-center">
                  Instagram
                </a>
              </li>
              {bot && (
                <li>
                  <a href={bot} target="_blank" rel="noopener" className="flex h-11 items-center">
                    Telegram
                  </a>
                </li>
              )}
              {site.phone && (
                <li>
                  <a href={`tel:${site.phone}`} className="flex h-11 items-center tabular-nums">
                    {formatPhone(site.phone)}
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
