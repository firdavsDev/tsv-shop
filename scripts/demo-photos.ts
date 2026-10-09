/**
 * Placeholder photos for the seed products (local development only) + public/hero.webp.
 * Usage: npm run demo:photos
 */
import { existsSync } from "node:fs";
import sharp from "sharp";
import { adminClientFromEnv, triggerRevalidate, uploadProductPhotos } from "./lib/photos";

const SHAPES = {
  dress: "M41 12h18l5 14-5 6 13 58H28l13-58-5-6z",
  pants: "M32 10h36l4 80H57l-7-56-7 56H28z",
  blouse: "M31 18l12-6h14l12 6 15 22-10 6-7-9v47H33V37l-7 9-10-6z",
  coat: "M34 10l9-2h14l9 2 12 24-8 4-4-8v60H34V30l-4 8-8-4z",
} as const;

// kostyum-trojka-bez-foto is left without photos on purpose (Review Focus #5).
const DEMO: Record<string, { shape: keyof typeof SHAPES; fills: string[] }> = {
  "shelkovoe-plate-midi": { shape: "dress", fills: ["#1d1d1d", "#e7d3b0"] },
  "plate-s-printom": { shape: "dress", fills: ["#2e2a33", "#45404d"] },
  "bryuki-so-strelkami": { shape: "pants", fills: ["#1d1d1d", "#d8c3a5"] },
  "bryuki-palazzo": { shape: "pants", fills: ["#efe6d6", "#e3d8c4"] },
  "bluza-iz-shelka": { shape: "blouse", fills: ["#efe6d6", "#e7d3b0"] },
  "rubashka-oversize": { shape: "blouse", fills: ["#fbfbf9"] },
  "trench-klassicheskiy": { shape: "coat", fills: ["#d8c3a5", "#c4ab86"] },
  "kostyum-trojka": { shape: "coat", fills: ["#1d1d1d", "#3b3b3d"] },
  "chernovik-plate": { shape: "dress", fills: ["#9a9a9a"] },
};

function productSvg(shape: string, fill: string, variant: number): Buffer {
  const scale = variant === 0 ? 1 : 1.18;
  const dx = variant === 0 ? 10 : 1;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 120 160">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#eeede9"/><stop offset="1" stop-color="#d9d6cf"/></linearGradient></defs>
      <rect width="120" height="160" fill="url(#g)"/>
      <g transform="translate(${dx} 32) scale(${scale})">
        <path d="${shape}" fill="${fill}" stroke="#00000026" stroke-width="0.6"/>
      </g>
    </svg>`,
  );
}

function heroSvg(): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 160 100">
      <defs><radialGradient id="r" cx="0.72" cy="0.3" r="0.9">
        <stop offset="0" stop-color="#4a4036"/><stop offset="1" stop-color="#121110"/></radialGradient></defs>
      <rect width="160" height="100" fill="url(#r)"/>
      <g transform="translate(92 4) scale(0.98)"><path d="${SHAPES.dress}" fill="#0b0a09"/></g>
    </svg>`,
  );
}

// Scripts are CommonJS .ts files (run by tsx), so no top-level await: wrap in main().
async function main() {
  const db = adminClientFromEnv();
  if (existsSync("public/hero.webp")) {
    console.log("… public/hero.webp exists, kept (delete it to get the placeholder back)");
  } else {
    await sharp(heroSvg()).webp({ quality: 70 }).toFile("public/hero.webp");
    console.log("✓ public/hero.webp (placeholder)");
  }

  for (const [slug, demo] of Object.entries(DEMO)) {
    const inputs = demo.fills.map((fill, i) => productSvg(SHAPES[demo.shape], fill, i));
    const images = await uploadProductPhotos(db, slug, inputs);
    console.log(`✓ ${slug}: ${images.length} photo(s)`);
  }
  console.log((await triggerRevalidate()) ? "✓ site refreshed" : "… site not refreshed (dev server not running?)");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
