// Znaki rysowane kodem zamiast czcionką (decyzja użytkownika po kroku 2, 14 X 2026): Braille (U+2800–28FF) i kształty
// z presetów Dots i Geometric, których nie ma Geist Mono. Wynik nie zależy od czcionki ani urządzenia.
// Maska alfa w×h jak w GlyphProvider; kształty wyśrodkowane w komórce, antyaliasing 1 px (pole odległości ze znakiem).
import { clamp } from './util.ts';

type SD = (x: number, y: number) => number;   // < 0 wewnątrz

const disc = (cx: number, cy: number, r: number): SD => (x, y) => Math.hypot(x - cx, y - cy) - r;
const ring = (cx: number, cy: number, r: number, t: number): SD => (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - (r - t / 2)) - t / 2;
const union = (...f: SD[]): SD => (x, y) => Math.min(...f.map((g) => g(x, y)));
const inter = (a: SD, b: SD): SD => (x, y) => Math.max(a(x, y), b(x, y));
const halfPlane = (nx: number, ny: number, cx: number, cy: number): SD => (x, y) => (x - cx) * nx + (y - cy) * ny;   // < 0 po stronie przeciwnej do n
const box = (cx: number, cy: number, hx: number, hy: number): SD => (x, y) => { const dx = Math.abs(x - cx) - hx, dy = Math.abs(y - cy) - hy; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); };
const diamond = (cx: number, cy: number, r: number): SD => (x, y) => (Math.abs(x - cx) + Math.abs(y - cy) - r) / Math.SQRT2;
/** Trójkąt: wierzchołek w górę (dir = 1) lub w dół (dir = −1), podstawa 2r, wysokość 2r. Odległość ≈ maks. z odległości od boków. */
const triangle = (cx: number, cy: number, r: number, dir: 1 | -1): SD => (x, y) => {
  const px = Math.abs(x - cx), py = (y - cy) * dir;              // py rośnie w stronę podstawy
  return Math.max(py - r, (2 * px - (py + r)) / Math.sqrt(5));
};
const outline = (f: SD, t: number): SD => (x, y) => Math.abs(f(x, y) + t / 2) - t / 2;

// Bity Braille (Unicode): kropki 1–3 lewa kolumna, 4–6 prawa, 7 i 8 dolny rząd.
const BRAILLE_DOTS: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]];
export const brailleDot = (w: number, h: number) => ({ xs: [w * 0.3, w * 0.7], ys: [h * 0.17, h * 0.39, h * 0.61, h * 0.83], r: Math.max(0.6, Math.min(w * 0.13, h * 0.075)) });

function shape(ch: string, w: number, h: number): SD | null {
  const code = ch.codePointAt(0)!;
  if (code >= 0x2800 && code <= 0x28ff) {
    const bits = code - 0x2800; const { xs, ys, r } = brailleDot(w, h);
    const dots = BRAILLE_DOTS.filter((_, i) => bits & (1 << i)).map(([c, row]) => disc(xs[c], ys[row], r));
    return dots.length ? union(...dots) : () => 1;
  }
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.45, t = Math.max(1, R * 0.16);
  switch (ch) {
    case '●': return disc(cx, cy, R);
    case '○': return ring(cx, cy, R, t);
    case '◕': return union(ring(cx, cy, R, t), inter(disc(cx, cy, R), (x, y) => -Math.max(x - cx, y - cy)));    // wszystko poza lewą górną ćwiartką
    case '◑': return union(ring(cx, cy, R, t), inter(disc(cx, cy, R), halfPlane(-1, 0, cx, cy)));                  // prawa połowa
    case '◔': return union(ring(cx, cy, R, t), inter(disc(cx, cy, R), (x, y) => Math.max(-(x - cx), y - cy)));     // prawa górna ćwiartka
    case '∙': return disc(cx, cy, R * 0.3);
    case '◆': return diamond(cx, cy, R);
    case '◇': return outline(diamond(cx, cy, R), t);
    case '◼': return box(cx, cy, R * 0.65, R * 0.65);        // pole 1,69 R² < romb 2 R² (także po próbkowaniu przy 12×20)
    case '▲': return triangle(cx, cy, R * 0.85, 1);
    case '▼': return triangle(cx, cy, R * 0.85, -1);
    case '△': return outline(triangle(cx, cy, R * 0.85, 1), t);
    case '▽': return outline(triangle(cx, cy, R * 0.85, -1), t);
  }
  return null;
}

/** Czy znak jest rysowany kodem (a nie czcionką). */
export const isDrawnGlyph = (ch: string) => shape(ch, 10, 10) !== null;

/** Maska znaku rysowanego kodem albo null, jeśli znak idzie przez czcionkę. */
export function drawnGlyphMask(ch: string, w: number, h: number): Uint8Array | null {
  const sd = shape(ch, w, h); if (!sd) return null;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = Math.round(clamp(0.5 - sd(x + 0.5, y + 0.5), 0, 1) * 255);
  return m;
}
