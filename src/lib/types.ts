import type { Locale } from "@/i18n";

export type Category = { id: string; slug: string; name_ru: string; name_uz: string | null; sort: number };

export type Color = { id: string; name_ru: string; name_uz: string | null; hex: string };

export type Product = {
  id: string;
  slug: string;
  created_at: string;
  title_ru: string;
  title_uz: string | null;
  description_ru: string | null;
  description_uz: string | null;
  price: number;
  old_price: number | null;
  category: { slug: string; name_ru: string; name_uz: string | null };
  sizes: string[];
  sold_out_sizes: string[];
  in_stock: boolean;
  images: string[];
  colors: Color[];
  /** Created in the last 14 days ("NEW" badge). Computed when the catalog is read, not during render. */
  is_new: boolean;
};

export type TgUser = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };

/** One ordered line, frozen at order time so later catalog edits don't change past orders. */
export type OrderItem = {
  product_id: string;
  slug: string;
  title_ru: string;
  title_uz: string | null;
  size: string | null;
  color_ru: string | null;
  color_uz: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type OrderStatus = "new" | "calling" | "confirmed" | "cancelled";

export type OrderRow = {
  id: string;
  created_at: string;
  phone: string;
  name: string | null;
  comment: string | null;
  locale: Locale;
  source: "web" | "telegram";
  tg_user: TgUser | null;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  tg_chat_id: number | null;
  tg_message_id: number | null;
  notify_attempts: number;
  notify_error: string | null;
  ip_hash: string | null;
  client_key: string | null;
};
