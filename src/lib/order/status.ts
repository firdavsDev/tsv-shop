import type { InlineKeyboard } from "@/lib/telegram/types";
import type { OrderRow, OrderStatus } from "@/lib/types";

export type OrderAction = "take" | "done" | "cancel" | "reset";

export const TRANSITIONS: Record<OrderAction, { from: OrderStatus; to: OrderStatus }> = {
  take: { from: "new", to: "calling" },
  done: { from: "calling", to: "confirmed" },
  cancel: { from: "calling", to: "cancelled" },
  reset: { from: "calling", to: "new" },
};

export const ACTION_TOAST: Record<OrderAction, string> = {
  take: "Вы звоните клиенту",
  done: "Заказ подтверждён",
  cancel: "Заказ отменён",
  reset: "Заказ снова свободен",
};

export function parseCallbackData(data: string): { orderId: string; action: OrderAction } | null {
  const m = /^o:([2-9A-HJ-NP-Z]{6}):(take|done|cancel|reset)$/.exec(data);
  return m ? { orderId: m[1], action: m[2] as OrderAction } : null;
}

const short = (s: string | null) => (s ?? "админ").slice(0, 40);

/** Buttons under an order message. Each status has its own keyboard. */
export function orderKeyboard(o: Pick<OrderRow, "id" | "status" | "claimed_by" | "closed_by">): InlineKeyboard {
  const cb = (a: OrderAction) => `o:${o.id}:${a}`;
  switch (o.status) {
    case "new":
      return { inline_keyboard: [[{ text: "📞 Я позвоню", callback_data: cb("take") }]] };
    case "calling":
      return {
        inline_keyboard: [
          [{ text: `📞 Звонит: ${short(o.claimed_by)}`, callback_data: "noop" }],
          [
            { text: "✅ Подтверждён", callback_data: cb("done") },
            { text: "❌ Отменён", callback_data: cb("cancel") },
          ],
          [{ text: "↩️ Сбросить", callback_data: cb("reset") }],
        ],
      };
    case "confirmed":
      return { inline_keyboard: [[{ text: `✅ Подтверждён — ${short(o.closed_by)}`, callback_data: "noop" }]] };
    case "cancelled":
      return { inline_keyboard: [[{ text: `❌ Отменён — ${short(o.closed_by)}`, callback_data: "noop" }]] };
  }
}

/** Toast for a tap that lost a race or came too late. */
export function staleActionText(o: Pick<OrderRow, "status" | "claimed_by">): string {
  if (o.status === "calling") return `Уже звонит: ${short(o.claimed_by)}`;
  if (o.status === "confirmed") return "Заказ уже подтверждён";
  if (o.status === "cancelled") return "Заказ уже отменён";
  return "Статус уже изменён";
}
