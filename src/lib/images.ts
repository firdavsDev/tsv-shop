/** Every photo exists in these widths (3:4). 480 → grids and thumbs, 1200 → product page and OG. */
export const IMAGE_SIZES = [480, 1200] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];
export const PHOTO_BUCKET = "products";

export function objectPath(key: string, size: ImageSize): string {
  return `${key}-${size}.webp`;
}

/**
 * How to fit a photo into 3:4. Taller or close to 3:4 → crop ("cover"). Wider (square collages, landscape) →
 * letterbox ("contain"), because cropping a collage cuts off half of the product.
 */
export function chooseFit(width: number, height: number): "cover" | "contain" {
  return width / height > 0.75 * 1.08 ? "contain" : "cover";
}

/**
 * Public Supabase Storage URL. Photos never go through Netlify, so they cost no Netlify credits.
 * NEXT_PUBLIC_IMAGE_BASE_URL overrides the host (a CDN in front of the bucket); "" means same origin, used with
 * PROXY_SUPABASE_STORAGE=1 when the local site is shown through a tunnel.
 */
export function imageUrl(key: string, size: ImageSize): string {
  const base = (process.env.NEXT_PUBLIC_IMAGE_BASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${objectPath(key, size)}`;
}
