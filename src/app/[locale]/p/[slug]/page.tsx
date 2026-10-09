import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/Gallery";
import { JsonLd } from "@/components/JsonLd";
import { ProductBuy } from "@/components/ProductBuy";
import { getDict, isLocale } from "@/i18n";
import { getProduct, getProducts } from "@/lib/catalog";
import { formatNumber, formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import { pick, pickOptional } from "@/lib/localize";
import { absoluteUrl, site, telegramBotUrl } from "@/lib/site";

type Params = Promise<{ locale: string; slug: string }>;

export const revalidate = 3600;
export const dynamicParams = true; // products published after the build render on first visit

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const p = await getProduct(slug);
  if (!p) return {};
  const title = pick(locale, p.title_ru, p.title_uz);
  const description =
    pickOptional(locale, p.description_ru, p.description_uz)?.slice(0, 160) ?? `${title} — ${formatPrice(p.price, locale)}`;
  const image = p.images[0] ? imageUrl(p.images[0], 1200) : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/p/${slug}`, languages: { ru: `/ru/p/${slug}`, uz: `/uz/p/${slug}` } },
    openGraph: {
      siteName: "TSV",
      type: "website",
      title,
      description,
      ...(image ? { images: [{ url: image, width: 1200, height: 1600 }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const p = await getProduct(slug);
  if (!p) notFound();

  const t = getDict(locale);
  const title = pick(locale, p.title_ru, p.title_uz);
  const description = pickOptional(locale, p.description_ru, p.description_uz);
  const categoryName = pick(locale, p.category.name_ru, p.category.name_uz);
  const url = absoluteUrl(`/${locale}/p/${p.slug}`);
  const tgLink = telegramBotUrl(`p_${p.slug}`);
  const linkCls = "inline-flex min-h-11 items-center underline underline-offset-4";

  return (
    <article className="mx-auto max-w-6xl md:grid md:grid-cols-2 md:gap-10 md:px-4 md:pt-8">
      <Gallery images={p.images} alt={title} locale={locale} />
      <div className="px-4 pt-5 md:px-0 md:pt-0">
        <nav aria-label="breadcrumb" className="text-[13px] text-muted">
          <Link href={`/${locale}/c/${p.category.slug}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {categoryName}
          </Link>
        </nav>
        <h1 className="text-[17px] uppercase leading-snug tracking-[0.08em]">{title}</h1>
        <p className="mt-2 flex items-baseline gap-3 text-xl font-medium tabular-nums text-price">
          {formatPrice(p.price, locale)}
          {p.old_price && <s className="text-[14px] font-normal text-muted">{formatNumber(p.old_price)}</s>}
        </p>

        <ProductBuy
          locale={locale}
          product={{
            id: p.id,
            slug: p.slug,
            title_ru: p.title_ru,
            title_uz: p.title_uz,
            price: p.price,
            image: p.images[0] ?? null,
            sizes: p.sizes,
            soldOutSizes: p.sold_out_sizes,
            inStock: p.in_stock,
            colors: p.colors,
          }}
        />

        {description && (
          <section className="mt-10">
            <h2 className="label text-muted">{t.product.description}</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{description}</p>
          </section>
        )}

        <section className="mt-10 border-t border-line pt-5 text-[14px]">
          <p className="text-muted">{t.product.ask}</p>
          <div className="mt-1 flex flex-wrap gap-x-6">
            {tgLink && (
              <a href={tgLink} target="_blank" rel="noopener" className={linkCls}>
                {t.product.openInTelegram}
              </a>
            )}
            <a href={site.instagramUrl} target="_blank" rel="noopener" className={linkCls}>
              Instagram
            </a>
          </div>
        </section>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: title,
          ...(description ? { description } : {}),
          image: p.images.map((k) => imageUrl(k, 1200)),
          sku: p.slug,
          brand: { "@type": "Brand", name: "TSV" },
          category: categoryName,
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: "UZS",
            price: p.price,
            availability: p.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "TSV", item: absoluteUrl(`/${locale}`) },
            { "@type": "ListItem", position: 2, name: categoryName, item: absoluteUrl(`/${locale}/c/${p.category.slug}`) },
            { "@type": "ListItem", position: 3, name: title, item: url },
          ],
        }}
      />
    </article>
  );
}
