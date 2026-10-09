import { describe, expect, it } from "vitest";
import { adminMessage, customerMessage, tgDisplayName } from "@/lib/order/message";
import type { OrderItem, OrderRow } from "@/lib/types";

const it1: OrderItem = {
  product_id: "p1", slug: "plate-s-printom", title_ru: "Платье миди с принтом", title_uz: "Naqshli koʻylak",
  size: "M", color_ru: "Чёрный", color_uz: "Qora", qty: 1, unit_price: 489000, line_total: 489000,
};
const order = (over: Partial<OrderRow> = {}): OrderRow => ({
  id: "K7Q2M9", created_at: "2026-10-08T10:00:00Z", phone: "+998901234567", name: "Дилноза", comment: "После 18:00",
  locale: "ru", source: "web", tg_user: null, items: [it1], total: 489000, status: "new", claimed_by: null,
  claimed_at: null, closed_by: null, closed_at: null, tg_chat_id: null, tg_message_id: null, notify_attempts: 0,
  notify_error: null, ip_hash: null, client_key: null, ...over,
});

describe("adminMessage", () => {
  it("contains the phone, items, source and total", () => {
    const m = adminMessage(order());
    expect(m).toContain("🛍 <b>Новый заказ #K7Q2M9</b>");
    expect(m).toContain("📞 <b>+998 90 123 45 67</b>");
    expect(m).toContain("👤 Дилноза");
    expect(m).toContain("🌐 Сайт · RU");
    expect(m).toContain('<a href="http://localhost:3000/ru/p/plate-s-printom">Платье миди с принтом</a> — M, Чёрный × 1 — 489');
    expect(m).toContain("💰 <b>Итого: 489 000 сум</b>");
  });

  it("escapes customer text", () => {
    const m = adminMessage(order({ name: "<b>x</b>", comment: 'a & "b" <script>' }));
    expect(m).toContain("👤 &lt;b&gt;x&lt;/b&gt;");
    expect(m).toContain("💬 a &amp; &quot;b&quot; &lt;script&gt;");
  });

  it("shows the Telegram user for Mini App orders", () => {
    const m = adminMessage(order({ source: "telegram", locale: "uz", tg_user: { id: 42, first_name: "Dilnoza", username: "dilnoza" } }));
    expect(m).toContain('✈️ Telegram · <a href="https://t.me/dilnoza">Dilnoza (@dilnoza)</a> · UZ');
  });

  it("stays under Telegram's 4096-char limit for huge orders (Review Focus #2)", () => {
    const long: OrderItem = { ...it1, title_ru: "Очень длинное название ".repeat(8).slice(0, 200) };
    const m = adminMessage(order({ comment: "к".repeat(500), items: Array.from({ length: 30 }, () => long) }));
    expect(m.length).toBeLessThanOrEqual(4096);
    expect(m).toMatch(/… и ещё \d+ поз\./);
    expect(m).toContain("💰 <b>Итого:");
  });
});

describe("customerMessage", () => {
  it("speaks the customer's language", () => {
    expect(customerMessage(order())).toContain("Заказ #K7Q2M9 принят");
    const uz = customerMessage(order({ locale: "uz" }));
    expect(uz).toContain("Buyurtmangiz qabul qilindi — #K7Q2M9");
    expect(uz).toContain("• Naqshli koʻylak (M, Qora) × 1");
  });
});

describe("tgDisplayName", () => {
  it("formats names", () => {
    expect(tgDisplayName({ id: 1, first_name: "Malika", last_name: "K", username: "malika" })).toBe("Malika K (@malika)");
    expect(tgDisplayName({ id: 7 })).toBe("id7");
  });
});
