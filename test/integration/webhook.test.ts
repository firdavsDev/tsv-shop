import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/telegram/webhook/route";
import { admin, resetOrders } from "./db";
import { startTgStub } from "./tg-stub";

let stub: Awaited<ReturnType<typeof startTgStub>>;

const MALIKA = { id: 7, first_name: "Malika", username: "malika" };
const AZIZA = { id: 8, first_name: "Aziza" };

function hook(update: unknown, secret = "webhook-secret") {
  return POST(
    new Request("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
      body: JSON.stringify(update),
    }),
  );
}

let n = 0;
const tap = (data: string, from: object = MALIKA, chatId = -1001) => ({
  update_id: ++n,
  callback_query: { id: `cb${n}`, from, data, message: { message_id: 555, chat: { id: chatId, type: "supergroup" } } },
});
const say = (text: string, chat: { id: number; type: string }) => ({
  update_id: ++n,
  message: { message_id: n, chat, from: MALIKA, text },
});

async function order(id = "K7Q2M9") {
  const { error } = await admin().from("orders").insert({
    id, phone: "+998901234567", locale: "ru", source: "web", items: [], total: 0, tg_chat_id: -1001, tg_message_id: 555,
  });
  if (error) throw error;
}
const row = async (id = "K7Q2M9") => (await admin().from("orders").select("*").eq("id", id).single()).data;
const answers = () => stub.calls.filter((c) => c.method === "answerCallbackQuery").map((c) => c.body.text ?? null);

beforeAll(async () => {
  stub = await startTgStub();
});
afterAll(() => stub.close());
beforeEach(async () => {
  await resetOrders();
  stub.reset();
});

describe("telegram webhook", () => {
  it("rejects a wrong secret", async () => {
    expect((await hook(tap("o:K7Q2M9:take"), "nope")).status).toBe(403);
  });

  it("take → calling, shows who is calling", async () => {
    await order();
    expect((await hook(tap("o:K7Q2M9:take"))).status).toBe(200);
    expect(await row()).toMatchObject({ status: "calling", claimed_by: "Malika (@malika)" });
    expect(answers()).toEqual(["Вы звоните клиенту"]);
    const edit = stub.calls.find((c) => c.method === "editMessageReplyMarkup")!;
    expect(edit.body).toMatchObject({ chat_id: -1001, message_id: 555 });
    expect(JSON.stringify(edit.body.reply_markup)).toContain("Звонит: Malika (@malika)");
  });

  it("two admins tap at once: exactly one wins", async () => {
    await order();
    await Promise.all([hook(tap("o:K7Q2M9:take", MALIKA)), hook(tap("o:K7Q2M9:take", AZIZA))]);
    const r = await row();
    expect(r.status).toBe("calling");
    const texts = answers();
    expect(texts).toContain("Вы звоните клиенту");
    expect(texts).toContain(`Уже звонит: ${r.claimed_by}`);
  });

  it("done / cancel close the order; reset frees it", async () => {
    await order("AAAAAA");
    await hook(tap("o:AAAAAA:take"));
    await hook(tap("o:AAAAAA:done", AZIZA));
    expect(await row("AAAAAA")).toMatchObject({ status: "confirmed", closed_by: "Aziza" });

    await order("BBBBBB");
    await hook(tap("o:BBBBBB:take"));
    await hook(tap("o:BBBBBB:reset"));
    expect(await row("BBBBBB")).toMatchObject({ status: "new", claimed_by: null });
    await hook(tap("o:BBBBBB:cancel"));
    expect((await row("BBBBBB")).status).toBe("new"); // cancel needs "calling" first
    expect(answers().at(-1)).toBe("Статус уже изменён");
  });

  it("ignores taps from other chats and no-op buttons", async () => {
    await order();
    await hook(tap("o:K7Q2M9:take", MALIKA, -999));
    await hook(tap("noop"));
    expect((await row()).status).toBe("new");
    expect(answers()).toEqual([null, null]);
  });

  it("/chatid answers in groups only", async () => {
    await hook(say("/chatid@tsv_bot", { id: -1001, type: "supergroup" }));
    await hook(say("/chatid", { id: 42, type: "private" }));
    const sends = stub.calls.filter((c) => c.method === "sendMessage");
    expect(sends).toHaveLength(1);
    expect(sends[0].body).toMatchObject({ chat_id: -1001, text: "chat_id: <code>-1001</code>" });
  });

  it("/start opens the shop, /start p_<slug> opens the product", async () => {
    await hook(say("/start", { id: 42, type: "private" }));
    await hook(say("/start p_bluza-iz-shelka", { id: 42, type: "private" }));
    await hook(say("/start", { id: -1001, type: "supergroup" }));
    const urls = stub.calls
      .filter((c) => c.method === "sendMessage")
      .map((c) => (c.body.reply_markup as { inline_keyboard: { web_app: { url: string } }[][] }).inline_keyboard[0][0].web_app.url);
    expect(urls).toEqual(["http://localhost:3000/ru?tg=1", "http://localhost:3000/ru/p/bluza-iz-shelka?tg=1"]);
  });

  it("survives junk", async () => {
    expect((await hook({ update_id: 1 })).status).toBe(200);
    expect((await hook(tap("o:ZZZZZZ:take"))).status).toBe(200);
    expect(answers()).toEqual(["Заказ не найден"]);
  });
});
