// Character Bloom i Character Chromatic (plik 01, sekcja 8): działają per glif w trybach glifowych, a nie jako przebieg po klatce.
// Realizacja (proj): styl glifowy rysuje znaki na osobnej, przezroczystej warstwie tuszu. Ta funkcja nakłada warstwę na tło:
// Chroma przesuwa kanały R i B samego tuszu (tło zostaje na miejscu), a Bloom dodaje poświatę z rozmytego tuszu (tryb screen).
// Obie rzeczy dotyczą więc tylko znaków, a ich kolejność jest stała: najpierw tusz z Chromą, potem poświata.
import type { Img } from '../core/types.ts';
import { blur } from '../core/util.ts';

export type GlyphFx = { bloom: number; chroma: number };
/** Style, które rysują znaki (mają też eksport tekstowy). Tylko w nich działają charBloom i charChroma (proj). */
export const GLYPH_STYLES = new Set(['characters', 'block-chars', 'braille']);
/** Promień poświaty jako ułamek wysokości komórki: poświata należy do znaku, więc rośnie z rozmiarem komórki i skalą (proj). */
export const BLOOM_RADIUS = 0.35;
/** Wzmocnienie poświaty przy Intensity 100 (proj). */
export const BLOOM_GAIN = 2;

/** bg: tło stylu; ink: warstwa znaków (alfa prosta, poza znakami 0); cellH: wysokość komórki w px renderu. Zwraca nowy obraz. */
export function composeGlyphs(bg: Img, ink: Img, fx: GlyphFx, cellH: number, scale: number): Img {
  const { w, h } = bg; const b = bg.data, s = ink.data; const out = new Uint8ClampedArray(b.length);
  const dx = fx.chroma > 0 ? Math.max(1, Math.round(fx.chroma * scale)) : 0;
  let glow: Uint8ClampedArray | null = null; const k = (fx.bloom / 100) * BLOOM_GAIN;
  if (k > 0) {
    const pm = new Uint8ClampedArray(s.length);   // tusz z alfą przemnożoną, żeby rozmycie nie ciągnęło koloru z pustych pikseli
    for (let i = 0; i < s.length; i += 4) { const a = s[i + 3] / 255; pm[i] = s[i] * a; pm[i + 1] = s[i + 1] * a; pm[i + 2] = s[i + 2] * a; pm[i + 3] = s[i + 3]; }
    glow = blur({ w, h, data: pm }, Math.max(1, Math.round(cellH * BLOOM_RADIUS))).data;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; let A = b[i + 3] / 255; let r = b[i] * A, g = b[i + 1] * A, bl = b[i + 2] * A;   // alfa przemnożona
    // Chroma: R z tuszu przesuniętego w prawo, B w lewo, G na miejscu. Poza obrazem tuszu brak.
    const iR = x - dx >= 0 ? i - dx * 4 : -1, iB = x + dx < w ? i + dx * 4 : -1;
    const aR = iR >= 0 ? s[iR + 3] / 255 : 0, aG = s[i + 3] / 255, aB = iB >= 0 ? s[iB + 3] / 255 : 0;
    if (aR > 0) r = s[iR] * aR + r * (1 - aR);
    if (aG > 0) g = s[i + 1] * aG + g * (1 - aG);
    if (aB > 0) bl = s[iB + 2] * aB + bl * (1 - aB);
    A = A + (1 - A) * Math.max(aR, aG, aB);
    if (glow) {   // screen w alfie przemnożonej; przy nieprzezroczystym tle to zwykły screen koloru
      const qr = Math.min(255, glow[i] * k), qg = Math.min(255, glow[i + 1] * k), qb = Math.min(255, glow[i + 2] * k), qa = Math.min(1, (glow[i + 3] / 255) * k);
      r += qr - (r * qr) / 255; g += qg - (g * qg) / 255; bl += qb - (bl * qb) / 255; A += qa - A * qa;
    }
    if (A > 0) { out[i] = r / A; out[i + 1] = g / A; out[i + 2] = bl / A; out[i + 3] = A * 255; }
  }
  return { w, h, data: out };
}
