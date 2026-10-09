import type { Config } from "@netlify/functions";

/**
 * Every 15 minutes: re-send orders that never reached Telegram. Each run also queries Supabase,
 * so the free project never pauses for inactivity. The logic lives in the Next app (/api/cron/resend).
 */
export default async function resendOrders() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.URL ?? "").replace(/\/$/, "");
  const res = await fetch(`${base}/api/cron/resend`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  console.log(`[resend-orders] ${res.status} ${await res.text()}`);
}

export const config: Config = { schedule: "*/15 * * * *" };
