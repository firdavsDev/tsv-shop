"use client";

import type { Ref } from "react";
import { maskLocalPhone } from "@/lib/phone";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
  ref?: Ref<HTMLInputElement>;
};

/** Fixed "+998" prefix + 9 local digits, auto-formatted "90 123 45 67". 16px text so iOS doesn't zoom. */
export function PhoneInput({ id, value, onChange, invalid, describedBy, ref }: Props) {
  return (
    <div
      className={`flex h-12 items-center border focus-within:ring-2 focus-within:ring-fg/25 ${invalid ? "border-danger" : "border-fg/40 focus-within:border-fg"}`}
    >
      <span aria-hidden className="pl-3 pr-2 text-[16px] tabular-nums text-muted">
        +998
      </span>
      <input
        ref={ref}
        id={id}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="90 123 45 67"
        value={value}
        onChange={(e) => onChange(maskLocalPhone(e.target.value))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        required
        className="h-full min-w-0 flex-1 bg-transparent pr-3 text-[16px] tabular-nums outline-none"
      />
    </div>
  );
}
