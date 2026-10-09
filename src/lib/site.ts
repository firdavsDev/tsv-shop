/** Public site config. Everything here is safe in the browser. */
export const site = {
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/tsv.womenstore/",
  botUsername: process.env.NEXT_PUBLIC_TG_BOT_USERNAME ?? "",
  phone: process.env.NEXT_PUBLIC_STORE_PHONE ?? "",
};

export function absoluteUrl(path: string): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** t.me link to the bot, optionally with a /start payload (e.g. "p_<slug>"). Null when no bot is configured. */
export function telegramBotUrl(start?: string): string | null {
  if (!site.botUsername) return null;
  return `https://t.me/${site.botUsername}${start ? `?start=${encodeURIComponent(start)}` : ""}`;
}
