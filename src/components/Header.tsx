import Link from "next/link";
import { getDict, type Locale } from "@/i18n";
import { pick } from "@/lib/localize";
import type { Category } from "@/lib/types";
import { CartBadge } from "./CartBadge";
import { LangSwitch } from "./LangSwitch";
import { Menu } from "./Menu";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

export function Header({ locale, categories }: { locale: Locale; categories: Category[] }) {
  const t = getDict(locale);
  const items = categories.map((c) => ({ slug: c.slug, name: pick(locale, c.name_ru, c.name_uz) }));
  return (
    <header className="sticky top-0 z-30 bg-noir text-cream">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-2 sm:px-4">
        <div className="flex items-center justify-self-start">
          <Menu locale={locale} categories={items} />
          <ThemeToggle locale={locale} />
        </div>
        <Link href={`/${locale}`} aria-label={t.nav.home} className="justify-self-center px-2 py-1">
          <Wordmark />
        </Link>
        <div className="flex items-center justify-self-end">
          <LangSwitch locale={locale} />
          <CartBadge locale={locale} />
        </div>
      </div>
    </header>
  );
}
