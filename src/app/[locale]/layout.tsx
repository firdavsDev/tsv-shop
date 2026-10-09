import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { CartBar } from "@/components/CartBar";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { TelegramBoot } from "@/components/TelegramBoot";
import { ThemeScript } from "@/components/ThemeScript";
import { getDict, isLocale, locales } from "@/i18n";
import { getCategories } from "@/lib/catalog";
import { site } from "@/lib/site";

type LayoutParams = Promise<{ locale: string }>;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: LayoutParams }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale);
  return {
    metadataBase: new URL(site.url),
    title: { default: t.meta.title, template: "%s — TSV" },
    description: t.meta.description,
    openGraph: { siteName: "TSV", type: "website", locale: locale === "ru" ? "ru_RU" : "uz_UZ" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = { themeColor: "#121110" };

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: LayoutParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const categories = await getCategories();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-bg focus:px-4 focus:py-3"
        >
          {t.nav.skip}
        </a>
        <Header locale={locale} categories={categories} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} />
        <CartBar locale={locale} />
        <TelegramBoot />
      </body>
    </html>
  );
}
