import { describe, expect, it } from "vitest";
import { orderKeyboard, parseCallbackData, staleActionText, TRANSITIONS } from "@/lib/order/status";

describe("status machine", () => {
  it("defines the transitions", () => {
    expect(TRANSITIONS).toEqual({
      take: { from: "new", to: "calling" },
      done: { from: "calling", to: "confirmed" },
      cancel: { from: "calling", to: "cancelled" },
      reset: { from: "calling", to: "new" },
    });
  });

  it("parses callback data strictly", () => {
    expect(parseCallbackData("o:K7Q2M9:take")).toEqual({ orderId: "K7Q2M9", action: "take" });
    expect(parseCallbackData("o:K7Q2M9:drop")).toBeNull();
    expect(parseCallbackData("o:k7q2m9:take")).toBeNull();
    expect(parseCallbackData("o:K7Q2M0:take")).toBeNull();
    expect(parseCallbackData("noop")).toBeNull();
  });

  it("draws a keyboard per status", () => {
    const base = { id: "K7Q2M9", claimed_by: "Malika", closed_by: "Malika" };
    expect(orderKeyboard({ ...base, status: "new" }).inline_keyboard).toEqual([
      [{ text: "📞 Я позвоню", callback_data: "o:K7Q2M9:take" }],
    ]);
    const calling = orderKeyboard({ ...base, status: "calling" }).inline_keyboard;
    expect(calling[0][0].text).toBe("📞 Звонит: Malika");
    expect(calling.flat().map((b) => b.callback_data)).toEqual(["noop", "o:K7Q2M9:done", "o:K7Q2M9:cancel", "o:K7Q2M9:reset"]);
    expect(orderKeyboard({ ...base, status: "confirmed" }).inline_keyboard).toEqual([
      [{ text: "✅ Подтверждён — Malika", callback_data: "noop" }],
    ]);
    expect(orderKeyboard({ ...base, status: "cancelled" }).inline_keyboard[0][0].text).toBe("❌ Отменён — Malika");
  });

  it("explains why a tap did nothing", () => {
    expect(staleActionText({ status: "calling", claimed_by: "Malika" })).toBe("Уже звонит: Malika");
    expect(staleActionText({ status: "confirmed", claimed_by: null })).toBe("Заказ уже подтверждён");
    expect(staleActionText({ status: "cancelled", claimed_by: null })).toBe("Заказ уже отменён");
    expect(staleActionText({ status: "new", claimed_by: null })).toBe("Статус уже изменён");
  });
});
