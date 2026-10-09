import type { MetadataRoute } from "next";
import { locales } from "@/i18n";
import { getCategories, getProducts } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const paths: { path: string; lastModified?: string }[] = [
    { path: "" },
    ...categories.map((c) => ({ path: `/c/${c.slug}` })),
    ...products.map((p) => ({ path: `/p/${p.slug}`, lastModified: p.created_at })),
  ];
  return paths.flatMap(({ path, lastModified }) =>
    locales.map((locale) => ({
      url: absoluteUrl(`/${locale}${path}`),
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, absoluteUrl(`/${l}${path}`)])) },
    })),
  );
}
