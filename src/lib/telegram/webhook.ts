import "server-only";
import { serverEnv } from "@/lib/env";
import { tgDisplayName } from "@/lib/order/message";
import { ACTION_TOAST, orderKeyboard, parseCallbackData, staleActionText, TRANSITIONS } from "@/lib/order/status";
import { absoluteUrl } from "@/lib/site";
import { serviceClient } from "@/lib/supabase";
import { tg, TelegramError } from "@/lib/telegram/api";
import type { OrderRow, TgUser } from "@/lib/types";

type Chat = { id: number; type: "private" | "group" | "supergroup" | "channel" };
type Message = { message_id: number; chat: Chat; from?: TgUser; text?: string };
type CallbackQuery = { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: Chat } };
export type Update = { update_id: number; message?: Message; callback_query?: CallbackQuery };

const START_RE = /^\/start(?:@\w+)?(?:\s+(\S+))?$/;
const CHATID_RE = /^\/chatid(?:@\w+)?$/;
const PRODUCT_PAYLOAD_RE = /^p_([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export async function handleUpdate(update: Update): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message?.text) return handleMessage(update.message);
}

async function handleCallback(q: CallbackQuery): Promise<void> {
  const answer = (text?: string) =>
    tg("answerCallbackQuery", { callback_query_id: q.id, ...(text ? { text } : {}) }).catch(() => undefined);

  const parsed = q.data ? parseCallbackData(q.data) : null;
  // Only buttons in the admin group may change orders.
  if (!parsed || !q.message || String(q.message.chat.id) !== serverEnv.tgAdminChatId) {
    await answer();
    return;
  }

  const who = tgDisplayName(q.from);
  const now = new Date().toISOString();
  const step = TRANSITIONS[parsed.action];
  const patch: Partial<OrderRow> = { status: step.to };
  if (parsed.action === "take") Object.assign(patch, { claimed_by: who, claimed_at: now });
  if (parsed.action === "reset") Object.assign(patch, { claimed_by: null, claimed_at: null });
  if (parsed.action === "done" || parsed.action === "cancel") Object.assign(patch, { closed_by: who, closed_at: now });

  const db = serviceClient();
  // Conditional update: of two simultaneous taps only one still matches `status = from`.
  const { data: updated, error } = await db
    .from("orders")
    .update(patch)
    .eq("id", parsed.orderId)
    .eq("status", step.from)
    .select("*")
    .maybeSingle();
  if (error) throw error;

  let row = updated as OrderRow | null;
  if (row) {
    await answer(ACTION_TOAST[parsed.action]);
  } else {
    const { data } = await db.from("orders").select("*").eq("id", parsed.orderId).maybeSingle();
    row = data as OrderRow | null;
    await answer(row ? staleActionText(row) : "Заказ не найден");
  }
  if (!row) return;

  await tg("editMessageReplyMarkup", {
    chat_id: q.message.chat.id,
    message_id: q.message.message_id,
    reply_markup: orderKeyboard(row),
  }).catch((err) => {
    if (!(err instanceof TelegramError && err.description.includes("not modified"))) console.warn("[webhook] edit failed", err);
  });
}

async function handleMessage(m: Message): Promise<void> {
  const text = (m.text ?? "").trim();

  if (CHATID_RE.test(text)) {
    // Setup helper: tells the developer the admin group's id.
    if (m.chat.type !== "private") {
      await tg("sendMessage", { chat_id: m.chat.id, text: `chat_id: <code>${m.chat.id}</code>`, parse_mode: "HTML" });
    }
    return;
  }

  const start = START_RE.exec(text);
  if (!start || m.chat.type !== "private") return;
  const slug = PRODUCT_PAYLOAD_RE.exec(start[1] ?? "")?.[1];
  const url = absoluteUrl(`${slug ? `/ru/p/${slug}` : "/ru"}?tg=1`);
  await tg("sendMessage", {
    chat_id: m.chat.id,
    text: [
      "Добро пожаловать в TSV 🤍",
      "TSV doʻkoniga xush kelibsiz!",
      "",
      "Нажмите кнопку, чтобы открыть магазин.",
      "Doʻkonni ochish uchun tugmani bosing.",
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [{ text: slug ? "🛍 Открыть товар · Mahsulotni ochish" : "🛍 Открыть магазин · Doʻkonni ochish", web_app: { url } }],
      ],
    },
  });
}
