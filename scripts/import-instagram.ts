/**
 * Import Instagram posts as products (photos + caption data).
 *   1. Export:  paste scripts/instagram-export.js in the browser console on instagram.com → tsv-instagram.json
 *   2. Photos:  the import downloads nothing; put the post photos in a folder as <code>-<n>.jpg
 *   3. Import:  npm run import:instagram -- import/instagram/posts.json import/instagram/photos [--publish] [--dry-run]
 * New products are hidden drafts unless --publish. Products whose slug already exists are skipped (safe to re-run).
 * A report is written next to the JSON file (report.md).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { CATEGORIES, groupPosts, type IgPost, type ProductDraft } from "./lib/instagram";
import { adminClientFromEnv, triggerRevalidate, uploadProductPhotos } from "./lib/photos";

const igLink = (code: string) => `https://www.instagram.com/p/${code}/`;

function draftLine(p: ProductDraft): string {
  const colors = p.colors.map((c) => c.name_ru).join(", ") || "—";
  const unknown = p.unknownColors.length ? ` (unknown colours: ${p.unknownColors.join(", ")})` : "";
  return `- **${p.title}** — ${p.price.toLocaleString("ru-RU")} сум · ${p.category} · sizes: ${p.sizes.join(", ") || "one size"} · colours: ${colors}${unknown} · ${p.images.length} photo(s) · \`${p.slug}\` · posts: ${p.codes.map((c) => `[${c}](${igLink(c)})`).join(" ")}`;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { publish: { type: "boolean", default: false }, "dry-run": { type: "boolean", default: false } },
  });
  const [jsonPath = "import/instagram/posts.json", photosDir = "import/instagram/photos"] = positionals;
  const posts = (JSON.parse(readFileSync(jsonPath, "utf8")) as { posts: IgPost[] }).posts;
  const { products, skipped } = groupPosts(posts);

  const report = [
    `# Instagram import — ${new Date().toISOString()}`,
    "",
    `${posts.length} posts → ${products.length} products, ${skipped.length} posts skipped.${values["dry-run"] ? " (dry run)" : ""}`,
    "",
    "## Products",
    ...products.map(draftLine),
    "",
    "## Skipped posts",
    ...skipped.map((s) => `- [${s.code}](${igLink(s.code)}) — ${s.reason}`),
  ];

  if (values["dry-run"]) {
    writeFileSync(join(dirname(jsonPath), "report.md"), report.join("\n") + "\n");
    console.log(report.join("\n"));
    return;
  }

  const db = adminClientFromEnv();

  // Categories used by this import (names refreshed if they already exist).
  const used = new Set(products.map((p) => p.category));
  const { error: catErr } = await db
    .from("categories")
    .upsert(CATEGORIES.filter((c) => used.has(c.slug)).map((c) => ({ ...c })), { onConflict: "slug" });
  if (catErr) throw catErr;
  const { data: cats, error: catsErr } = await db.from("categories").select("id, slug");
  if (catsErr) throw catsErr;
  const categoryId = new Map(cats.map((c) => [c.slug as string, c.id as string]));

  // Colours: reuse rows with the same Russian name, create the missing ones.
  const { data: existingColors, error: colErr } = await db.from("colors").select("id, name_ru");
  if (colErr) throw colErr;
  const colorId = new Map(existingColors.map((c) => [c.name_ru as string, c.id as string]));
  const missing = new Map(products.flatMap((p) => p.colors).filter((c) => !colorId.has(c.name_ru)).map((c) => [c.name_ru, c]));
  if (missing.size) {
    const { data: inserted, error } = await db.from("colors").insert([...missing.values()]).select("id, name_ru");
    if (error) throw error;
    for (const c of inserted) colorId.set(c.name_ru as string, c.id as string);
  }

  const results: string[] = [];
  for (const p of products) {
    const { data: existing } = await db.from("products").select("id").eq("slug", p.slug).maybeSingle();
    if (existing) {
      results.push(`= ${p.slug} (already exists, skipped)`);
      continue;
    }
    const { data: row, error } = await db
      .from("products")
      .insert({
        slug: p.slug,
        title_ru: p.title,
        description_ru: p.description || null,
        price: p.price,
        category_id: categoryId.get(p.category),
        sizes: p.sizes,
        is_published: values.publish,
        created_at: p.created_at,
      })
      .select("id")
      .single();
    if (error) throw new Error(`${p.slug}: ${error.message}`);

    if (p.colors.length) {
      const { error: pcErr } = await db
        .from("product_colors")
        .insert(p.colors.map((c, sort) => ({ product_id: row.id, color_id: colorId.get(c.name_ru), sort })));
      if (pcErr) throw pcErr;
    }

    const files = p.images.map((i) => join(photosDir, i.file)).filter((f) => existsSync(f));
    if (files.length) await uploadProductPhotos(db, p.slug, files);
    results.push(`+ ${p.slug} (${files.length} photo(s))`);
    console.log(`+ ${p.slug}`);
  }

  writeFileSync(join(dirname(jsonPath), "report.md"), [...report, "", "## Result", ...results.map((r) => `- ${r}`)].join("\n") + "\n");
  const created = results.filter((r) => r.startsWith("+")).length;
  console.log(`✓ ${created} product(s) created ${values.publish ? "and published" : "as hidden drafts"}; report: ${join(dirname(jsonPath), "report.md")}`);
  console.log((await triggerRevalidate()) ? "✓ site refreshed" : "… site not refreshed (set NEXT_PUBLIC_SITE_URL + REVALIDATE_SECRET)");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
