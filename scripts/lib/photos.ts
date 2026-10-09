import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { IMAGE_SIZES, PHOTO_BUCKET, chooseFit, objectPath, type ImageSize } from "../../src/lib/images";

export function adminClientFromEnv(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Fit a photo into 3:4 and encode WebP at each size. Portrait photos are cropped (attention strategy keeps the
 * subject); wide ones — square Instagram collages — are letterboxed in their own corner colour so nothing is cut.
 */
export async function renderVariants(input: Buffer | string): Promise<Record<ImageSize, Buffer>> {
  const oriented = await sharp(input).rotate().toBuffer(); // respect EXIF orientation from phones
  const { width = 0, height = 0 } = await sharp(oriented).metadata();
  const fit = chooseFit(width, height);
  let background = { r: 241, g: 241, b: 240 };
  if (fit === "contain") {
    // Cut the corner out first: stats() ignores a preceding extract() and would average the whole image.
    const corner = await sharp(oriented)
      .extract({ left: 0, top: 0, width: Math.min(8, width), height: Math.min(8, height) })
      .toBuffer();
    const { channels } = await sharp(corner).stats();
    const [r, g = r, b = r] = channels.map((c) => Math.round(c.mean));
    background = { r, g, b };
  }
  const out = {} as Record<ImageSize, Buffer>;
  for (const w of IMAGE_SIZES) {
    out[w] = await sharp(oriented)
      .resize(w, Math.round((w * 4) / 3), { fit, position: fit === "cover" ? sharp.strategy.attention : "centre", background })
      .flatten({ background })
      .webp({ quality: w === 480 ? 72 : 78 })
      .toBuffer();
  }
  return out;
}

/**
 * Upload photos for one product and save their keys on the row.
 * New uploads get a fresh version prefix, so browsers and CDNs never show a stale photo.
 */
export async function uploadProductPhotos(
  db: SupabaseClient,
  slug: string,
  inputs: (Buffer | string)[],
  opts: { append?: boolean } = {},
): Promise<string[]> {
  const { data: product, error } = await db.from("products").select("id, images").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!product) throw new Error(`No product with slug "${slug}". Create the row in Supabase first.`);

  const version = Date.now().toString(36);
  const keys: string[] = [];
  for (const [n, input] of inputs.entries()) {
    const key = `${slug}/${version}-${n + 1}`;
    const variants = await renderVariants(input);
    for (const w of IMAGE_SIZES) {
      const { error: upErr } = await db.storage
        .from(PHOTO_BUCKET)
        .upload(objectPath(key, w), variants[w], { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (upErr) throw upErr;
    }
    keys.push(key);
  }

  const old: string[] = product.images ?? [];
  const images = opts.append ? [...old, ...keys] : keys;
  const { error: updErr } = await db.from("products").update({ images }).eq("id", product.id);
  if (updErr) throw updErr;

  if (!opts.append && old.length) {
    // Replaced photos: remove the old files so storage stays inside the free 1 GB.
    await db.storage.from(PHOTO_BUCKET).remove(old.flatMap((k) => IMAGE_SIZES.map((w) => objectPath(k, w))));
  }
  return images;
}

/** Ask the site to refresh its catalog cache. Returns false when not configured or unreachable. */
export async function triggerRevalidate(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return false;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { "x-revalidate-secret": secret },
    });
    return res.ok;
  } catch {
    return false;
  }
}
