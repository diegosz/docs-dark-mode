/* Generates icons/icon{16,32,48,128}.png — no external dependencies.
 * Draws a crescent moon on a rounded blue tile, anti-aliased via 4x
 * supersampling, and encodes RGBA straight to PNG with Node's zlib.
 *
 *   node tools/make-icons.mjs
 */
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "icons");
mkdirSync(outDir, { recursive: true });

/* ---------- minimal PNG encoder ---------- */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- geometry helpers ---------- */
const lerp = (a, b, t) => a + (b - a) * t;

function insideRoundRect(x, y, size, rad) {
  const hw = size / 2;
  const px = Math.abs(x - hw) - (hw - rad);
  const py = Math.abs(y - hw) - (hw - rad);
  const dx = Math.max(px, 0);
  const dy = Math.max(py, 0);
  return Math.hypot(dx, dy) - rad <= 0;
}

function insideCircle(x, y, cx, cy, r) {
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
}

/* ---------- render one icon ---------- */
function renderIcon(size) {
  const SS = 4; // supersampling factor
  const out = Buffer.alloc(size * size * 4);
  const rad = 0.22 * size;

  // crescent = big "moon" circle minus an offset "cutout" circle
  const moonCx = 0.5 * size, moonCy = 0.47 * size, moonR = 0.3 * size;
  const cutCx = 0.62 * size, cutCy = 0.37 * size, cutR = 0.27 * size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let pr = 0, pg = 0, pb = 0, pa = 0; // premultiplied accumulators
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          let r, g, b, a;
          if (insideCircle(fx, fy, moonCx, moonCy, moonR) && !insideCircle(fx, fy, cutCx, cutCy, cutR)) {
            r = 255; g = 216; b = 138; a = 255; // cream moon
          } else if (insideRoundRect(fx, fy, size, rad)) {
            const t = fy / size; // vertical blue gradient
            r = lerp(26, 20, t); g = lerp(115, 86, t); b = lerp(232, 184, t); a = 255;
          } else {
            r = 0; g = 0; b = 0; a = 0; // transparent outside the tile
          }
          pr += (r * a) / 255;
          pg += (g * a) / 255;
          pb += (b * a) / 255;
          pa += a;
        }
      }
      const n = SS * SS;
      const avgA = pa / n;
      const i = (y * size + x) * 4;
      if (avgA > 0) {
        out[i] = Math.round((pr / n) * 255 / avgA);
        out[i + 1] = Math.round((pg / n) * 255 / avgA);
        out[i + 2] = Math.round((pb / n) * 255 / avgA);
        out[i + 3] = Math.round(avgA);
      } // else leave fully transparent (zeros)
    }
  }
  return encodePNG(size, size, out);
}

for (const size of [16, 32, 48, 128]) {
  const png = renderIcon(size);
  writeFileSync(join(outDir, `icon${size}.png`), png);
  console.log(`icons/icon${size}.png  (${png.length} bytes)`);
}
