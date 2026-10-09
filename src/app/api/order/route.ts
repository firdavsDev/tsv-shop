import { newOrderId } from "@/lib/order/id";
import { createOrder } from "@/lib/order/service";
import { isHoneypotFilled, type RawOrderInput } from "@/lib/order/validate";
import { site } from "@/lib/site";

export const runtime = "nodejs"; // node:crypto (initData HMAC, IP hash)

const MAX_BODY_BYTES = 20_000;

const json = (status: number, body: unknown) => Response.json(body, { status });

function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-nf-client-connection-ip") ?? // Netlify
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

/** Browsers always send Origin on a cross-site POST; reject other sites' forms. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === new URL(req.url).host || host === new URL(site.url).host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json(403, { ok: false, code: "forbidden" });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, code: "too_large" });

  let input: RawOrderInput;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    input = parsed as RawOrderInput;
  } catch {
    return json(400, { ok: false, code: "bad_request" });
  }

  // Bots fill the hidden field. Pretend success so they learn nothing.
  if (isHoneypotFilled(input)) return json(200, { ok: true, id: newOrderId(), total: 0 });

  try {
    const r = await createOrder(input, { ip: clientIp(req) });
    if (r.ok) return json(200, r);
    return json(r.status, { ok: false, code: r.code, ...(r.lineIndex === undefined ? {} : { lineIndex: r.lineIndex }) });
  } catch (err) {
    console.error("[order] failed", err);
    return json(503, { ok: false, code: "unavailable" });
  }
}
