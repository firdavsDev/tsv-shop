import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryTabs } from "@/components/CategoryTabs";
import { ProductGrid } from "@/components/ProductGrid";
import { getDict, isLocale } from "@/i18n";
import { getCategories, getCategory, getProducts } from "@/lib/catalog";
import { pick } from "@/lib/localize";

type Params = Promise<{ locale: string; slug: string }>;

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const cat = await getCategory(slug);
  if (!cat) return {};
  return {
    title: pick(locale, cat.name_ru, cat.name_uz),
    alternates: { canonical: `/${locale}/c/${slug}`, languages: { ru: `/ru/c/${slug}`, uz: `/uz/c/${slug}` } },
  };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [categories, cat] = await Promise.all([getCategories(), getCategory(slug)]);
  if (!cat) notFound();
  const products = await getProducts({ categoryId: cat.id });
  const t = getDict(locale);
  return (
    <>
      <CategoryTabs locale={locale} categories={categories} active={cat.slug} />
      <section className="mx-auto max-w-6xl pt-8">
        <div className="flex items-baseline justify-between px-4 pb-5">
          <h1 className="font-display text-3xl">{pick(locale, cat.name_ru, cat.name_uz)}</h1>
          <p className="text-[13px] text-muted">{t.catalog.count(products.length)}</p>
        </div>
        <ProductGrid products={products} locale={locale} />
      </section>
    </>
  );
}
