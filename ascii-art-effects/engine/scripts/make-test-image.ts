// Syntetyczny obraz testowy (wlasny, bez praw autorskich): gradient nieba, chmury (fbm), ksztalty o ostrych krawedziach, nasycone pola, drobny detal.
import type { Img } from '../src/core/types.ts';
import { hash01 } from '../src/core/util.ts';
const vnoise = (x: number, y: number, s: number) => { const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi; const f = (t: number) => t * t * (3 - 2 * t); const a = hash01(xi, yi, s), b = hash01(xi + 1, yi, s), c = hash01(xi, yi + 1, s), d = hash01(xi + 1, yi + 1, s); return a + (b - a) * f(tx) + (c - a) * f(ty) + (a - b - c + d) * f(tx) * f(ty); };
const fbm = (x: number, y: number) => { let v = 0, a = 0.5, fr = 1; for (let i = 0; i < 6; i++) { v += a * vnoise(x * fr, y * fr, 7 + i); fr *= 2; a /= 2; } return v; };
export function testImage(w = 1200, h = 800): Img {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h; const i = (y * w + x) * 4;
    let r = 10 + 40 * (1 - v) + 190 * v ** 3, g = 18 + 70 * (1 - v) + 90 * v ** 3, b = 45 + 150 * (1 - v) + 40 * v ** 3;           // niebo: ciemny granat -> cieply horyzont
    const cl = fbm(u * 5 + 1, v * 3.2) ** 2.2 * 2.6 * Math.max(0, v * 1.4 - 0.1); r += 210 * cl; g += 185 * cl; b += 150 * cl;       // chmury
    if (Math.hypot(u - 0.2, (v - 0.35) * (h / w)) < 0.12) { r = 235; g = 70; b = 40; }                                           // nasycone kolo
    if (u > 0.62 && u < 0.92 && v > 0.12 && v < 0.42) { const s = Math.floor((u - 0.62) * 150) % 2; r = s ? 20 : 240; g = s ? 20 : 240; b = s ? 20 : 240; }  // paski (ostre krawedzie, wysoki kontrast)
    if (v > 0.78) { r = 25 + 30 * Math.sin(u * 60); g = 80 + 50 * Math.sin(u * 23 + 1); b = 40 + 20 * Math.cos(u * 40); }          // ziemia: zielen z drobnym detalem
    if (u > 0.4 && u < 0.5 && v > 0.55 && v < 0.78) { r = 20; g = 20; b = 25; }                                                  // ciemny prostokat (cien)
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return { w, h, data };
}
