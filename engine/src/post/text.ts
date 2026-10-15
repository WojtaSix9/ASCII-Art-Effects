// Warstwa tekstu (plik 08, zaakceptowany 15 X 2026): rysowana na samym końcu, po Color/Levels/Curves, więc grading jej nie dotyczy
// (plik 01, sekcje 1 i 8). Pozycja i rozmiar w ułamkach ramki (po kadrze), więc napis trafia w to samo miejsce w każdej skali.
// Rysowanie przez kanwę 2D (TextRenderer): w przeglądarce OffscreenCanvas, w Node @napi-rs/canvas. Piksele zależą od rasteryzera.
import type { Img, ParamDef } from '../core/types.ts';
import { color, range, select } from '../core/params.ts';
import { over } from '../core/util.ts';

export const MAX_TEXTS = 4;
export const MAX_TEXT_LEN = 200;
/** Kroje (OFL-1.1, @fontsource). Bebas Neue ma tylko 400: wybór 700 rysuje 400 (bez sztucznego pogrubienia). */
export const TEXT_FONTS: { id: string; name: string; weights: number[] }[] = [
  { id: 'geist-mono', name: 'Geist Mono', weights: [400, 700] },
  { id: 'geist', name: 'Geist', weights: [400, 700] },
  { id: 'playfair', name: 'Playfair Display', weights: [400, 700] },
  { id: 'bebas', name: 'Bebas Neue', weights: [400] },
];
/** Parametry jednego napisu. `text` edytuje osobne pole (wiele linii). x, y w % ramki; size w % wysokości ramki. */
export const TEXT_PARAMS: ParamDef[] = [
  { id: 'text', label: 'Tekst', kind: 'text', default: 'Tekst', level: 'main' },
  select('font', 'Krój', 'geist-mono', TEXT_FONTS.map((f) => [f.id, f.name] as [string, string])),
  select('weight', 'Grubość', '700', [['400', 'Regular'], ['700', 'Bold']]),
  range('size', 'Rozmiar', 8, 1, 50, { unit: '%' }),
  select('align', 'Wyrównanie', 'center', [['left', 'Do lewej'], ['center', 'Do środka'], ['right', 'Do prawej']]),
  color('color', 'Kolor', '#ffffff'),
  range('opacity', 'Krycie', 100, 0, 100, { unit: '%' }),
  range('x', 'X', 50, 0, 100, { unit: '%' }),
  range('y', 'Y', 85, 0, 100, { unit: '%' }),
  range('outline', 'Obrys', 0, 0, 20, { unit: '%' }),
  color('outlineColor', 'Kolor obrysu', '#000000'),
  range('shadow', 'Cień', 0, 0, 100, { unit: '%' }),
  color('shadowColor', 'Kolor cienia', '#000000'),
  range('letterSpacing', 'Odstęp liter', 0, -10, 50, { unit: '%', level: 'advanced' }),
  range('lineHeight', 'Wysokość linii', 120, 80, 200, { unit: '%', level: 'advanced' }),
];
export type TextItem = Record<string, any>;
/** Prostokąt napisu w ułamkach ramki (do zaznaczania i przeciągania w edytorze). */
export type TextBox = { x: number; y: number; w: number; h: number };
/** Rysuje napisy (już sprawdzone) na przezroczystej warstwie w×h; zwraca RGBA z alfą prostą i prostokąty napisów. */
export type TextRenderer = (w: number, h: number, items: TextItem[]) => { data: Uint8ClampedArray; boxes: (TextBox | null)[] };

/** Sprawdza listę napisów (jak resolveParams); najwyżej MAX_TEXTS, tekst przycięty do MAX_TEXT_LEN. */
export function resolveTexts(items: unknown, resolve: (defs: ParamDef[], v: Record<string, any>) => Record<string, any>): TextItem[] {
  if (!Array.isArray(items)) throw new Error('text must be an array');
  if (items.length > MAX_TEXTS) throw new Error(`at most ${MAX_TEXTS} texts`);
  return items.map((it) => { const p = resolve(TEXT_PARAMS, it ?? {}); p.text = String(p.text).slice(0, MAX_TEXT_LEN); return p; });
}
/** Czy napis coś narysuje (pusty, same spacje albo krycie 0 = nic). */
export const textVisible = (t: TextItem) => t.opacity > 0 && t.text.trim().length > 0;

/** Nakłada warstwę tekstu na obraz (w miejscu). */
export function compositeText(img: Img, layer: Uint8ClampedArray) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const a = layer[i + 3]; if (a) over(d, i, layer[i], layer[i + 1], layer[i + 2], a / 255); }
  return img;
}

type Ctx2D = {
  font: string; fillStyle: any; strokeStyle: any; lineWidth: number; lineJoin: any; globalAlpha: number; textBaseline: any;
  shadowColor: string; shadowBlur: number; shadowOffsetX: number; shadowOffsetY: number;
  measureText(t: string): { width: number; actualBoundingBoxAscent: number; actualBoundingBoxDescent: number; actualBoundingBoxLeft: number; actualBoundingBoxRight: number };
  fillText(t: string, x: number, y: number): void; strokeText(t: string, x: number, y: number): void;
  clearRect(x: number, y: number, w: number, h: number): void; drawImage(c: any, x: number, y: number): void;
  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray };
};
type Canvas = { width: number; height: number; getContext(t: '2d'): any };

/** Dostawca tekstu na kanwie. `stacks`: id kroju -> lista czcionek CSS (w Node np. osobne nazwy dla podzbiorów latin i latin-ext). */
export function canvasText(make: (w: number, h: number) => Canvas, stacks: Record<string, string>): TextRenderer {
  return (w, h, items) => {
    const out = make(w, h); const o = out.getContext('2d') as Ctx2D; const tmp = make(w, h); const g = tmp.getContext('2d') as Ctx2D;
    const boxes: (TextBox | null)[] = [];
    for (const t of items) {
      if (!textVisible(t)) { boxes.push(null); continue; }
      const def = TEXT_FONTS.find((f) => f.id === t.font)!; const weight = def.weights.includes(Number(t.weight)) ? Number(t.weight) : def.weights[0];
      const fs = Math.max(1, (t.size / 100) * h); const lh = (t.lineHeight / 100) * fs; const ls = (t.letterSpacing / 100) * fs;
      g.clearRect(0, 0, w, h); g.font = `${weight} ${fs}px ${stacks[t.font]}`; g.textBaseline = 'alphabetic';
      const lines = String(t.text).split('\n');
      // szerokość linii z odstępem liter: znaki rysowane po kolei, przesunięcie = szerokość znaku + odstęp
      const width = (s: string) => (ls ? [...s].reduce((a, c) => a + g.measureText(c).width + ls, 0) - (s.length ? ls : 0) : g.measureText(s).width);
      const m = g.measureText('Hg'); const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;   // pionowy środek linii z metryk „Hg”
      const total = lines.length * lh; const top = (t.y / 100) * h - total / 2; const ax = (t.x / 100) * w;
      const pos = lines.map((s, i) => { const lw = width(s); const x0 = t.align === 'left' ? ax : t.align === 'right' ? ax - lw : ax - lw / 2; return { s, x0, lw, base: top + (i + 0.5) * lh + (asc - desc) / 2 }; });
      const draw = (fn: (s: string, x: number, y: number) => void) => { for (const p of pos) { if (!ls) { fn(p.s, p.x0, p.base); continue; } let x = p.x0; for (const c of p.s) { fn(c, x, p.base); x += g.measureText(c).width + ls; } } };
      const sh = t.shadow / 100;
      if (sh > 0) { g.shadowColor = t.shadowColor; g.shadowBlur = sh * 0.3 * fs; g.shadowOffsetX = sh * 0.06 * fs; g.shadowOffsetY = sh * 0.08 * fs; }
      else { g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; }
      if (t.outline > 0) { g.lineWidth = 2 * (t.outline / 100) * fs; g.lineJoin = 'round'; g.strokeStyle = t.outlineColor; draw((s, x, y) => g.strokeText(s, x, y)); g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; }
      g.fillStyle = t.color; draw((s, x, y) => g.fillText(s, x, y));
      o.globalAlpha = t.opacity / 100; o.drawImage(tmp, 0, 0); o.globalAlpha = 1;   // krycie całego napisu naraz (obrys i wypełnienie się nie sumują)
      const pad = t.outline > 0 ? (t.outline / 100) * fs : 0; const lx = Math.min(...pos.map((p) => p.x0)) - pad, rx = Math.max(...pos.map((p) => p.x0 + p.lw)) + pad;
      boxes.push({ x: lx / w, y: (top - pad) / h, w: (rx - lx) / w, h: (total + 2 * pad) / h });
    }
    return { data: o.getImageData(0, 0, w, h).data, boxes };
  };
}
