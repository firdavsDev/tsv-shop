import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderVariants } from "../../scripts/lib/photos";

/** Pixel colour at (x, y) of an encoded image. */
async function pixel(buf: Buffer, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

describe("renderVariants", () => {
  it("letterboxes a square collage in its own background colour instead of cropping it", async () => {
    // 1000×1000 cream collage: red square in the middle, a green band along the top (corners stay cream),
    // blue stripes at BOTH side edges. Any 3:4 crop must lose one stripe; a letterbox keeps both.
    const block = (w: number, h: number, color: string) =>
      sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();
    const square = await sharp({ create: { width: 1000, height: 1000, channels: 3, background: "#f0e8dc" } })
      .composite([
        { input: await block(400, 400, "#cc0000"), left: 300, top: 300 },
        { input: await block(400, 100, "#00aa00"), left: 300, top: 0 },
        { input: await block(40, 1000, "#0000cc"), left: 20, top: 0 },
        { input: await block(40, 1000, "#0000cc"), left: 940, top: 0 },
      ])
      .png()
      .toBuffer();

    const out = await renderVariants(square);
    const meta = await sharp(out[480]).metadata();
    expect([meta.width, meta.height]).toEqual([480, 640]);

    const [r, g, b] = await pixel(out[480], 240, 20); // padding above the image, in the collage's own corner colour
    const [r0, g0, b0] = await pixel(square, 2, 2);
    expect(Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0)).toBeLessThan(20);
    expect(r).toBeGreaterThan(150); // and not the green band (R=0), which a crop would put here
    const [cr] = await pixel(out[480], 240, 320); // centre stays red
    expect(cr).toBeGreaterThan(180);
    expect((await pixel(out[480], 18, 320))[2]).toBeGreaterThan(120); // left stripe kept
    expect((await pixel(out[480], 460, 320))[2]).toBeGreaterThan(120); // right stripe kept
  });

  it("still crops portrait photos to fill 3:4", async () => {
    const portrait = await sharp({ create: { width: 900, height: 1600, channels: 3, background: "#222222" } }).jpeg().toBuffer();
    const out = await renderVariants(portrait);
    const meta = await sharp(out[1200]).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 1600]);
    expect((await pixel(out[1200], 600, 10))[0]).toBeLessThan(60); // no padding band
  });
});
