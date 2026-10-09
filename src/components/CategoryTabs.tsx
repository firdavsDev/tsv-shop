import Link from "next/link";
import { getDict, type Locale } from "@/i18n";
import { pick } from "@/lib/localize";
import type { Category } from "@/lib/types";

export function CategoryTabs({ locale, categories, active }: { locale: Locale; categories: Category[]; active: string | null }) {
  const t = getDict(locale);
  const tabs = [
    { slug: null, name: t.nav.all, href: `/${locale}` },
    ...categories.map((c) => ({ slug: c.slug, name: pick(locale, c.name_ru, c.name_uz), href: `/${locale}/c/${c.slug}` })),
  ];
  return (
    <nav aria-label={t.nav.categories} className="border-b border-line">
      <ul className="snap-strip mx-auto flex max-w-6xl scroll-px-4 gap-6 overflow-x-auto px-4">
        {tabs.map((tab) => {
          const on = tab.slug === active;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={`label flex h-12 items-center whitespace-nowrap border-b-2 ${on ? "border-fg text-fg" : "border-transparent text-muted"}`}
              >
                {tab.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
