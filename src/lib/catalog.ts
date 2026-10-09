import "server-only";
import { catalogClient, serviceClient } from "@/lib/supabase";
import type { Category, Color, Product } from "@/lib/types";

const PRODUCT_SELECT = [
  "id, slug, created_at, title_ru, title_uz, description_ru, description_uz",
  "price, old_price, sizes, sold_out_sizes, in_stock, images",
  "category:categories!inner(slug, name_ru, name_uz)",
  "product_colors(sort, color:colors(id, name_ru, name_uz, hex))",
].join(", ");

type ProductRow = Omit<Product, "colors" | "is_new"> & { product_colors: { sort: number; color: Color | null }[] | null };

const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;

function toProduct(row: ProductRow): Product {
  const { product_colors, ...rest } = row;
  const colors = [...(product_colors ?? [])]
    .sort((a, b) => a.sort - b.sort)
    .map((pc) => pc.color)
    .filter((c): c is Color => c !== null);
  // Pages are cached for up to an hour, so "new" can lag by that much. Fine for a badge.
  return { ...rest, colors, is_new: Date.now() - Date.parse(row.created_at) < NEW_FOR_MS };
}

/** Categories that have at least one published product (RLS only shows published ones to the anon key). */
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await catalogClient()
    .from("categories")
    .select("id, slug, name_ru, name_uz, sort, products!inner(id)")
    .limit(1, { referencedTable: "products" })
    .order("sort")
    .order("name_ru");
  if (error) throw error;
  return data.map((c) => ({ id: c.id, slug: c.slug, name_ru: c.name_ru, name_uz: c.name_uz, sort: c.sort }));
}

export async function getCategory(slug: string): Promise<Category | null> {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function getProducts(opts: { categoryId?: string } = {}): Promise<Product[]> {
  let q = catalogClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as ProductRow[]).map(toProduct);
}

export async function getProduct(slug: string): Promise<Product | null> {
  const { data, error } = await catalogClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_published", true)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? toProduct(data as unknown as ProductRow) : null;
}

/** Fresh read used to price an order. Never cached: prices and stock must be current. */
export async function getProductsForOrder(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const { data, error } = await serviceClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_published", true)
    .in("id", ids);
  if (error) throw error;
  return (data as unknown as ProductRow[]).map(toProduct);
}
