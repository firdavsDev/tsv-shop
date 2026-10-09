import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProductsForOrder } from "@/lib/catalog";
import { serverEnv } from "@/lib/env";
import { newOrderId } from "@/lib/order/id";
import { adminMessage, customerMessage } from "@/lib/order/message";
import { orderKeyboard } from "@/lib/order/status";
import {
  clientKeyOf,
  orderSignature,
  productIdsOf,
  toOrderItems,
  validateOrder,
  type OrderErrorCode,
  type RawOrderInput,
} from "@/lib/order/validate";
import { hashIp } from "@/lib/security";
import { serviceClient } from "@/lib/supabase";
import { tg } from "@/lib/telegram/api";
import { verifyInitData } from "@/lib/telegram/init-data";
import type { OrderRow } from "@/lib/types";

export type CreateOrderResult =
  | { ok: true; id: string; total: number }
  | { ok: false; status: 400 | 429; code: OrderErrorCode | "rate_limited"; lineIndex?: number };

const WINDOW_MS = 10 * 60_000;
const DEDUPE_MS = 2 * 60_000;
const LIMIT_PER_IP = 5;
const LIMIT_PER_PHONE = 3;

export async function createOrder(input: RawOrderInput, ctx: { ip: string | null }): Promise<CreateOrderResult> {
  const db = serviceClient();
  const products = await getProductsForOrder(productIdsOf(input.items));
  const result = validateOrder(input, new Map(products.map((p) => [p.id, p])));
  if (!result.ok) return { ok: false, status: 400, code: result.code, lineIndex: result.lineIndex };
  const o = result.order;
  const items = toOrderItems(o.lines);
  const clientKey = clientKeyOf(input);

  // A double tap or a retry after a flaky network: hand back the order we already have.
  const dup = (clientKey && (await findByClientKey(db, clientKey))) || (await findRecentDuplicate(db, o.phone, orderSignature(items)));
  if (dup) return { ok: true, id: dup.id, total: dup.total };

  const ipHash = ctx.ip ? hashIp(ctx.ip, serverEnv.ipHashSalt) : null;
  if (await isRateLimited(db, o.phone, ipHash)) return { ok: false, status: 429, code: "rate_limited" };

  const tgUser =
    typeof input.initData === "string" && input.initData ? verifyInitData(input.initData, serverEnv.tgToken) : null;

  const base = {
    phone: o.phone,
    name: o.name,
    comment: o.comment,
    locale: o.locale,
    source: tgUser ? "telegram" : "web",
    tg_user: tgUser,
    items,
    total: o.total,
    ip_hash: ipHash,
    client_key: clientKey,
  };

  let row: OrderRow | null = null;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    const { data, error } = await db.from("orders").insert({ ...base, id: newOrderId() }).select("*").single();
    if (!error) {
      row = data as OrderRow;
    } else if (error.code === "23505" && clientKey && /client_key/.test(`${error.message} ${error.details}`)) {
      // The same submit raced us and won: its order is the answer. It already notified the admins.
      const existing = await findByClientKey(db, clientKey);
      if (existing) return { ok: true, id: existing.id, total: existing.total };
      throw error;
    } else if (error.code !== "23505") {
      throw error; // 23505 on the primary key = id collision → try another id
    }
  }
  if (!row) throw new Error("Could not allocate an order id");

  await notifyAdmins(row);
  if (tgUser) {
    await tg("sendMessage", { chat_id: tgUser.id, text: customerMessage(row), parse_mode: "HTML" }).catch((err) =>
      console.warn("[order] customer confirmation failed", err),
    );
  }
  return { ok: true, id: row.id, total: row.total };
}

async function findByClientKey(db: SupabaseClient, clientKey: string) {
  const { data, error } = await db.from("orders").select("id, total").eq("client_key", clientKey).maybeSingle();
  if (error) throw error;
  return data as Pick<OrderRow, "id" | "total"> | null;
}

async function findRecentDuplicate(db: SupabaseClient, phone: string, signature: string) {
  const since = new Date(Date.now() - DEDUPE_MS).toISOString();
  const { data, error } = await db
    .from("orders")
    .select("id, total, items")
    .eq("phone", phone)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data as Pick<OrderRow, "id" | "total" | "items">[]).find((r) => orderSignature(r.items) === signature) ?? null;
}

/** Counted in Postgres so the limit holds across serverless instances. */
async function isRateLimited(db: SupabaseClient, phone: string, ipHash: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const count = async (column: "ip_hash" | "phone", value: string) => {
    const { count, error } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq(column, value)
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  };
  if (ipHash && (await count("ip_hash", ipHash)) >= LIMIT_PER_IP) return true;
  return (await count("phone", phone)) >= LIMIT_PER_PHONE;
}

/** Post (or re-post) the order to the admin group. Never throws: failures are recorded on the row. */
export async function notifyAdmins(row: OrderRow): Promise<boolean> {
  const db = serviceClient();
  try {
    if (!serverEnv.tgToken || !serverEnv.tgAdminChatId) throw new Error("Telegram is not configured");
    const msg = await tg<{ message_id: number; chat: { id: number } }>("sendMessage", {
      chat_id: serverEnv.tgAdminChatId,
      text: adminMessage(row),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: orderKeyboard(row),
    });
    await db
      .from("orders")
      .update({ tg_chat_id: msg.chat.id, tg_message_id: msg.message_id, notify_error: null })
      .eq("id", row.id);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[order] admin notify failed for ${row.id}: ${message}`);
    if (process.env.NODE_ENV !== "production") console.info(`[order] message that would be sent:\n${adminMessage(row)}`);
    await db
      .from("orders")
      .update({ notify_attempts: row.notify_attempts + 1, notify_error: message.slice(0, 500) })
      .eq("id", row.id);
    return false;
  }
}

/** Scheduled job: retry orders that never reached Telegram. Also keeps the free Supabase project awake. */
export async function resendPending(): Promise<{ tried: number; sent: number }> {
  const db = serviceClient();
  const now = Date.now();
  const { data, error } = await db
    .from("orders")
    .select("*")
    .is("tg_message_id", null)
    .lt("notify_attempts", 10)
    .gte("created_at", new Date(now - 2 * 86_400_000).toISOString())
    .lt("created_at", new Date(now - 2 * 60_000).toISOString()) // younger ones may still be mid-request
    .order("created_at")
    .limit(20);
  if (error) throw error;
  let sent = 0;
  for (const row of data as OrderRow[]) if (await notifyAdmins(row)) sent++;
  return { tried: data.length, sent };
}
