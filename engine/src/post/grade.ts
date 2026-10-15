// Korekty w zakładce Color (krok 7): Photo Filter, Gradient Map, Levels, Curves (plik 01, sekcje 7 i 8).
// Kolejność wg pliku 01, sekcja 8.9: Saturation i hue → Levels → Curves (na gotowej klatce, przed warstwą tekstu).
// Lista filtrów Photo Filter nie jest znana z oryginału (plik 01: „zawartość nieznana”) – to nasza propozycja (proj).
import { clamp, lerp, lum, parseColor } from '../core/util.ts';

/** Filtry zdjęciowe (proj): kolory w stylu klasycznych filtrów fotograficznych. */
export const PHOTO_FILTERS: Record<string, { name: string; color: string }> = {
  warm: { name: 'Warming', color: '#ec8a00' }, warmLight: { name: 'Warming light', color: '#fa9600' },
  cool: { name: 'Cooling', color: '#006dff' }, coolLight: { name: 'Cooling light', color: '#00b5ff' },
  sepia: { name: 'Sepia', color: '#ac7a33' }, red: { name: 'Red', color: '#ea1a1a' }, orange: { name: 'Orange', color: '#f38417' },
  yellow: { name: 'Yellow', color: '#f9e31c' }, green: { name: 'Green', color: '#19c919' }, cyan: { name: 'Cyan', color: '#1dcbea' },
  blue: { name: 'Blue', color: '#1d35ea' }, violet: { name: 'Violet', color: '#9b1dea' }, magenta: { name: 'Magenta', color: '#e31ce0' },
  underwater: { name: 'Underwater', color: '#00c2b1' },
};

/** Photo Filter: mieszanie z kolorem filtra (mnożenie przez kolor znormalizowany do najjaśniejszego kanału), gęstość 0–1.
 *  preserve: luminancja dokładnie jak przed filtrem: kolor = Y0 + (c − Y1)·s, gdzie s ≤ 1 zmniejsza tylko nasycenie,
 *  gdy kanał wyszedłby poza 0–255 (samo skalowanie kanałów obcinało jasne kanały i zaniżało jasność, wykrył to test). */
export function photoFilterFn(id: string, density: number, preserve: boolean) {
  const f = PHOTO_FILTERS[id]; if (!f || density <= 0) return null;
  const [fr, fg, fb] = parseColor(f.color); const m = Math.max(fr, fg, fb) || 1; const kr = fr / m, kg = fg / m, kb = fb / m;
  return (r: number, g: number, b: number): [number, number, number] => {
    let nr = lerp(r, r * kr, density), ng = lerp(g, g * kg, density), nb = lerp(b, b * kb, density);
    if (preserve) {
      const y0 = lum(r, g, b) * 255, y1 = lum(nr, ng, nb) * 255; let s = 1;
      for (const c of [nr, ng, nb]) { const dc = c - y1; if (dc > 1e-9) s = Math.min(s, (255 - y0) / dc); else if (dc < -1e-9) s = Math.min(s, y0 / -dc); }
      nr = y0 + (nr - y1) * s; ng = y0 + (ng - y1) * s; nb = y0 + (nb - y1) * s;
    }
    return [nr, ng, nb];
  };
}

export type LevelsP = { channel: 'rgb' | 'r' | 'g' | 'b'; inBlack: number; inWhite: number; gamma: number; outBlack: number; outWhite: number };
export const levelsNeutral = (l: LevelsP) => l.inBlack === 0 && l.inWhite === 255 && l.gamma === 1 && l.outBlack === 0 && l.outWhite === 255;
/** Tablica 256 wartości Levels: (v − inBlack)/(inWhite − inBlack) → ^(1/gamma) → [outBlack, outWhite]. */
export function levelsLut(l: LevelsP): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256); const ib = clamp(l.inBlack, 0, 254), iw = Math.max(ib + 1, clamp(l.inWhite, 1, 255));
  for (let v = 0; v < 256; v++) { const t = clamp((v - ib) / (iw - ib), 0, 1) ** (1 / l.gamma); lut[v] = Math.round(lerp(l.outBlack, l.outWhite, t)); }
  return lut;
}

export type Curves = Record<'rgb' | 'r' | 'g' | 'b', [number, number][]>;
export const CURVES_IDENTITY: Curves = { rgb: [[0, 0], [1, 1]], r: [[0, 0], [1, 1]], g: [[0, 0], [1, 1]], b: [[0, 0], [1, 1]] };
export const MAX_CURVE_POINTS = 16;
export const curveIsIdentity = (pts: [number, number][]) => pts.every(([x, y]) => x === y);
/** Krzywa przez punkty: monotoniczna interpolacja sześcienna Fritscha–Carlsona (bez przestrzeliwania punktów; plik 01). */
export function curveLut(pts: [number, number][]): Uint8ClampedArray {
  const n = pts.length; const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const lut = new Uint8ClampedArray(256);
  const d: number[] = []; for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = new Array(n);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {                 // warunek Fritscha–Carlsona: |α|, |β| ≤ 3
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i]; const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  for (let v = 0; v < 256; v++) {
    const x = v / 255; let y: number;
    if (x <= xs[0]) y = ys[0]; else if (x >= xs[n - 1]) y = ys[n - 1];
    else {
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      y = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    }
    lut[v] = Math.round(clamp(y, 0, 1) * 255);
  }
  return lut;
}

/** Sprawdzenie wartości parametru Curves (dla resolveParams). */
export function validateCurves(v: unknown): Curves {
  if (!v || typeof v !== 'object') throw new Error('curves must be an object');
  const out = {} as Curves;
  for (const ch of ['rgb', 'r', 'g', 'b'] as const) {
    const pts = (v as Record<string, unknown>)[ch] ?? CURVES_IDENTITY[ch];
    if (!Array.isArray(pts) || pts.length < 2 || pts.length > MAX_CURVE_POINTS) throw new Error(`curves.${ch}: 2–${MAX_CURVE_POINTS} points`);
    let px = -1;
    out[ch] = pts.map((p) => {
      if (!Array.isArray(p) || p.length !== 2 || !p.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error(`curves.${ch}: point must be [x, y] in 0..1`);
      if (p[0] <= px) throw new Error(`curves.${ch}: x must be strictly increasing`); px = p[0];
      return [p[0], p[1]] as [number, number];
    });
  }
  return out;
}
