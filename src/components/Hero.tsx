import { getDict, type Locale } from "@/i18n";

/**
 * Noir entrance banner with a portrait photo (public/hero.webp, 1200×1600).
 * Phones: the photo fills the banner, text sits on a dark fade at the bottom.
 * Wider screens: text on the left over noir, the photo as a panel on the right fading into it.
 */
export function Hero({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  return (
    <section className="relative isolate overflow-hidden bg-noir text-cream">
      <img
        src="/hero.webp"
        alt=""
        width={1200}
        height={1600}
        fetchPriority="high"
        className="absolute inset-y-0 right-0 -z-10 h-full w-full object-cover object-[50%_20%] md:w-1/2 lg:w-[42%]"
      />
      {/* Legibility: bottom fade on phones, left fade into the noir on wider screens. */}
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-noir via-noir/40 to-transparent md:hidden" />
      <div className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 bg-linear-to-r from-noir via-noir/30 to-transparent md:block lg:w-[42%]" />
      <div className="mx-auto flex min-h-[66svh] max-w-6xl flex-col justify-end px-4 pb-8 pt-24 md:min-h-[480px] md:justify-center md:pb-12 md:pt-12">
        <p className="label text-gold">{t.hero.kicker}</p>
        <h1 className="mt-2 font-display text-[40px] leading-[1.05] sm:text-6xl">
          <span className="sr-only">TSV — </span>
          {t.hero.title}
        </h1>
        <a href="#catalog" className="label mt-6 inline-flex h-11 w-fit items-center border border-gold px-5 text-gold">
          {t.hero.cta}
        </a>
      </div>
    </section>
  );
}
