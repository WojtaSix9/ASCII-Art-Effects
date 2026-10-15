// Wspólne narzędzia rastra i szumu (krok 9, partia druku). DOT_R: przeniesione z post FX Halftone bez zmian liczbowych.
import { clamp, hash01 } from './util.ts';

/** Pole koła o promieniu r (w bokach komórki) przyciętego do kwadratu komórki. */
const circleInSquare = (r: number) => { const a = 0.5; if (r <= a) return Math.PI * r * r; if (r >= a * Math.SQRT2) return 1; return Math.PI * r * r - 4 * (r * r * Math.acos(a / r) - a * Math.sqrt(r * r - a * a)); };
/** Promień kropki (w bokach komórki), której pole w komórce = A; tablica 257 wartości. */
export const DOT_R = (() => { const t = new Float32Array(257); for (let i = 0; i <= 256; i++) { const A = i / 256; let lo = 0, hi = Math.SQRT1_2; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (circleInSquare(m) < A) lo = m; else hi = m; } t[i] = (lo + hi) / 2; } return t; })();

export type ScreenOpts = {
  /** dot: krawędź wygładzona na szerokości `soft` px; sharp: twarda krawędź; ink: krawędź falująca jak rozlany tusz. */
  shape?: 'dot' | 'sharp' | 'ink'; soft?: number;
  /** Przesunięcie całej siatki w px (np. przesunięcie farby w Risographie). */
  ox?: number; oy?: number;
  /** Losowe przesunięcie środków kropek, ułamek komórki (0–0,5); seed. */
  jitter?: number; seed?: number;
};
/** Raster AM: krycie 0–1 każdego piksela. Siatka o boku cs px obrócona o `angle` (rad); pokrycie komórki czytane z `field`
 *  (w×h, 0–1) w środku komórki; promień kropki z DOT_R, więc średnie krycie komórki = pokrycie (dla shape 'dot'). */
export function amScreen(field: Float32Array, w: number, h: number, cs: number, angle: number, o: ScreenOpts = {}): Float32Array {
  const out = new Float32Array(w * h); const ca = Math.cos(angle), sa = Math.sin(angle); const ox = o.ox ?? 0, oy = o.oy ?? 0;
  const shape = o.shape ?? 'dot', soft = Math.max(1e-3, o.soft ?? 1), jit = (o.jitter ?? 0) * cs, seed = o.seed ?? 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 - ox, py = y + 0.5 - oy; const u = px * ca + py * sa, v = -px * sa + py * ca;
    const i = Math.floor(u / cs), j = Math.floor(v / cs); let cu = (i + 0.5) * cs, cv = (j + 0.5) * cs;
    if (jit) { cu += (hash01(i, j, seed) - 0.5) * 2 * jit; cv += (hash01(i, j, seed + 7) - 0.5) * 2 * jit; }
    const sx = clamp(Math.floor(cu * ca - cv * sa + ox), 0, w - 1), sy = clamp(Math.floor(cu * sa + cv * ca + oy), 0, h - 1);
    const A = clamp(field[sy * w + sx], 0, 1); if (A <= 0) continue; if (A >= 1 && shape !== 'ink') { out[y * w + x] = 1; continue; }
    let r = DOT_R[Math.round(A * 256)] * cs; const du = u - cu, dv = v - cv; const dist = Math.hypot(du, dv);
    if (shape === 'ink') r *= 1.04 + 0.1 * Math.sin(5 * Math.atan2(dv, du) + 6.283 * hash01(i, j, seed + 3));   // rozlany tusz: lekki przyrost i falista krawędź
    out[y * w + x] = shape === 'sharp' ? (dist <= r ? 1 : 0) : clamp(0.5 - (dist - r) / soft, 0, 1);
  }
  return out;
}

/** Szum wartości 0–1, gładki (interpolacja dwuliniowa z wygładzeniem między węzłami siatki co 1 jednostkę). */
export function valueNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y); let tx = x - x0, ty = y - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash01(x0, y0, seed), b = hash01(x0 + 1, y0, seed), c = hash01(x0, y0 + 1, seed), d = hash01(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/** Dylatacja maski (maksimum w kwadracie o promieniu r px), rozdzielnie w poziomie i pionie. */
export function dilate(m: Float32Array, w: number, h: number, r: number): Float32Array {
  r = Math.round(r); if (r < 1) return m; const t = new Float32Array(m.length), o = new Float32Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) v = Math.max(v, m[y * w + k]); t[y * w + x] = v; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) v = Math.max(v, t[k * w + x]); o[y * w + x] = v; }
  return o;
}
