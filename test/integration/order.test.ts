import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/order/route";
import { resendPending } from "@/lib/order/service";
import { signInitData } from "../helpers/init-data";
import { admin, productBySlug, resetOrders, type SeedProduct } from "./db";
import { startTgStub } from "./tg-stub";

let stub: Awaited<ReturnType<typeof startTgStub>>;
let dress: SeedProduct;
let shirt: SeedProduct;
let ipCounter = 0;

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost:3000/api/order", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ipCounter}`, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const dressItem = (over: Record<string, unknown> = {}) => ({
  productId: dress.id, size: "M", colorId: dress.product_colors[1].color_id, qty: 1, ...over,
});

beforeAll(async () => {
  stub = await startTgStub();
  dress = await productBySlug("shelkovoe-plate-midi");
  shirt = await productBySlug("rubashka-oversize");
});
afterAll(() => stub.close());
beforeEach(async () => {
  await resetOrders();
  stub.reset();
});

describe("POST /api/order", () => {
  it("saves the order with DB prices and notifies the admin group", async () => {
    const res = await post({
      phone: "90 123 45 67",
      name: "Дилноза",
      comment: "после 18:00",
      locale: "uz",
      items: [dressItem({ qty: 2 }), { productId: shirt.id, colorId: shirt.product_colors[0].color_id, qty: 1, size: null }],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, total: 489000 * 2 + 260000 });
    expect(body.id).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);

    const { data: row } = await admin().from("orders").select("*").eq("id", body.id).single();
    expect(row).toMatchObject({ phone: "+998901234567", name: "Дилноза", locale: "uz", source: "web", status: "new", total: 1238000 });
    expect(row.items[0]).toMatchObject({ slug: "shelkovoe-plate-midi", size: "M", color_ru: "Шампань", qty: 2, unit_price: 489000 });
    expect(row.ip_hash).toHaveLength(32);
    expect(row.tg_message_id).toBe(101);
    expect(row.tg_chat_id).toBe(-1001);

    const send = stub.calls.find((c) => c.method === "sendMessage")!;
    expect(send.body.chat_id).toBe("-1001");
    expect(send.body.text).toContain(`Новый заказ #${body.id}`);
    expect(send.body.reply_markup).toEqual({ inline_keyboard: [[{ text: "📞 Я позвоню", callback_data: `o:${body.id}:take` }]] });
  });

  it("returns line errors with the line index", async () => {
    const res = await post({ phone: "901234567", items: [dressItem(), dressItem({ size: "XL" })] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, code: "size_sold_out", lineIndex: 1 });
    const missing = await post({ phone: "901234567", items: [dressItem({ productId: "00000000-0000-4000-8000-000000000000" })] });
    expect(await missing.json()).toEqual({ ok: false, code: "unavailable_item", lineIndex: 0 });
    const sold = await productBySlug("kostyum-trojka");
    const soldRes = await post({ phone: "901234567", items: [{ productId: sold.id, size: "42", colorId: sold.product_colors[0].color_id, qty: 1 }] });
    expect(await soldRes.json()).toEqual({ ok: false, code: "unavailable_item", lineIndex: 0 });
  });

  it("rejects bad requests", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ phone: "901234567", items: [dressItem()] }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ phone: "1", items: [], pad: "x".repeat(25_000) })).status).toBe(413);
  });

  it("pretends success for the honeypot and stores nothing", async () => {
    const res = await post({ phone: "901234567", items: [dressItem()], website: "http://spam.example" });
    expect(res.status).toBe(200);
    const { count } = await admin().from("orders").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
    expect(stub.calls).toHaveLength(0);
  });

  it("dedupes a double-submitted order (Review Focus #1)", async () => {
    const order = { phone: "901234567", items: [dressItem()] };
    const a = await (await post(order)).json();
    const b = await (await post(order)).json();
    expect(b.id).toBe(a.id);
    expect(stub.calls.filter((c) => c.method === "sendMessage")).toHaveLength(1);
  });

  it("two simultaneous submits with the same idempotency key make one order (Review Focus #1)", async () => {
    const order = { phone: "901234567", items: [dressItem()], clientKey: "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b" };
    const [a, b] = await Promise.all([post(order), post(order)]);
    const [ja, jb] = [await a.json(), await b.json()];
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(jb.id).toBe(ja.id);
    const { count } = await admin().from("orders").select("id", { count: "exact", head: true });
    expect(count).toBe(1);
    expect(stub.calls.filter((c) => c.method === "sendMessage")).toHaveLength(1);
    // A later retry with the same key (e.g. after a lost response) also returns the same order.
    expect((await (await post(order)).json()).id).toBe(ja.id);
  });

  it("rate-limits by phone (3 per 10 min)", async () => {
    for (const qty of [1, 2, 3]) expect((await post({ phone: "935550011", items: [dressItem({ qty })] })).status).toBe(200);
    const res = await post({ phone: "935550011", items: [dressItem({ qty: 4 })] });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, code: "rate_limited" });
  });

  it("rate-limits by IP (5 per 10 min)", async () => {
    const ip = { "x-forwarded-for": "10.9.9.9" };
    for (const n of [1, 2, 3, 4, 5]) expect((await post({ phone: `9055500${10 + n}`, items: [dressItem()] }, ip)).status).toBe(200);
    expect((await post({ phone: "905550099", items: [dressItem()] }, ip)).status).toBe(429);
  });

  it("keeps the order when Telegram is down, and the resend job delivers it", async () => {
    stub.failNext(1);
    const res = await post({ phone: "901112233", items: [dressItem()] });
    expect(res.status).toBe(200);
    const { id } = await res.json();
    let { data: row } = await admin().from("orders").select("*").eq("id", id).single();
    expect(row.tg_message_id).toBeNull();
    expect(row.notify_error).toContain("Bad Gateway");
    expect(row.notify_attempts).toBe(1);

    // The job skips orders younger than 2 minutes (the request may still be sending). Age this one.
    await admin().from("orders").update({ created_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", id);
    expect(await resendPending()).toEqual({ tried: 1, sent: 1 });
    ({ data: row } = await admin().from("orders").select("*").eq("id", id).single());
    expect(row.tg_message_id).not.toBeNull();
    expect(row.notify_error).toBeNull();
    expect(await resendPending()).toEqual({ tried: 0, sent: 0 });
  });

  it("marks Mini App orders and confirms to the customer", async () => {
    const initData = signInitData(
      { auth_date: String(Math.floor(Date.now() / 1000)), query_id: "AA", user: JSON.stringify({ id: 42, first_name: "Dilnoza", username: "dilnoza" }) },
      process.env.TG_BOT_TOKEN!,
    );
    const res = await post({ phone: "901234567", items: [dressItem()], initData });
    const { id } = await res.json();
    const { data: row } = await admin().from("orders").select("source, tg_user").eq("id", id).single();
    expect(row).toMatchObject({ source: "telegram", tg_user: { id: 42, username: "dilnoza" } });
    const toCustomer = stub.calls.find((c) => c.method === "sendMessage" && c.body.chat_id === 42);
    expect(toCustomer?.body.text).toContain(`Заказ #${id} принят`);
  });

  it("treats forged initData as a plain web order", async () => {
    const res = await post({ phone: "901234567", items: [dressItem()], initData: "user=%7B%22id%22%3A1%7D&hash=" + "a".repeat(64) });
    const { id } = await res.json();
    const { data: row } = await admin().from("orders").select("source, tg_user").eq("id", id).single();
    expect(row).toEqual({ source: "web", tg_user: null });
  });
});
