'use strict';
// Sinh assets/icon.png (PNG RGBA 256x256) khong can thu vien ngoai.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;

function crcTable() {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
const CRC = crcTable();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const off = y * (width * 4 + 1);
    raw[off] = 0; // filter: none
    rgba.copy(raw, off + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function build() {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const pad = 22;
  const x0 = pad;
  const y0 = pad;
  const x1 = SIZE - pad - 1;
  const y1 = SIZE - pad - 1;
  const fold = 62; // kich thuoc goc gap

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if (!insideRoundRect(x, y, x0, y0, x1, y1, 26)) continue;

      const ty = (y - y0) / (y1 - y0);
      let r = mix(255, 240, ty);
      let g = mix(232, 206, ty);
      let b = mix(118, 74, ty);
      let a = 255;

      // goc gap (tam giac o goc duoi phai)
      if (x > x1 - fold && y > y1 - fold && x - (x1 - fold) + (y - (y1 - fold)) > fold) {
        r = 214;
        g = 168;
        b = 40;
      } else if (x > x1 - fold - 3 && y > y1 - fold - 3 && x - (x1 - fold) + (y - (y1 - fold)) > fold - 4) {
        r = 236;
        g = 196;
        b = 72;
      }

      // cac dong ke
      const lineYs = [86, 122, 158, 194];
      for (const ly of lineYs) {
        if (Math.abs(y - ly) <= 4 && x > x0 + 30 && x < x1 - 30 - (ly > 170 ? 60 : 0)) {
          r = 168;
          g = 138;
          b = 74;
        }
      }

      // dong dau tien ngan hon (nhu tieu de)
      if (Math.abs(y - 86) <= 6 && x > x0 + 30 && x < x0 + 30 + 96) {
        r = 132;
        g = 100;
        b = 44;
      }

      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }
  return encodePng(SIZE, SIZE, buf);
}

const out = path.join(__dirname, '..', 'assets', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, build());
console.log('wrote ' + out);
