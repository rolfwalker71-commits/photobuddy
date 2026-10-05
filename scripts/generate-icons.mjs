import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

const INDIGO = [91, 102, 245];
const CORAL = [255, 107, 102];
const YELLOW = [255, 209, 102];
const WHITE = [255, 255, 255];

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Rounded-square signed test in unit space (0..1), true when inside. */
function insideRoundedSquare(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}

/**
 * The app icon in unit space: indigo -> coral diagonal gradient, a white
 * camera aperture (ring + six blades), a yellow centre dot and a yellow
 * sparkle at the top right. `glyph` shrinks the artwork towards the centre
 * (maskable icons keep it inside the safe zone). Returns [r, g, b, a] 0..255
 * for one sample.
 */
function sample(x, y, { rounded, glyph }) {
  if (rounded && !insideRoundedSquare(x, y, 0.2237)) return [0, 0, 0, 0];
  let color = mix(INDIGO, CORAL, Math.min(1, Math.max(0, (x + y) / 2)));

  // Artwork coordinates: centred, scaled by `glyph`.
  const u = (x - 0.5) / glyph;
  const v = (y - 0.5) / glyph;
  const R = 0.3;
  const ring = 0.048;
  const blade = 0.034;
  const r = Math.hypot(u, v);

  let hit = false;
  if (Math.abs(r - R) <= ring / 2) hit = true;
  if (!hit && r < R) {
    for (let i = 0; i < 6; i += 1) {
      const a0 = (i * Math.PI) / 3 - Math.PI / 2;
      const a1 = a0 + (2 * Math.PI) / 3;
      // From the ring inwards to the point where the neighbouring blade starts.
      const ax = Math.cos(a0) * R;
      const ay = Math.sin(a0) * R;
      const bx = Math.cos(a1) * R * 0.2;
      const by = Math.sin(a1) * R * 0.2;
      if (distToSegment(u, v, ax, ay, bx, by) <= blade / 2) {
        hit = true;
        break;
      }
    }
  }
  if (hit) color = WHITE;

  if (r <= 0.062) color = YELLOW;

  // Sparkle: four-pointed star with concave sides.
  const sx = Math.abs(u - 0.31);
  const sy = Math.abs(v + 0.31);
  const size = 0.075;
  if (sx ** 0.6 + sy ** 0.6 <= size ** 0.6) color = YELLOW;

  return [color[0], color[1], color[2], 255];
}

function png(size, options) {
  const AA = 4;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < AA; sy += 1) {
        for (let sx = 0; sx < AA; sx += 1) {
          const px = sample((x + (sx + 0.5) / AA) / size, (y + (sy + 0.5) / AA) / size, options);
          // Premultiplied average, so soft edges do not darken.
          r += px[0] * px[3];
          g += px[1] * px[3];
          b += px[2] * px[3];
          a += px[3];
        }
      }
      const i = y * (size * 4 + 1) + 1 + x * 4;
      if (a > 0) {
        raw[i] = Math.round(r / a);
        raw[i + 1] = Math.round(g / a);
        raw[i + 2] = Math.round(b / a);
      }
      raw[i + 3] = Math.round(a / (AA * AA));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(dir, { recursive: true });
// iOS rounds the home-screen icon itself, so it wants a full-bleed square.
writeFileSync(join(dir, "icon-180.png"), png(180, { rounded: false, glyph: 1 }));
writeFileSync(join(dir, "icon-192.png"), png(192, { rounded: true, glyph: 1 }));
writeFileSync(join(dir, "icon-512.png"), png(512, { rounded: true, glyph: 1 }));
// Maskable: full-bleed, artwork inside the central safe zone (80%).
writeFileSync(join(dir, "icon-512-maskable.png"), png(512, { rounded: false, glyph: 0.8 }));
console.log(
  "Wrote public/icons/icon-180.png, icon-192.png, icon-512.png and icon-512-maskable.png",
);
