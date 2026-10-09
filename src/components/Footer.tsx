import { getDict, type Locale } from "@/i18n";
import { formatPhone } from "@/lib/format";
import { site, telegramBotUrl } from "@/lib/site";

// Module scope, not render: React Compiler lint rules forbid new Date() during render.
const YEAR = new Date().getFullYear();

export function Footer({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const bot = telegramBotUrl();
  const link = "inline-flex min-h-11 items-center underline-offset-4 hover:underline";
  return (
    <footer className="mt-20 bg-noir text-cream">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="label text-gold">{t.footer.howTitle}</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {t.footer.how.map((step, i) => (
            <li key={step} className="flex items-baseline gap-3 text-[15px]">
              <span className="font-display text-2xl leading-none text-gold">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {/* Phones: links on one row, copyright on its own line below. Wider screens: one row, copyright right. */}
        <div className="mt-10 border-t border-noir-3 pt-4 text-[14px] text-cream/80 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="flex flex-wrap gap-x-6">
            <a href={site.instagramUrl} target="_blank" rel="noopener" className={link}>
              Instagram
            </a>
            {bot && (
              <a href={bot} target="_blank" rel="noopener" className={link}>
                Telegram
              </a>
            )}
            {site.phone && (
              <a href={`tel:${site.phone}`} className={`${link} tabular-nums`}>
                {formatPhone(site.phone)}
              </a>
            )}
          </div>
          <p className="pt-2 text-[13px] leading-relaxed text-cream/60 sm:pt-0 sm:text-right">
            © {YEAR} TSV · {t.footer.rights}, {t.footer.city}
          </p>
        </div>
      </div>
    </footer>
  );
}
