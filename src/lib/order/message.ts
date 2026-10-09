import { formatNumber, formatPhone, formatPrice } from "@/lib/format";
import { pick } from "@/lib/localize";
import { absoluteUrl } from "@/lib/site";
import { escapeHtml } from "@/lib/telegram/escape";
import type { OrderItem, OrderRow, TgUser } from "@/lib/types";

/** Telegram rejects texts over 4096 characters; stay well below (tags count against us here, not there). */
const SAFE_LENGTH = 3900;

export function tgDisplayName(u: Pick<TgUser, "id" | "first_name" | "last_name" | "username">): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || `id${u.id}`;
  return u.username ? `${name} (@${u.username})` : name;
}

/** Join head + lines + tail, dropping lines from the end (with a "… and N more" line) until it fits. */
function fit(head: string[], lines: string[], tail: string[], more: (n: number) => string): string {
  let kept = lines.length;
  let text = [...head, ...lines, ...tail].join("\n");
  while (text.length > SAFE_LENGTH && kept > 1) {
    kept--;
    text = [...head, ...lines.slice(0, kept), more(lines.length - kept), ...tail].join("\n");
  }
  return text;
}

function adminItemLine(it: OrderItem, i: number): string {
  const title = `<a href="${escapeHtml(absoluteUrl(`/ru/p/${it.slug}`))}">${escapeHtml(it.title_ru)}</a>`;
  const opts = [it.size, it.color_ru].filter((s): s is string => !!s).map(escapeHtml).join(", ");
  return `${i + 1}. ${title}${opts ? ` — ${opts}` : ""} × ${it.qty} — ${formatNumber(it.line_total)}`;
}

/** Message for the admin group (Russian, parse_mode=HTML). */
export function adminMessage(o: OrderRow): string {
  const head = [`🛍 <b>Новый заказ #${o.id}</b>`, "", `📞 <b>${formatPhone(o.phone)}</b>`];
  if (o.name) head.push(`👤 ${escapeHtml(o.name)}`);
  if (o.comment) head.push(`💬 ${escapeHtml(o.comment)}`);
  const lang = o.locale.toUpperCase();
  if (o.tg_user) {
    const u = o.tg_user;
    const link = u.username ? `https://t.me/${u.username}` : `tg://user?id=${u.id}`;
    head.push(`✈️ Telegram · <a href="${escapeHtml(link)}">${escapeHtml(tgDisplayName(u))}</a> · ${lang}`);
  } else {
    head.push(`🌐 Сайт · ${lang}`);
  }
  head.push("");
  const tail = ["", `💰 <b>Итого: ${formatPrice(o.total, "ru")}</b>`];
  return fit(head, o.items.map(adminItemLine), tail, (n) => `… и ещё ${n} поз. (полный список — в базе)`);
}

/** Confirmation the bot sends to a Mini App customer, in their language. */
export function customerMessage(o: OrderRow): string {
  const uz = o.locale === "uz";
  const lines = o.items.map((it) => {
    const colorName = uz ? it.color_uz || it.color_ru : it.color_ru;
    const opts = [it.size, colorName].filter((s): s is string => !!s).map(escapeHtml).join(", ");
    return `• ${escapeHtml(pick(o.locale, it.title_ru, it.title_uz))}${opts ? ` (${opts})` : ""} × ${it.qty}`;
  });
  const phone = `<b>${formatPhone(o.phone)}</b>`;
  return uz
    ? fit(
        [`✅ <b>Buyurtmangiz qabul qilindi — #${o.id}</b>`, ""],
        lines,
        ["", `Jami: ${formatPrice(o.total, "uz")}`, `Tez orada ${phone} raqamiga qoʻngʻiroq qilamiz.`],
        (n) => `… yana ${n} ta`,
      )
    : fit(
        [`✅ <b>Заказ #${o.id} принят</b>`, ""],
        lines,
        ["", `Итого: ${formatPrice(o.total, "ru")}`, `Мы скоро позвоним на ${phone}.`],
        (n) => `… и ещё ${n} поз.`,
      );
}
