import "server-only";
import { serverEnv } from "@/lib/env";

export class TelegramError extends Error {
  constructor(
    public method: string,
    public description: string,
    public status: number,
  ) {
    super(`Telegram ${method} failed (${status}): ${description}`);
  }
}

/** Call a Bot API method. Throws TelegramError on failure. 8 s timeout so a slow API can't hang a request. */
export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = serverEnv.tgToken;
  if (!token) throw new TelegramError(method, "TG_BOT_TOKEN is not set", 0);
  const res = await fetch(`${serverEnv.tgApiBase}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!res.ok || !data.ok) throw new TelegramError(method, data.description ?? res.statusText, res.status);
  return data.result as T;
}
