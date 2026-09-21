// scripts/gen-icons.mjs
// Generate solid-color "N" badge PNGs at 16/32/48/128 with no external deps.
// Renders a rounded square in brand blue with a white "N" using a tiny built-in
// 5x7 bitmap font (uppercase letters + digits only).

import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "dist", "assets");

const BRAND = [37, 99, 235];   // #2563EB (blue)
const WHITE = [255, 255, 255];

// 5x7 bitmap glyphs for "N" and an empty glyph.
const FONT = {
  N: [
    "10001",
    "11001",
    "10101",
    "10101",
    "10011",
    "10001",
    "10001",
  ],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = Math.max(2, Math.round(size * 0.22));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Rounded square mask
      const inside = isInsideRoundedRect(x, y, size, size, radius);
      const color = inside ? BRAND : [0, 0, 0, 0];
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = inside ? 255 : 0;
    }
  }

  // Stamp "N" centered.
  const glyph = FONT.N;
  const gw = 5;
  const gh = 7;
  const scale = Math.max(1, Math.floor(size / 16));
  const gwScaled = gw * scale;
  const ghScaled = gh * scale;
  const offX = Math.floor((size - gwScaled) / 2);
  const offY = Math.floor((size - ghScaled) / 2);

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (glyph[gy][gx] !== "1") continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const x = offX + gx * scale + sx;
          const y = offY + gy * scale + sy;
          if (x < 0 || x >= size || y < 0 || y >= size) continue;
          const i = (y * size + x) * 4;
          pixels[i] = WHITE[0];
          pixels[i + 1] = WHITE[1];
          pixels[i + 2] = WHITE[2];
          pixels[i + 3] = 255;
        }
      }
    }
  }

  return encodePNG(size, size, pixels);
}

function isInsideRoundedRect(x, y, w, h, r) {
  if (x < r && y < r) return dist(x, y, r, r) <= r;
  if (x >= w - r && y < r) return dist(x, y, w - 1 - r, r) <= r;
  if (x < r && y >= h - r) return dist(x, y, r, h - 1 - r) <= r;
  if (x >= w - r && y >= h - r) return dist(x, y, w - 1 - r, h - 1 - r) <= r;
  return x >= 0 && x < w && y >= 0 && y < h;
}

function dist(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// Minimal PNG encoder (truecolor + alpha, no filter/interlace tricks).
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Add filter byte (0 = none) at the start of every scanline.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const png = renderIcon(size);
    const file = resolve(outDir, `icon-${size}.png`);
    await fs.writeFile(file, png);
    console.log("wrote", file, `${png.length}B`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});