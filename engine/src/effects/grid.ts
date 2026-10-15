// Rodzina GRID: Characters, Block, Braille, Dots, Cross, Diamond, Lines, Diagonal (plik 02, sekcja 1 i 4). proj.
import type { EffectDef, Img, RenderCtx } from '../core/types.ts';
import { color, common, range, select, seedParam, toggle } from '../core/params.ts';
import { backdrop, cellVisible } from '../core/compose.ts';
import { cellAverages, clamp, hash01, lerp, over, parseColor } from '../core/util.ts';
import { fillRect, paintSDF, paintSDFNear, sdBox } from '../core/raster.ts';
import { CHARSETS } from '../data/charsets.ts';
import { PALETTES } from '../data/palettes.ts';
import { newImg } from '../core/types.ts';
import { composeGlyphs } from '../post/glyphfx.ts';

const CELL = (def = 10) => range('cellSize', 'Cell size', def, 3, 80, { unit: 'px', px: true });
const COLOR_PARAMS = [select('colorMode', 'Colour', 'image', [['image', 'From image'], ['mono', 'Single colour']]), color('inkColor', 'Ink colour', '#ffffff')];
const GRID_COMMON = () => [...common('coverage', 'brightness', 'contrast', 'invert', 'bgMode', 'bgBlur', 'bgColor'), { ...common('bgOpacity')[0], default: 40, level: 'main' as const }];

type Cell = { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number; t: number; r: number; g: number; b: number };
/** Wspolna petla: srednie komorek z `prep`, ton (z odwroceniem), kolor tuszu, coverage przez hasz; rysuje na tle. */
function runGrid(ctx: RenderCtx, cw: number, ch: number, draw: (img: Img, c: Cell, avg: ReturnType<typeof cellAverages>) => void, tone?: (t: number) => number, target?: Img): Img {
  const out = target ?? backdrop(ctx); const a = cellAverages(ctx.prep, cw, ch); const p = ctx.p; const ink = parseColor(p.inkColor ?? '#ffffff');
  ctx.info.cols = a.nx; ctx.info.rows = a.ny;
  for (let cy = 0; cy < a.ny; cy++) for (let cx = 0; cx < a.nx; cx++) {
    if (!cellVisible(hash01(cx, cy, p.seed ?? 1), p.coverage)) continue;
    const o = cy * a.nx + cx; let t = a.L[o]; if (p.invert) t = 1 - t; if (tone) t = tone(t);
    const img = p.colorMode === 'mono' ? ink : [a.R[o], a.G[o], a.B[o]];
    draw(out, { x0: cx * cw, y0: cy * ch, x1: Math.min(out.w, (cx + 1) * cw), y1: Math.min(out.h, (cy + 1) * ch), cx, cy, t: clamp(t, 0, 1), r: img[0], g: img[1], b: img[2] }, a);
  }
  return out;
}
/** Style glifowe: bez charBloom/charChroma rysują wprost na tle (wynik bez zmian); z nimi znaki idą na przezroczystą warstwę,
 *  którą composeGlyphs nakłada na tło z poświatą i przesunięciem kanałów tylko dla znaków. */
function runGlyphGrid(ctx: RenderCtx, cw: number, ch: number, draw: (img: Img, c: Cell, avg: ReturnType<typeof cellAverages>) => void): Img {
  if (!ctx.glyphFx) return runGrid(ctx, cw, ch, draw);
  const bg = backdrop(ctx); const ink = runGrid(ctx, cw, ch, draw, undefined, newImg(bg.w, bg.h, [0, 0, 0, 0]));
  return composeGlyphs(bg, ink, ctx.glyphFx, ch, ctx.scale);
}
const charCell = (ctx: RenderCtx) => { const fs = ctx.px(ctx.p.cellSize); return { fs, cw: Math.max(1, Math.round(fs * 0.6)), ch: fs }; };

// ---------- Characters ----------
const rampOf = (p: Record<string, any>) => { const r = p.charSet === 'custom' ? String(p.chars) : CHARSETS[p.charSet].ramp; return r.length >= 2 ? r : r + ' '; };
function edgeBoost(ctx: RenderCtx, a: ReturnType<typeof cellAverages>) {
  const k = (ctx.p.edgeEmphasis ?? 0) / 100; if (!k) return null; const e = new Float32Array(a.L.length);
  for (let y = 0; y < a.ny; y++) for (let x = 0; x < a.nx; x++) {
    const L = (xx: number, yy: number) => a.L[clamp(yy, 0, a.ny - 1) * a.nx + clamp(xx, 0, a.nx - 1)];
    e[y * a.nx + x] = Math.min(1, Math.hypot(L(x + 1, y) - L(x - 1, y), L(x, y + 1) - L(x, y - 1)) * 2) * k;
  }
  return e;
}
function charAt(ramp: string, t: number) { return ramp[clamp(Math.round((1 - t) * (ramp.length - 1)), 0, ramp.length - 1)]; }
const characters: EffectDef = {
  id: 'characters', name: 'Characters', category: 'ASCII & Text', engine: 'GRID', phase: 1, needsGlyphs: true,
  description: 'Each cell gets a character from a tonal ramp by brightness.',
  params: [CELL(10), select('charSet', 'Character set', 'standard', [...Object.entries(CHARSETS).map(([k, v]) => [k, v.name] as [string, string]), ['custom', 'Custom']]),
    { id: 'chars', label: 'Chars', kind: 'text', default: '@#S08Xx+=-;:. ', level: 'main' }, ...COLOR_PARAMS, range('edgeEmphasis', 'Edge emphasis', 0, 0, 100, { level: 'advanced', unit: '%' }), ...GRID_COMMON(), seedParam()],
  render(ctx) {
    if (!ctx.glyphs) throw new Error('Characters needs a glyph provider (canvasGlyphs)'); const { fs, cw, ch } = charCell(ctx); const ramp = rampOf(ctx.p); const eb = edgeBoost(ctx, cellAverages(ctx.prep, cw, ch));
    const masks = new Map<string, Uint8Array>();   // krok 6: maska znaku raz na render, nie klucz tekstowy na każdą komórkę
    return runGlyphGrid(ctx, cw, ch, (img, c, a) => {
      const t = eb ? clamp(c.t + eb[c.cy * a.nx + c.cx], 0, 1) : c.t; const chr = charAt(ramp, t); if (chr === ' ') return;
      let m = masks.get(chr); if (!m) { m = ctx.glyphs!.mask(chr, cw, ch, fs); masks.set(chr, m); } const w = c.x1 - c.x0;
      for (let y = c.y0; y < c.y1; y++) for (let x = c.x0; x < c.x1; x++) { const v = m[(y - c.y0) * cw + (x - c.x0)]; if (v && x - c.x0 < w) over(img.data, (y * img.w + x) * 4, c.r, c.g, c.b, v / 255); }
    });
  },
  text(ctx) {
    const { cw, ch } = charCell(ctx); const ramp = rampOf(ctx.p); const a = cellAverages(ctx.prep, cw, ch); const eb = edgeBoost(ctx, a); const rows: string[] = [];
    for (let y = 0; y < a.ny; y++) { let s = ''; for (let x = 0; x < a.nx; x++) { if (!cellVisible(hash01(x, y, ctx.p.seed), ctx.p.coverage)) { s += ' '; continue; } let t = a.L[y * a.nx + x]; if (ctx.p.invert) t = 1 - t; if (eb) t = clamp(t + eb[y * a.nx + x], 0, 1); s += charAt(ramp, t); } rows.push(s); }
    return rows.join('\n') + '\n';
  },
};

// ---------- Block (rysowane prostokatami: bez czcionki) ----------
const QUAD = ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█'; // indeks bitowy: 1 = lewy gorny, 2 = prawy gorny, 4 = lewy dolny, 8 = prawy dolny
const SHADES = ' ░▒▓█';
function blockChar(ctx: RenderCtx, c: { t: number }, sub: { tl: number; tr: number; bl: number; br: number }) {
  const set = ctx.p.blockSet;
  if (set === 'shaded') return SHADES[Math.round(c.t * 4)];
  if (set === 'full') return c.t >= 0.5 ? '█' : ' ';
  const inv = ctx.p.invert; const on = (v: number) => ((inv ? 1 - v : v) >= 0.5 ? 1 : 0);
  if (set === 'half') { const m = (on(sub.tl) | on(sub.tr)) | ((on(sub.bl) | on(sub.br)) << 2); return [' ', '▀', '▄', '█'][(m & 1) | (m >> 1 & 2)]; }
  return QUAD[on(sub.tl) | (on(sub.tr) << 1) | (on(sub.bl) << 2) | (on(sub.br) << 3)];
}
function subTones(ctx: RenderCtx, cw: number, ch: number) {
  const hw = Math.max(1, Math.floor(cw / 2)), hh = Math.max(1, Math.floor(ch / 2)); const a = cellAverages(ctx.prep, hw, hh);
  return (cx: number, cy: number) => { const g = (x: number, y: number) => (x < a.nx && y < a.ny ? a.L[y * a.nx + x] : 0); return { tl: g(2 * cx, 2 * cy), tr: g(2 * cx + 1, 2 * cy), bl: g(2 * cx, 2 * cy + 1), br: g(2 * cx + 1, 2 * cy + 1) }; };
}
const block: EffectDef = {
  id: 'block-chars', name: 'Block', category: 'ASCII & Text', engine: 'GRID', phase: 1,
  description: 'Unicode block characters (full, half, quarter, shaded) picked by tone.',
  params: [CELL(10), select('blockSet', 'Block set', 'quarter', [['full', 'Full'], ['half', 'Half'], ['quarter', 'Quarter'], ['shaded', 'Shaded']]), ...COLOR_PARAMS, ...GRID_COMMON(), seedParam()],
  render(ctx) {
    const { cw, ch } = charCell(ctx); const st = subTones(ctx, cw, ch); const hw = cw / 2, hh = ch / 2;
    return runGlyphGrid(ctx, cw, ch, (img, c) => {
      const chr = blockChar(ctx, c, st(c.cx, c.cy)); const bits = chr === '█' ? 15 : chr === ' ' ? 0 : QUAD.indexOf(chr);
      if (ctx.p.blockSet === 'shaded') { if (chr !== ' ') fillRect(img, c.x0, c.y0, c.x1, c.y1, c.r, c.g, c.b, '░▒▓█'.indexOf(chr) / 4 + 0.25); return; }
      if (ctx.p.blockSet === 'half') { const top = chr === '▀' || chr === '█', bot = chr === '▄' || chr === '█'; if (top) fillRect(img, c.x0, c.y0, c.x1, c.y0 + hh, c.r, c.g, c.b); if (bot) fillRect(img, c.x0, c.y0 + hh, c.x1, c.y1, c.r, c.g, c.b); return; }
      if (bits & 1) fillRect(img, c.x0, c.y0, c.x0 + hw, c.y0 + hh, c.r, c.g, c.b); if (bits & 2) fillRect(img, c.x0 + hw, c.y0, c.x1, c.y0 + hh, c.r, c.g, c.b);
      if (bits & 4) fillRect(img, c.x0, c.y0 + hh, c.x0 + hw, c.y1, c.r, c.g, c.b); if (bits & 8) fillRect(img, c.x0 + hw, c.y0 + hh, c.x1, c.y1, c.r, c.g, c.b);
    });
  },
  text(ctx) {
    const { cw, ch } = charCell(ctx); const st = subTones(ctx, cw, ch); const a = cellAverages(ctx.prep, cw, ch); const rows: string[] = [];
    for (let y = 0; y < a.ny; y++) { let s = ''; for (let x = 0; x < a.nx; x++) { if (!cellVisible(hash01(x, y, ctx.p.seed), ctx.p.coverage)) { s += ' '; continue; } let t = a.L[y * a.nx + x]; if (ctx.p.invert) t = 1 - t; s += blockChar(ctx, { t }, st(x, y)); } rows.push(s); }
    return rows.join('\n') + '\n';
  },
};

// ---------- Braille (kropki rysowane, tekst U+2800..U+28FF) ----------
const BAYER4_N = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const BIT = [[0, 3], [1, 4], [2, 5], [6, 7]]; // [wiersz][kolumna] -> bit
function brailleGeom(ctx: RenderCtx) { const d = ctx.px(ctx.p.dotPitch); return { dw: d, dh: d, cw: 2 * d, ch: 4 * d }; } // rozstaw kropek px: komorka = 2 x 4 kropki, skaluje sie dokladnie
function brailleMask(ctx: RenderCtx, sub: ReturnType<typeof cellAverages>, cx: number, cy: number) {
  let m = 0; const thr = ctx.p.threshold / 100;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const x = 2 * cx + c, y = 4 * cy + r; let t = x < sub.nx && y < sub.ny ? sub.L[y * sub.nx + x] : 0; if (ctx.p.invert) t = 1 - t; const th = ctx.p.dither ? thr + (BAYER4_N[(y & 3) * 4 + (x & 3)] - 0.5) * 0.9 : thr; if (t >= th) m |= 1 << BIT[r][c]; }
  return m;
}
const braille: EffectDef = {
  id: 'braille', name: 'Braille', category: 'ASCII & Text', engine: 'GRID', phase: 1,
  description: '8-dot Braille cells: about twice the detail of a normal character ramp. Monochrome by default; copy as text.',
  params: [range('dotPitch', 'Dot pitch', 3, 1, 16, { unit: 'px', px: true }), range('threshold', 'Threshold', 50, 0, 100, { unit: '%' }), toggle('dither', 'Dither dots', true), ...COLOR_PARAMS.map((p) => (p.id === 'colorMode' ? { ...p, default: 'mono' } : p)), ...GRID_COMMON().map((p) => (p.id === 'bgMode' ? { ...p, default: 'solid' } : p)), seedParam()],
  render(ctx) {
    const { dw, dh, cw, ch } = brailleGeom(ctx); const sub = cellAverages(ctx.prep, dw, dh);
    return runGlyphGrid(ctx, cw, ch, (img, c) => {
      const m = brailleMask(ctx, sub, c.cx, c.cy); const rad = Math.min(dw, dh) * 0.42;
      for (let r = 0; r < 4; r++) for (let q = 0; q < 2; q++) if (m & (1 << BIT[r][q])) { const mx = c.x0 + (q + 0.5) * dw, my = c.y0 + (r + 0.5) * dh; paintSDF(img, Math.floor(mx - rad - 1), Math.floor(my - rad - 1), Math.ceil(mx + rad + 1), Math.ceil(my + rad + 1), (x, y) => Math.hypot(x - mx, y - my) - rad, c.r, c.g, c.b); }
    });
  },
  text(ctx) {
    const { dw, dh, cw, ch } = brailleGeom(ctx); const sub = cellAverages(ctx.prep, dw, dh); const nx = Math.ceil(ctx.prep.w / cw), ny = Math.ceil(ctx.prep.h / ch); const rows: string[] = [];
    for (let y = 0; y < ny; y++) { let s = ''; for (let x = 0; x < nx; x++) s += String.fromCharCode(0x2800 + (cellVisible(hash01(x, y, ctx.p.seed), ctx.p.coverage) ? brailleMask(ctx, sub, x, y) : 0)); rows.push(s); }
    return rows.join('\n') + '\n';
  },
};

// ---------- Ksztalty geometryczne ----------
const SHAPE_COMMON = () => [CELL(12), ...COLOR_PARAMS, ...GRID_COMMON(), seedParam()];
const centre = (c: Cell) => ({ mx: (c.x0 + c.x1) / 2, my: (c.y0 + c.y1) / 2, half: (c.x1 - c.x0) / 2 });
const dots: EffectDef = {
  id: 'dots', name: 'Dots', category: 'ASCII & Text', engine: 'GRID', phase: 1,
  description: 'Round dots whose size follows brightness (halftone-style).',
  params: [CELL(10), select('dotShape', 'Dot shape', 'circle', [['circle', 'Circle'], ['square', 'Square'], ['diamond', 'Diamond']]), range('minDot', 'Min dot', 0, 0, 100, { unit: '%' }), range('maxDot', 'Max dot', 100, 0, 100, { unit: '%' }), ...COLOR_PARAMS, ...GRID_COMMON(), seedParam()],
  render(ctx) {
    const cs = ctx.px(ctx.p.cellSize); const lo = ctx.p.minDot / 100, hi = Math.max(lo, ctx.p.maxDot / 100);
    const sh = ctx.p.dotShape;
    return runGrid(ctx, cs, cs, (img, c) => {
      const { mx, my, half } = centre(c); const r = half * lerp(lo, hi, Math.sqrt(c.t)); if (r < 0.15) return;
      // zasięg: koło i kwadrat r + 0,5, romb √2·(r + 0,5); dalej sd ≥ 0,5
      paintSDFNear(img, c.x0, c.y0, c.x1, c.y1, mx, my, (r + 1) * Math.SQRT2, (x, y) => (sh === 'circle' ? Math.hypot(x - mx, y - my) - r : sh === 'square' ? Math.max(Math.abs(x - mx), Math.abs(y - my)) - r : (Math.abs(x - mx) + Math.abs(y - my)) / Math.SQRT2 - r), c.r, c.g, c.b);
    });
  },
};
const cross: EffectDef = {
  id: 'cross', name: 'Cross', category: 'Geometric', engine: 'GRID', phase: 1,
  description: 'A grid of plus signs scaled by brightness.',
  params: [CELL(12), range('strokeThickness', 'Stroke', 16, 4, 60, { unit: '%' }), range('rotation', 'Rotation', 0, 0, 90, { unit: '°' }), ...COLOR_PARAMS, ...GRID_COMMON(), seedParam()],
  render(ctx) {
    const cs = ctx.px(ctx.p.cellSize); const ang = (ctx.p.rotation * Math.PI) / 180; const ca = Math.cos(ang), sa = Math.sin(ang);   // = rot()
    return runGrid(ctx, cs, cs, (img, c) => {
      const { mx, my, half } = centre(c); const L = half * (0.2 + 0.8 * c.t); const th = Math.max(0.6, ((c.x1 - c.x0) * ctx.p.strokeThickness) / 200);
      // zasięg: sdBox ≥ |p| − przekątna połowy prostokąta, więc dalej niż hypot(L, th) + 0,5 krycie = 0
      paintSDFNear(img, c.x0, c.y0, c.x1, c.y1, mx, my, Math.hypot(L, th) + 1, (x, y) => { const dx = x - mx, dy = y - my; const u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return Math.min(sdBox(u, v, L, th), sdBox(u, v, th, L)); }, c.r, c.g, c.b);
    });
  },
};
const diamond: EffectDef = {
  id: 'diamond', name: 'Diamond', category: 'Geometric', engine: 'GRID', phase: 1,
  description: 'A grid of rhombi sized by tone.',
  params: [CELL(12), select('fill', 'Fill', 'solid', [['solid', 'Solid'], ['outline', 'Outline']]), range('rotation', 'Rotation', 0, 0, 90, { unit: '°' }), ...COLOR_PARAMS, ...GRID_COMMON(), seedParam()],
  render(ctx) {
    const cs = ctx.px(ctx.p.cellSize); const ang = (ctx.p.rotation * Math.PI) / 180; const lw = Math.max(1, ctx.scale * 1.2); const ca = Math.cos(ang), sa = Math.sin(ang); const outline = ctx.p.fill === 'outline';
    return runGrid(ctx, cs, cs, (img, c) => {
      const { mx, my, half } = centre(c); const R = half * 1.3 * Math.max(0.12, c.t);
      // zasięg: |u| + |v| ≥ |p|, więc dalej niż R + lw + 1 krycie = 0 (także dla obrysu)
      paintSDFNear(img, c.x0, c.y0, c.x1, c.y1, mx, my, R + lw + 1, (x, y) => { const dx = x - mx, dy = y - my; const u = dx * ca + dy * sa, v = -dx * sa + dy * ca; const sd = (Math.abs(u) + Math.abs(v) - R) / Math.SQRT2; return outline ? Math.abs(sd) - lw / 2 : sd; }, c.r, c.g, c.b);
    });
  },
};
const lines: EffectDef = {
  id: 'lines', name: 'Lines', category: 'Geometric', engine: 'GRID', phase: 1,
  description: 'Horizontal or vertical segments whose thickness follows brightness.',
  params: [CELL(10), select('orientation', 'Orientation', 'horizontal', [['horizontal', 'Horizontal'], ['vertical', 'Vertical']]), range('thickness', 'Max thickness', 70, 5, 100, { unit: '%' }), ...COLOR_PARAMS, ...GRID_COMMON(), seedParam()],
  render(ctx) {
    const cs = ctx.px(ctx.p.cellSize); const vert = ctx.p.orientation === 'vertical';
    return runGrid(ctx, cs, cs, (img, c) => {
      const { mx, my, half } = centre(c); const th = (half * ctx.p.thickness / 100) * c.t; if (th < 0.15) return;
      paintSDF(img, c.x0, c.y0, c.x1, c.y1, (x, y) => (vert ? sdBox(x - mx, y - my, th, half) : sdBox(x - mx, y - my, half, th)), c.r, c.g, c.b);
    });
  },
};
const diagonal: EffectDef = {
  id: 'diagonal', name: 'Diagonal', category: 'Geometric', engine: 'GRID', phase: 1,
  description: 'Slanted strokes whose thickness follows brightness.',
  params: [CELL(10), range('angle', 'Angle', 45, 0, 180, { unit: '°' }), range('thickness', 'Max thickness', 70, 5, 100, { unit: '%' }), ...COLOR_PARAMS, ...GRID_COMMON(), seedParam()],
  render(ctx) {
    const cs = ctx.px(ctx.p.cellSize); const ang = (ctx.p.angle * Math.PI) / 180; const ca = Math.cos(-ang), sa = Math.sin(-ang);   // = rot(…, −ang)
    return runGrid(ctx, cs, cs, (img, c) => {
      const { mx, my, half } = centre(c); const th = (half * ctx.p.thickness / 100) * c.t; if (th < 0.15) return;
      paintSDF(img, c.x0, c.y0, c.x1, c.y1, (x, y) => { const dx = x - mx, dy = y - my; const u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return sdBox(u, v, half * 1.45, th); }, c.r, c.g, c.b);
    });
  },
};

// ---------- ASCII Studio (plik 01 sekcja 9, plik 02; docs: kontrolki; wzory i interpretacje: proj) ----------
// Glyph: kształty albo znaki; kolor komórki z palety wg tonu (paleta posortowana po jasności; „Original” = kolor obrazu).
// Shape + Mix (proj?): mix = jak mocno rozmiar kształtu zależy od tonu (0 = pełna komórka, 100 = w pełni wg tonu).
// Seed (docs: „jedno ziarno steruje paletą, levels i gradingiem”): z seeda liczba poziomów tonu (3–8) i gamma (0,7–1,5).
// Blend Mode + Opacity (proj): jak warstwa znaków/kształtów nakłada się na tło (domyślnie czarne).
const BLENDS: [string, string][] = [['normal', 'Normal'], ['screen', 'Screen'], ['multiply', 'Multiply'], ['overlay', 'Overlay'], ['add', 'Add']];
const blendCh = (m: string, b: number, s: number) => m === 'screen' ? 255 - ((255 - b) * (255 - s)) / 255 : m === 'multiply' ? (b * s) / 255 : m === 'overlay' ? (b < 128 ? (2 * b * s) / 255 : 255 - (2 * (255 - b) * (255 - s)) / 255) : m === 'add' ? Math.min(255, b + s) : s;
const studioShape = (sh: string, dx: number, dy: number, r: number) => sh === 'circle' ? Math.hypot(dx, dy) - r : sh === 'square' ? Math.max(Math.abs(dx), Math.abs(dy)) - r
  : sh === 'diamond' ? (Math.abs(dx) + Math.abs(dy)) / Math.SQRT2 - r * 0.9 : sh === 'triangle' ? Math.max(Math.abs(dx) * 0.866 + dy * 0.5, -dy) - r * 0.5 : Math.min(sdBox(dx, dy, r, r * 0.3), sdBox(dx, dy, r * 0.3, r));
const asciiStudio: EffectDef = {
  id: 'asciiStudio', name: 'ASCII Studio', category: 'ASCII & Text', engine: 'GRID', phase: 2, needsGlyphs: true,
  description: 'Designed shapes or characters coloured through a palette, on black by default; one seed sets levels and grading.',
  params: [CELL(10), select('glyph', 'Glyph', 'shapes', [['shapes', 'Shapes'], ['characters', 'Characters']]), select('shape', 'Shape', 'circle', [['circle', 'Circle'], ['square', 'Square'], ['diamond', 'Diamond'], ['triangle', 'Triangle'], ['plus', 'Plus']]),
    range('mix', 'Mix', 70, 0, 100, { unit: '%' }), select('charSet', 'Chars', 'standard', Object.entries(CHARSETS).map(([k, v]) => [k, v.name] as [string, string])),
    select('palette', 'Palette', 'cyberpunk', Object.entries(PALETTES).map(([k, v]) => [k, v.name] as [string, string])), select('blendMode', 'Blend mode', 'normal', BLENDS), range('opacity', 'Opacity', 100, 0, 100, { unit: '%' }),
    ...GRID_COMMON().map((p) => (p.id === 'bgMode' ? { ...p, default: 'solid' } : p)), seedParam()],
  render(ctx) {
    const p = ctx.p; const chars = p.glyph === 'characters'; if (chars && !ctx.glyphs) throw new Error('ASCII Studio (characters) needs a glyph provider (canvasGlyphs)');
    const { fs, cw, ch } = chars ? charCell(ctx) : { fs: 0, cw: ctx.px(p.cellSize), ch: ctx.px(p.cellSize) };
    const levels = 3 + Math.floor(hash01(p.seed, 0, 91) * 6), gamma = 0.7 + hash01(p.seed, 1, 91) * 0.8;
    const pal = PALETTES[p.palette].colors?.map(parseColor).sort((a, b) => (a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722) - (b[0] * 0.2126 + b[1] * 0.7152 + b[2] * 0.0722)) ?? null;
    const tone = (t: number) => Math.round(Math.pow(clamp(t, 0, 1), gamma) * (levels - 1)) / (levels - 1);
    const ramp = CHARSETS[p.charSet].ramp.length >= 2 ? CHARSETS[p.charSet].ramp : CHARSETS[p.charSet].ramp + ' '; const masks = new Map<string, Uint8Array>(); const mix = p.mix / 100;
    const bg = backdrop(ctx); const layer = runGrid(ctx, cw, ch, (img, c) => {
      const t = tone(c.t); const col = pal ? pal[Math.round(t * (pal.length - 1))] : [c.r, c.g, c.b];
      if (chars) {
        const chr = charAt(ramp, t); if (chr === ' ') return; let m = masks.get(chr); if (!m) { m = ctx.glyphs!.mask(chr, cw, ch, fs); masks.set(chr, m); } const w = c.x1 - c.x0;
        for (let y = c.y0; y < c.y1; y++) for (let x = c.x0; x < c.x1; x++) { const v = m[(y - c.y0) * cw + (x - c.x0)]; if (v && x - c.x0 < w) over(img.data, (y * img.w + x) * 4, col[0], col[1], col[2], v / 255); }
        return;
      }
      const { mx, my, half } = centre(c); const r = half * lerp(1, Math.sqrt(t), mix); if (r < 0.15) return; const sh = p.shape;
      paintSDFNear(img, c.x0, c.y0, c.x1, c.y1, mx, my, (r + 1) * 1.5, (x, y) => studioShape(sh, x - mx, y - my, r), col[0], col[1], col[2]);
    }, undefined, newImg(bg.w, bg.h, [0, 0, 0, 0]));
    const k = p.opacity / 100, m = p.blendMode, d = bg.data, L = layer.data;
    for (let i = 0; i < d.length; i += 4) { const a = (L[i + 3] / 255) * k; if (!a) continue; for (let q = 0; q < 3; q++) d[i + q] = lerp(d[i + q], blendCh(m, d[i + q], L[i + q]), a); if (d[i + 3] < 255) d[i + 3] = Math.max(d[i + 3], L[i + 3] * k); }
    return bg;
  },
};
export const GRID_EFFECTS: EffectDef[] = [characters, block, braille, dots, cross, diamond, lines, diagonal, asciiStudio];
