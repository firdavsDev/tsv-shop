import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryTabs } from "@/components/CategoryTabs";
import { Hero } from "@/components/Hero";
import { ProductGrid } from "@/components/ProductGrid";
import { getDict, isLocale } from "@/i18n";
import { getCategories, getProducts } from "@/lib/catalog";

type Params = Promise<{ locale: string }>;

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: { canonical: `/${locale}`, languages: { ru: "/ru", uz: "/uz" } } };
}

export default async function Home({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return (
    <>
      <Hero locale={locale} />
      <div id="catalog" className="scroll-mt-16">
        <CategoryTabs locale={locale} categories={categories} active={null} />
        <section aria-labelledby="new" className="mx-auto max-w-6xl pt-6">
          <div className="flex items-baseline justify-between px-4 pb-4">
            <h2 id="new" className="label font-medium">
              {t.catalog.newArrivals}
            </h2>
            <p className="text-[13px] text-muted">{t.catalog.count(products.length)}</p>
          </div>
          <ProductGrid products={products} locale={locale} />
        </section>
      </div>
    </>
  );
}
