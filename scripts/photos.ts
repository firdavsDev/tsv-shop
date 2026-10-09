/**
 * Upload product photos: crop 3:4, WebP 480 + 1200, upload to Supabase Storage, save on the product row.
 *   npm run photos -- <product-slug> photo1.jpg photo2.jpg          (replaces the photos)
 *   npm run photos -- <product-slug> photo3.jpg --append            (adds to the end)
 */
import { parseArgs } from "node:util";
import { adminClientFromEnv, triggerRevalidate, uploadProductPhotos } from "./lib/photos";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { append: { type: "boolean", default: false } },
  });
  const [slug, ...files] = positionals;
  if (!slug || files.length === 0) {
    console.error("Usage: npm run photos -- <product-slug> <photo.jpg> [more.jpg …] [--append]");
    process.exit(1);
  }
  const images = await uploadProductPhotos(adminClientFromEnv(), slug, files, { append: values.append });
  console.log(`✓ ${slug}: now ${images.length} photo(s) (${values.append ? "appended" : "replaced"})`);
  console.log(
    (await triggerRevalidate())
      ? "✓ site refreshed"
      : "… site not refreshed: set NEXT_PUBLIC_SITE_URL + REVALIDATE_SECRET, or rely on the database webhook",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
