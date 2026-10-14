import type { Img } from './types.ts';
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Deterministyczny hasz (x, y, seed) -> [0, 1). Te same komorki znikaja w kazdej klatce i skali (plik 01, coverage). */
export function hash01(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function mulberry32(a: number) {
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function parseColor(c: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c).trim());
  if (!m) throw new Error(`invalid colour "${c}" (expected #rgb or #rrggbb)`);
  let h = m[1]; if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

/** Alpha "over" w miejscu: kolor (r,g,b) z alfa a (0..1) na piksel i bufora RGBA (bufor moze byc przezroczysty). */
export function over(d: Uint8ClampedArray, i: number, r: number, g: number, b: number, a: number) {
  if (a <= 0) return;
  const ab = d[i + 3] / 255;
  if (a >= 1) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
  const ao = a + ab * (1 - a);
  d[i] = (r * a + d[i] * ab * (1 - a)) / ao; d[i + 1] = (g * a + d[i + 1] * ab * (1 - a)) / ao; d[i + 2] = (b * a + d[i + 2] * ab * (1 - a)) / ao; d[i + 3] = ao * 255;
}

/** Rozmycie pudelkowe (3 przebiegi ~ gaussian), brzegi przez powielenie. Zwraca nowy obraz. */
export function blur(src: Img, radius: number, passes = 3): Img {
  const r = Math.round(radius); if (r < 1) return { w: src.w, h: src.h, data: new Uint8ClampedArray(src.data) };
  const a = new Float32Array(src.data), b = new Float32Array(a.length);
  const { w, h } = src;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) for (let c = 0; c < 4; c++) {            // poziomo: a -> b
      let s = 0; const row = y * w;
      for (let x = -r; x <= r; x++) s += a[(row + clamp(x, 0, w - 1)) * 4 + c];
      for (let x = 0; x < w; x++) {
        b[(row + x) * 4 + c] = s / (2 * r + 1);
        s += a[(row + clamp(x + r + 1, 0, w - 1)) * 4 + c] - a[(row + clamp(x - r, 0, w - 1)) * 4 + c];
      }
    }
    for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {            // pionowo: b -> a
      let s = 0;
      for (let y = -r; y <= r; y++) s += b[(clamp(y, 0, h - 1) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        a[(y * w + x) * 4 + c] = s / (2 * r + 1);
        s += b[(clamp(y + r + 1, 0, h - 1) * w + x) * 4 + c] - b[(clamp(y - r, 0, h - 1) * w + x) * 4 + c];
      }
    }
  }
  return { w, h, data: new Uint8ClampedArray(a) };
}

/** Zmiana rozmiaru: usrednianie powierzchni przy zmniejszaniu, bilinearnie przy powiekszaniu. */
export function resize(src: Img, nw: number, nh: number): Img {
  nw = Math.max(1, Math.round(nw)); nh = Math.max(1, Math.round(nh));
  if (nw === src.w && nh === src.h) return { w: nw, h: nh, data: new Uint8ClampedArray(src.data) };
  const out = new Uint8ClampedArray(nw * nh * 4); const sx = src.w / nw, sy = src.h / nh; const s = src.data;
  if (nw <= src.w && nh <= src.h) {
    for (let y = 0; y < nh; y++) { const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      for (let x = 0; x < nw; x++) { const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)); let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * src.w + xx) * 4; r += s[i]; g += s[i + 1]; b += s[i + 2]; a += s[i + 3]; n++; }
        const o = (y * nw + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n; } }
  } else {
    for (let y = 0; y < nh; y++) { const fy = clamp((y + 0.5) * sy - 0.5, 0, src.h - 1); const y0 = Math.floor(fy), y1 = Math.min(src.h - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < nw; x++) { const fx = clamp((x + 0.5) * sx - 0.5, 0, src.w - 1); const x0 = Math.floor(fx), x1 = Math.min(src.w - 1, x0 + 1), tx = fx - x0;
        for (let c = 0; c < 4; c++) { const a = s[(y0 * src.w + x0) * 4 + c], b = s[(y0 * src.w + x1) * 4 + c], d = s[(y1 * src.w + x0) * 4 + c], e = s[(y1 * src.w + x1) * 4 + c];
          out[(y * nw + x) * 4 + c] = lerp(lerp(a, b, tx), lerp(d, e, tx), ty); } } }
  }
  return { w: nw, h: nh, data: out };
}

/** Srednie kolory komorek siatki (cw x ch): tablice r,g,b (0..255) i l (0..1), uklad wierszowy. */
export function cellAverages(src: Img, cw: number, ch: number) {
  const nx = Math.ceil(src.w / cw), ny = Math.ceil(src.h / ch); const n = nx * ny;
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), L = new Float32Array(n); const d = src.data;
  for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
    const x1 = Math.min(src.w, (cx + 1) * cw), y1 = Math.min(src.h, (cy + 1) * ch); let r = 0, g = 0, b = 0, k = 0;
    for (let y = cy * ch; y < y1; y++) for (let x = cx * cw; x < x1; x++) { const i = (y * src.w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; k++; }
    const o = cy * nx + cx; R[o] = r / k; G[o] = g / k; B[o] = b / k; L[o] = lum(R[o], G[o], B[o]);
  }
  return { nx, ny, R, G, B, L };
}
export const imgLum = (src: Img) => { const o = new Float32Array(src.w * src.h); const d = src.data; for (let i = 0, p = 0; i < d.length; i += 4, p++) o[p] = lum(d[i], d[i + 1], d[i + 2]); return o; };
