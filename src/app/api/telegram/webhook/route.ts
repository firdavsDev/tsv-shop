import { serverEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security";
import { handleUpdate, type Update } from "@/lib/telegram/webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(secret, serverEnv.tgWebhookSecret)) return new Response("forbidden", { status: 403 });

  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return new Response("ok");
  }
  try {
    await handleUpdate(update);
  } catch (err) {
    console.error("[webhook]", err);
  }
  // Always 200 once authenticated: a non-200 makes Telegram redeliver the same update over and over.
  return new Response("ok");
}
