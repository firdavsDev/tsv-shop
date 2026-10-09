import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/cron/resend/route";
import { admin, resetOrders } from "./db";
import { startTgStub } from "./tg-stub";

let stub: Awaited<ReturnType<typeof startTgStub>>;
const call = (auth?: string) =>
  POST(new Request("http://localhost/api/cron/resend", { method: "POST", headers: auth ? { authorization: auth } : {} }));

beforeAll(async () => {
  stub = await startTgStub();
});
afterAll(() => stub.close());
beforeEach(async () => {
  await resetOrders();
  stub.reset();
});

describe("POST /api/cron/resend", () => {
  it("needs the cron secret", async () => {
    expect((await call()).status).toBe(403);
    expect((await call("Bearer wrong")).status).toBe(403);
  });

  it("re-sends unsent orders older than 2 minutes", async () => {
    await admin().from("orders").insert({
      id: "CCCCCC", phone: "+998901234567", locale: "ru", source: "web", items: [], total: 0,
      created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    });
    const res = await call("Bearer cron-secret");
    expect(await res.json()).toEqual({ ok: true, tried: 1, sent: 1 });
    expect(stub.calls.some((c) => c.method === "sendMessage" && String(c.body.text).includes("CCCCCC"))).toBe(true);
  });
});
