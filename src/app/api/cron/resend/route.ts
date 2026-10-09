import { serverEnv } from "@/lib/env";
import { resendPending } from "@/lib/order/service";
import { safeEqual } from "@/lib/security";

export const runtime = "nodejs";

/** Hit every 15 min by netlify/functions/resend-orders.mts. */
export async function POST(req: Request) {
  const secret = serverEnv.cronSecret;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ ok: false }, { status: 403 });
  }
  try {
    return Response.json({ ok: true, ...(await resendPending()) });
  } catch (err) {
    console.error("[cron] resend failed", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
