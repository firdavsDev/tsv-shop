import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/cache-tags";
import { serverEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security";

/** Called by the Supabase database webhook (and the photos script) after catalog edits. */
export async function POST(req: Request) {
  if (!safeEqual(req.headers.get("x-revalidate-secret") ?? "", serverEnv.revalidateSecret)) {
    return Response.json({ ok: false }, { status: 403 });
  }
  // Outside a Server Action: expire now so the next visit renders fresh data (Next 16 two-argument form).
  revalidateTag(CATALOG_TAG, { expire: 0 });
  return Response.json({ ok: true });
}
