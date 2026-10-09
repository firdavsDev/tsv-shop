import { describe, expect, it } from "vitest";
import { verifyInitData } from "@/lib/telegram/init-data";
import { signInitData } from "../helpers/init-data";

const TOKEN = "123456:TEST-TOKEN";
const NOW = 1_791_450_000;
const fields = {
  auth_date: String(NOW - 60),
  query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
  user: JSON.stringify({ id: 42, first_name: "Dilnoza", username: "dilnoza" }),
};

describe("verifyInitData", () => {
  it("accepts data signed with the bot token", () => {
    expect(verifyInitData(signInitData(fields, TOKEN), TOKEN, NOW)).toEqual({ id: 42, first_name: "Dilnoza", username: "dilnoza" });
  });
  it("rejects another token, tampering, staleness and junk", () => {
    const good = signInitData(fields, TOKEN);
    expect(verifyInitData(good, "999:OTHER", NOW)).toBeNull();
    expect(verifyInitData(good.replace("Dilnoza", "Mallory"), TOKEN, NOW)).toBeNull();
    expect(verifyInitData(good, TOKEN, NOW + 2 * 86_400)).toBeNull();
    expect(verifyInitData("hash=zz", TOKEN, NOW)).toBeNull();
    expect(verifyInitData("", TOKEN, NOW)).toBeNull();
    expect(verifyInitData(good, "", NOW)).toBeNull();
  });
});
