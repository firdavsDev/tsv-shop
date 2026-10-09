"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { getDict, type Locale } from "@/i18n";
import { cart, cartTotal, countItems, lineKey, MAX_QTY, useCart, useCartReady } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import { pick } from "@/lib/localize";
import { normalizeUzPhone } from "@/lib/phone";
import { site, telegramBotUrl } from "@/lib/site";
import { getInitData, haptic } from "@/lib/tg-client";
import { OrderSuccess } from "./OrderSuccess";
import { PhoneInput } from "./PhoneInput";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; code: string; lineIndex?: number }
  | { kind: "done"; id: string; phone: string };

type OrderResponse = { ok?: boolean; id?: string; code?: string; lineIndex?: number };

const field = "mt-1.5 w-full border border-fg/40 bg-transparent px-3 text-[16px] outline-none focus:border-fg focus:ring-2 focus:ring-fg/25";

export function CartView({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const lines = useCart();
  const ready = useCartReady();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [phoneInvalid, setPhoneInvalid] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const phoneRef = useRef<HTMLInputElement>(null);
  // Synchronous guards: React state lags a same-tick second tap, refs don't.
  const sendingRef = useRef(false);
  const clientKeyRef = useRef<string | null>(null); // one idempotency key per checkout attempt

  if (status.kind === "done") return <OrderSuccess locale={locale} id={status.id} phone={status.phone} />;

  // The server can't see localStorage: render a quiet placeholder instead of a wrong "cart is empty".
  if (!ready) return <div aria-busy="true" className="min-h-[60vh]" />;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl">{t.cart.empty}</h1>
        <Link href={`/${locale}`} className="label mt-8 inline-flex h-12 items-center bg-btn px-6 text-btn-fg">
          {t.cart.continue}
        </Link>
      </div>
    );
  }

  const sending = status.kind === "sending";
  const errorText = (code: string) => (t.errors as Record<string, string>)[code] ?? t.errors.generic;
  const lineError = status.kind === "error" && status.lineIndex !== undefined ? status : null;
  const formError = status.kind === "error" && status.lineIndex === undefined && status.code !== "phone" ? status.code : null;
  const bot = telegramBotUrl();
  const total = cartTotal(lines);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sendingRef.current) return; // Review Focus #1: no double submit (the server dedupes by clientKey too)
    const normalized = normalizeUzPhone(phone);
    if (!normalized) {
      setPhoneInvalid(true);
      setStatus({ kind: "error", code: "phone" });
      phoneRef.current?.focus();
      return;
    }
    setPhoneInvalid(false);
    setStatus({ kind: "sending" });
    sendingRef.current = true;
    clientKeyRef.current ??= crypto.randomUUID();
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.productId, size: l.size, colorId: l.colorId, qty: l.qty })),
          phone,
          name,
          comment,
          locale,
          website,
          initData: getInitData(),
          clientKey: clientKeyRef.current,
        }),
      });
      const data = (await res.json().catch(() => null)) as OrderResponse | null;
      if (res.ok && data?.ok && data.id) {
        clientKeyRef.current = null;
        cart.clear();
        haptic("success");
        setStatus({ kind: "done", id: data.id, phone: normalized });
        window.scrollTo({ top: 0 });
        return;
      }
      haptic("error");
      const code = data?.code ?? (res.status >= 500 ? "unavailable" : "generic");
      if (code === "phone") setPhoneInvalid(true);
      setStatus({ kind: "error", code, lineIndex: data?.lineIndex });
    } catch {
      haptic("error");
      setStatus({ kind: "error", code: "network" }); // keep clientKeyRef: a retry must not duplicate the order
    } finally {
      sendingRef.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <h1 className="label px-4 pb-2 pt-6 font-medium">
        {t.cart.title} · {countItems(lines)}
      </h1>

      <ul>
        {lines.map((l, i) => {
          const key = lineKey(l);
          const title = pick(locale, l.snapshot.title_ru, l.snapshot.title_uz);
          const colorName = l.snapshot.color_ru ? pick(locale, l.snapshot.color_ru, l.snapshot.color_uz) : null;
          const err = lineError?.lineIndex === i ? errorText(lineError.code) : null;
          return (
            <li key={key} className="flex gap-3 border-b border-line px-4 py-4">
              <Link href={`/${locale}/p/${l.slug}`} className="block w-16 shrink-0" tabIndex={-1} aria-hidden>
                <div className="aspect-[3/4] bg-well">
                  {l.snapshot.image && (
                    <img src={imageUrl(l.snapshot.image, 480)} alt="" width={64} height={85} className="size-full object-cover" />
                  )}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/${locale}/p/${l.slug}`} className="line-clamp-2 text-[13px] uppercase tracking-[0.05em]">
                  {title}
                </Link>
                {(l.size || colorName) && (
                  <p className="mt-0.5 text-[13px] text-muted">{[l.size, colorName].filter(Boolean).join(" · ")}</p>
                )}
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center border border-line">
                    <button
                      type="button"
                      aria-label={t.cart.qtyDec}
                      onClick={() => cart.setQty(key, l.qty - 1)}
                      className="grid size-11 place-items-center text-lg"
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      aria-label={t.cart.qtyInc}
                      disabled={l.qty >= MAX_QTY}
                      onClick={() => cart.setQty(key, l.qty + 1)}
                      className="grid size-11 place-items-center text-lg disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => cart.remove(key)}
                    className="min-h-11 text-[13px] text-muted underline underline-offset-4"
                  >
                    {t.cart.remove}
                  </button>
                </div>
                {err && (
                  <p role="alert" className="mt-2 text-[13px] text-danger">
                    {err}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-[14px] font-medium tabular-nums">{formatPrice(l.snapshot.price * l.qty, locale)}</p>
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline justify-between px-4 py-4">
        <span className="label font-medium">{t.cart.total}</span>
        <span className="text-lg font-medium tabular-nums text-price">{formatPrice(total, locale)}</span>
      </div>

      <form onSubmit={submit} noValidate className="space-y-4 px-4">
        <div>
          <label htmlFor="phone" className="label text-muted">
            {t.cart.phone} *
          </label>
          <div className="mt-1.5">
            <PhoneInput
              ref={phoneRef}
              id="phone"
              value={phone}
              onChange={(v) => {
                setPhone(v);
                if (phoneInvalid) setPhoneInvalid(false);
              }}
              invalid={phoneInvalid}
              describedBy={phoneInvalid ? "phone-error" : undefined}
            />
          </div>
          {phoneInvalid && (
            <p id="phone-error" role="alert" className="mt-1.5 text-[13px] text-danger">
              {t.errors.phone}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="name" className="label text-muted">
            {t.cart.name}
          </label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            maxLength={60}
            placeholder={t.cart.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${field} h-12`}
          />
        </div>

        <div>
          <label htmlFor="comment" className="label text-muted">
            {t.cart.comment}
          </label>
          <textarea
            id="comment"
            name="comment"
            rows={2}
            maxLength={500}
            placeholder={t.cart.commentPlaceholder}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={`${field} py-3`}
          />
        </div>

        {/* Honeypot: invisible to people, irresistible to bots. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <p className="text-[13px] leading-relaxed text-muted">{t.cart.note}</p>

        {formError && (
          <div role="alert" className="border border-danger/40 p-3 text-[14px]">
            <p className="text-danger">{errorText(formError)}</p>
            {(formError === "network" || formError === "unavailable") && (
              <p className="mt-2 text-muted">
                {t.errors.fallback}{" "}
                <a href={site.instagramUrl} target="_blank" rel="noopener" className="underline underline-offset-4">
                  Instagram
                </a>
                {bot && (
                  <>
                    {" · "}
                    <a href={bot} target="_blank" rel="noopener" className="underline underline-offset-4">
                      Telegram
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={sending}
          aria-busy={sending}
          className="label flex h-13 w-full items-center justify-center gap-2 bg-btn font-medium text-btn-fg disabled:opacity-60"
        >
          {sending ? (
            t.cart.sending
          ) : (
            <>
              {t.cart.submit} · <span className="tabular-nums text-bar-accent">{formatPrice(total, locale)}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
