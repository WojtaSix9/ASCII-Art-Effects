// Strona /logo (etap 2, krok 8; plik 09, sekcja 7): rysunek logo w znakach i jego pętla. Rysunek i plik TS liczy kod przeniesiony
// z ascii.rest (engine/src/logo/, MIT, Copyright (c) 2026 bas3line); podgląd, SVG, GIF i MP4 odtwarzają ten sam plik (piece()),
// więc wszystkie wyjścia mają tę samą animację co .ts. Pętla jak w ascii.rest (site/src/lib/svg.ts): okres `every` s od chwili
// START + every − 1 (sekunda spokoju, przejście, spokój), więc pętla zaczyna się i kończy między przejściami.
import GLYPHS from '../../../engine/src/logo/glyphs.json' with { type: 'json' };
import { CW, CH, drawCells, layout, type Drawing, type Glyph, type Source, type Style } from '../../../engine/src/logo/logo.ts';
import { about, piece, source, type Settings } from '../../../engine/src/logo/logo-file.ts';
import { animatedSvg } from '../../../engine/src/export/svg.ts';
import type { CellGrid } from '../../../engine/src/core/types.ts';

export const START = 0.5;   // jak w ascii.rest: pierwsze przejście po 0,5 s
/** Tło stron (tokens.css --bg) dla wyjść na ciemnym tle; jasne: biel. */
export const DARK_GROUND: [number, number, number] = [4, 4, 6], LIGHT_GROUND: [number, number, number] = [255, 255, 255];

/** Rysunek logo w siatce około `width` kolumn (jak draw() w ascii.rest: obraz w kanwie siatki CW × CH px na komórkę, potem komórki). */
export function drawLogo(src: Source, width: number, style: Style): Drawing {
  const L = layout(src, width); const c = document.createElement('canvas'); c.width = L.W; c.height = L.H;
  const g = c.getContext('2d', { willReadFrequently: true })!; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(src.canvas, src.x, src.y, src.w, src.h, L.dx, L.dy, L.dw, L.dh);
  return drawCells(g.getImageData(0, 0, L.W, L.H).data, L.cols, L.rows, GLYPHS as Glyph[], style);
}

export type LogoFrame = { text: string[]; color: Uint8Array };
/** Klatki jednej pętli (n = every × fps), odtworzone z pliku piece; dark: druga połowa palety (ciemna strona), jak w README ascii.rest. */
export function loopFrames(d: Drawing, s: Settings, fps: number, dark = true) {
  const p = piece(d, s); const { every } = about(d, s); const from = START + every - 1; const n = Math.max(2, Math.round(every * fps));
  const frame = p.default(p.meta.options as Record<string, unknown>); const cols = p.meta.cols, rows = p.meta.rows;
  const at = (k: number): LogoFrame => { const color = new Uint8Array(cols * rows); const txt = frame(from + k / fps, { paper: !dark, color }); return { text: txt.split('\n'), color }; };
  return { n, at, palette: (p.meta.palette ?? []) as string[], cols, rows, every, fps };
}
const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** Animowane SVG pętli (15 fps, jak SVG w edytorze; technika engine/src/export/svg.ts). */
export function logoSvg(d: Drawing, s: Settings, dark: boolean) {
  const L = loopFrames(d, s, 15, dark); const pal = L.palette.map(rgbOf);
  const grids: CellGrid[] = Array.from({ length: L.n }, (_, k) => {
    const f = L.at(k); const rgb = new Uint8Array(L.cols * L.rows * 3); f.color.forEach((c, i) => rgb.set(pal[c] ?? [255, 255, 255], i * 3));
    return { cols: L.cols, rows: L.rows, cw: 1, ch: 2, text: f.text, rgb, ground: dark ? DARK_GROUND : LIGHT_GROUND, tone: new Float64Array(0), w: 0, h: 0 };
  });
  return animatedSvg(grids, { fps: 15, title: about(d, s).name });
}

/** Klatka jako piksele RGBA: komórka cw × 2cw px, znak Geist Mono na tle (dark: ciemna połowa palety). */
export function rasterizer(d: Drawing, s: Settings, fps: number, cw: number, dark = true) {
  const L = loopFrames(d, s, fps, dark); const ch = 2 * cw; const w = L.cols * cw, h = L.rows * ch;
  const c = new OffscreenCanvas(w, h); const g = c.getContext('2d', { willReadFrequently: true })!;
  const ground = dark ? DARK_GROUND : LIGHT_GROUND;
  const paint = (k: number) => {
    const f = L.at(k); g.fillStyle = `rgb(${ground.join(',')})`; g.fillRect(0, 0, w, h);
    g.font = `${(cw / 0.6).toFixed(2)}px "Geist Mono", ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) { const chr = f.text[y][x]; if (!chr || chr === ' ') continue; g.fillStyle = L.palette[f.color[y * L.cols + x]] ?? '#fff'; g.fillText(chr, (x + 0.5) * cw, y * ch + 0.79 * ch); }
    return g.getImageData(0, 0, w, h).data;
  };
  return { n: L.n, w, h, paint, every: L.every, fps };
}

export { CW, CH, source, about };
