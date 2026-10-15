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

/** Rozmycie pudelkowe (3 przebiegi ~ gaussian), brzegi przez powielenie. Zwraca nowy obraz.
 *  Krok 6 (optymalizacja): wynik bajt w bajt jak w pierwotnej wersji (ta sama sekwencja dzialan na kanal), ale 4 kanaly
 *  w jednym przejsciu, bez wywolan clamp, a przebieg pionowy wierszami z sumami biezacymi w Float64Array (= liczby JS). */
export function blur(src: Img, radius: number, passes = 3): Img {
  const r = Math.round(radius); if (r < 1) return { w: src.w, h: src.h, data: new Uint8ClampedArray(src.data) };
  const a = new Float32Array(src.data), b = new Float32Array(a.length);
  const { w, h } = src; const div = 2 * r + 1; const W = w - 1, H = h - 1;
  const sums = new Float64Array(w * 4);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {                                           // poziomo: a -> b
      const row = y * w * 4; let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
      for (let x = -r; x <= r; x++) { const i = row + (x < 0 ? 0 : x > W ? W : x) * 4; s0 += a[i]; s1 += a[i + 1]; s2 += a[i + 2]; s3 += a[i + 3]; }
      for (let x = 0; x < w; x++) {
        const o = row + x * 4; b[o] = s0 / div; b[o + 1] = s1 / div; b[o + 2] = s2 / div; b[o + 3] = s3 / div;
        const xa = x + r + 1, xs = x - r; const ia = row + (xa > W ? W : xa) * 4, is = row + (xs < 0 ? 0 : xs) * 4;
        s0 += a[ia] - a[is]; s1 += a[ia + 1] - a[is + 1]; s2 += a[ia + 2] - a[is + 2]; s3 += a[ia + 3] - a[is + 3];
      }
    }
    sums.fill(0);                                                           // pionowo: b -> a, wierszami
    for (let y = -r; y <= r; y++) { const row = (y < 0 ? 0 : y > H ? H : y) * w * 4; for (let k = 0; k < w * 4; k++) sums[k] += b[row + k]; }
    for (let y = 0; y < h; y++) {
      const row = y * w * 4; const ya = y + r + 1, ys = y - r; const ra = (ya > H ? H : ya) * w * 4, rs = (ys < 0 ? 0 : ys) * w * 4;
      for (let k = 0; k < w * 4; k++) { a[row + k] = sums[k] / div; sums[k] += b[ra + k] - b[rs + k]; }
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
    // krok 6: współrzędne kolumn (x0, x1, tx) raz na kolumnę; arytmetyka jak wcześniej, więc wynik bajt w bajt ten sam
    const X0 = new Int32Array(nw), X1 = new Int32Array(nw), TX = new Float64Array(nw);
    for (let x = 0; x < nw; x++) { const fx = clamp((x + 0.5) * sx - 0.5, 0, src.w - 1); X0[x] = Math.floor(fx); X1[x] = Math.min(src.w - 1, X0[x] + 1); TX[x] = fx - X0[x]; }
    for (let y = 0; y < nh; y++) { const fy = clamp((y + 0.5) * sy - 0.5, 0, src.h - 1); const y0 = Math.floor(fy), y1 = Math.min(src.h - 1, y0 + 1), ty = fy - y0;
      const r0 = y0 * src.w, r1 = y1 * src.w;
      for (let x = 0; x < nw; x++) { const x0 = X0[x], x1 = X1[x], tx = TX[x]; const o = (y * nw + x) * 4;
        for (let c = 0; c < 4; c++) { const a = s[(r0 + x0) * 4 + c], b = s[(r0 + x1) * 4 + c], d = s[(r1 + x0) * 4 + c], e = s[(r1 + x1) * 4 + c];
          out[o + c] = lerp(lerp(a, b, tx), lerp(d, e, tx), ty); } } }
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
