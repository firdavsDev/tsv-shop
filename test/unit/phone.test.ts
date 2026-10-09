import { describe, expect, it } from "vitest";
import { maskLocalPhone, normalizeUzPhone } from "@/lib/phone";

describe("normalizeUzPhone", () => {
  it.each([
    ["90 123 45 67", "+998901234567"],
    ["901234567", "+998901234567"],
    ["+998 (90) 123-45-67", "+998901234567"],
    ["998901234567", "+998901234567"],
    ["8 90 123 45 67", "+998901234567"],
    ["99 812 34 56", "+998998123456"],
    ["33 555 00 11", "+998335550011"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeUzPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "+7 900 123 45 67", "01 234 56 78", "90 123 45 6", "90 123 45 678 9"])("rejects %s", (input) => {
    expect(normalizeUzPhone(input)).toBeNull();
  });
});

describe("maskLocalPhone (Review Focus #3: autofill/paste formats)", () => {
  it.each([
    ["901234567", "90 123 45 67"],
    ["90 123", "90 123"],
    ["+998 (90) 123-45-67", "90 123 45 67"],
    ["998901234567", "90 123 45 67"],
    ["8 90 123 45 67", "90 123 45 67"],
    ["99 812 34 56", "99 812 34 56"],
    ["9012345678999", "90 123 45 67"],
  ])("%s → %s", (raw, expected) => {
    expect(maskLocalPhone(raw)).toBe(expected);
  });

  it("masked value always normalizes", () => {
    expect(normalizeUzPhone(maskLocalPhone("+998 (90) 123-45-67"))).toBe("+998901234567");
  });
});
