/**
 * One-time bot setup after deploying: webhook (with secret), menu button → Mini App, /start command.
 *   npm run setup:telegram
 */
async function call<T>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
}

async function main() {
  const token = process.env.TG_BOT_TOKEN;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const secret = process.env.TG_WEBHOOK_SECRET;
  if (!token || !site || !secret) throw new Error("Set TG_BOT_TOKEN, NEXT_PUBLIC_SITE_URL and TG_WEBHOOK_SECRET in .env.local");
  if (!site.startsWith("https://")) throw new Error("NEXT_PUBLIC_SITE_URL must be the public https:// URL — Telegram requires https");

  const me = await call<{ username: string }>(token, "getMe");
  await call(token, "setWebhook", {
    url: `${site}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await call(token, "setChatMenuButton", {
    menu_button: { type: "web_app", text: "Магазин", web_app: { url: `${site}/ru?tg=1` } },
  });
  await call(token, "setMyCommands", { commands: [{ command: "start", description: "Открыть магазин / Doʻkonni ochish" }] });

  console.log(`✓ @${me.username}: webhook → ${site}/api/telegram/webhook`);
  console.log(`  Set NEXT_PUBLIC_TG_BOT_USERNAME=${me.username}`);
  console.log("  Next: add the bot to the admin group, send /chatid there, put the number in TG_ADMIN_CHAT_ID, redeploy.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
