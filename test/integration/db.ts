import { createClient } from "@supabase/supabase-js";

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
export const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);

export async function resetOrders(): Promise<void> {
  const { error } = await admin().from("orders").delete().neq("id", "");
  if (error) throw error;
}

export type SeedProduct = {
  id: string;
  price: number;
  sizes: string[];
  sold_out_sizes: string[];
  product_colors: { color_id: string; sort: number }[];
};

export async function productBySlug(slug: string): Promise<SeedProduct> {
  const { data, error } = await admin()
    .from("products")
    .select("id, price, sizes, sold_out_sizes, product_colors(color_id, sort)")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  const p = data as SeedProduct;
  p.product_colors.sort((a, b) => a.sort - b.sort);
  return p;
}
