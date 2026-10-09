import { describe, expect, it } from "vitest";
import { newOrderId, ORDER_ID_RE } from "@/lib/order/id";
import { hashIp, safeEqual } from "@/lib/security";
import { escapeHtml } from "@/lib/telegram/escape";

describe("security helpers", () => {
  it("compares secrets safely; empty never matches", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
  });
  it("hashes IPs with a salt", () => {
    expect(hashIp("1.2.3.4", "s")).toHaveLength(32);
    expect(hashIp("1.2.3.4", "s")).not.toBe(hashIp("1.2.3.4", "t"));
  });
  it("escapes Telegram HTML", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
  it("makes speakable order ids", () => {
    for (let i = 0; i < 200; i++) expect(newOrderId()).toMatch(ORDER_ID_RE);
  });
});
