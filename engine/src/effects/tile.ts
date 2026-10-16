// Rodzina TILE: Pixel Art, Mosaic, Hex Mosaic, Disco, LEGO (plik 02, sekcje 2 i 4). proj.
import type { EffectDef, Img, RenderCtx } from '../core/types.ts';
import { color, common, motionCommon, range, select, seedParam, toggle } from '../core/params.ts';
import { backdrop } from '../core/compose.ts';
import { cellAverages, clamp, hash01, lerp, lum, over, parseColor } from '../core/util.ts';
import { fillRect, paintSDF, paintSDFNear } from '../core/raster.ts';
import { LEGO_COLORS } from '../data/palettes.ts';

const bgSolid = () => ({ ...common('bgMode')[0], default: 'solid' });
const TILE_COMMON = () => [common('coverage')[0], ...common('brightness', 'contrast', 'invert'), bgSolid(), ...common('bgBlur', 'bgColor', 'bgOpacity'), seedParam()];
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Tryby kafelkowe: coverage pomija komorki CIEMNIEJSZE od progu (plik 01, sekcja 3), nie losowo. */
const tileVisible = (t: number, coverage: number) => t >= 1 - coverage / 100 - (coverage >= 100 ? 1 : 0);

function runTiles(ctx: RenderCtx, cs: number, draw: (img: Img, x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, cx: number, cy: number) => void) {
  const out = backdrop(ctx); const a = cellAverages(ctx.prep, cs, cs); ctx.info.cols = a.nx; ctx.info.rows = a.ny;
  for (let cy = 0; cy < a.ny; cy++) for (let cx = 0; cx < a.nx; cx++) {
    const o = cy * a.nx + cx; let t = a.L[o]; if (ctx.p.invert) t = 1 - t; if (!tileVisible(t, ctx.p.coverage)) continue;
    draw(out, cx * cs, cy * cs, Math.min(out.w, (cx + 1) * cs), Math.min(out.h, (cy + 1) * cs), a.R[o], a.G[o], a.B[o], cx, cy);
  }
  return out;
}
/** Obrót koloru wokół osi szarości (1,1,1)/√3 o kąt a (wzór Rodriguesa); zachowuje szarości. */
const hueMatrix = (a: number) => { const c = Math.cos(a), s = Math.sin(a), t = (1 - c) / 3, q = s / Math.sqrt(3); return [c + t, t - q, t + q, t + q, c + t, t - q, t - q, t + q, c + t]; };
const quant = (v: number, n: number) => Math.round((v / 255) * (n - 1)) * (255 / (n - 1));

const pixel: EffectDef = {
  id: 'pixel', name: 'Pixel Art', category: 'Pixels & Blocks', engine: 'TILE', phase: 1,
  description: 'The image reduced to large colour blocks, optionally with a limited palette.',
  params: [range('blockSize', 'Block size', 12, 2, 80, { unit: 'px', px: true }), range('levels', 'Colour levels', 8, 2, 32, { level: 'main' }), toggle('dither', 'Dither', false), ...TILE_COMMON()],
  // etap 2, ruch „breathe” (plik 09: oddychanie rozmiaru bloku; proj): blok × (1 − intensity·(1 − cos 2π·speed·φ)/2), zaokrąglony
  // do całych px, więc rozmiar zmienia się skokami (siatka zaczepiona w lewym górnym rogu)
  motions: [{ id: 'breathe', name: 'Breathe', params: motionCommon(50) }],
  render(ctx) {
    const m = ctx.motion; const base = ctx.px(ctx.p.blockSize); const n = ctx.p.levels;
    /* rozmiar liczony w px przy skali 1, potem × skala: eksport @2x ma tyle samo bloków co podgląd */
    const cs = m ? ctx.px(Math.max(1, Math.round(ctx.p.blockSize * (1 - ((m.p.intensity / 100) * (1 - Math.cos(2 * Math.PI * m.p.speed * m.phase))) / 2)))) : base;
    return runTiles(ctx, cs, (img, x0, y0, x1, y1, r, g, b, cx, cy) => {
      let rr = r, gg = g, bb = b;
      if (ctx.p.dither) { const off = ((BAYER4[(cy & 3) * 4 + (cx & 3)] + 0.5) / 16 - 0.5) * (255 / (n - 1)); rr += off; gg += off; bb += off; }
      fillRect(img, x0, y0, x1, y1, quant(clamp(rr, 0, 255), n), quant(clamp(gg, 0, 255), n), quant(clamp(bb, 0, 255), n));
    });
  },
};
const mosaic: EffectDef = {
  id: 'mosaic', name: 'Mosaic', category: 'Pixels & Blocks', engine: 'TILE', phase: 1,
  description: 'Square tiles of the average colour, separated by grout.',
  params: [range('tileSize', 'Tile size', 14, 4, 80, { unit: 'px', px: true }), range('grout', 'Grout', 1, 0, 12, { unit: 'px', px: true }), color('groutColor', 'Grout colour', '#0a0a0a'), range('tileJitter', 'Tile jitter', 0, 0, 100, { unit: '%', level: 'advanced' }), ...TILE_COMMON()],
  render(ctx) {
    const cs = ctx.px(ctx.p.tileSize); const g = ctx.p.grout === 0 ? 0 : ctx.px(ctx.p.grout); const gc = parseColor(ctx.p.groutColor); const j = ctx.p.tileJitter / 100;
    return runTiles(ctx, cs, (img, x0, y0, x1, y1, r, gr, b, cx, cy) => {
      fillRect(img, x0, y0, x1, y1, gc[0], gc[1], gc[2]); const k = 1 + (hash01(cx, cy, ctx.p.seed) - 0.5) * j * 0.6;
      fillRect(img, x0 + g / 2, y0 + g / 2, x1 - g / 2, y1 - g / 2, clamp(r * k, 0, 255), clamp(gr * k, 0, 255), clamp(b * k, 0, 255));
    });
  },
};
const disco: EffectDef = {
  id: 'disco', name: 'Disco', category: 'Light & Colour', engine: 'TILE', phase: 1,
  description: 'Coloured blocks with strongly boosted saturation, like disco lighting.',
  params: [range('cellSize', 'Cell size', 14, 3, 80, { unit: 'px', px: true }), range('saturation', 'Saturation', 220, 100, 500, { unit: '%' }), ...TILE_COMMON()],
  // etap 2, ruch „hue cycle” (plik 09: cykl kolorów; proj): kolor bloku obrócony wokół osi szarości o 360°·speed·φ
  // (macierz Rodriguesa), zmieszany z kolorem bez obrotu w proporcji intensity
  motions: [{ id: 'hue', name: 'Hue cycle', params: motionCommon(100) }],
  render(ctx) {
    const cs = ctx.px(ctx.p.cellSize); const s = ctx.p.saturation / 100; const m = ctx.motion; const ang = m ? 2 * Math.PI * m.p.speed * m.phase : 0; const H = ang ? hueMatrix(ang) : null; const k = m ? m.p.intensity / 100 : 0;
    return runTiles(ctx, cs, (img, x0, y0, x1, y1, r, g, b) => {
      const l = lum(r, g, b) * 255; let c = [clamp(l + (r - l) * s, 0, 255), clamp(l + (g - l) * s, 0, 255), clamp(l + (b - l) * s, 0, 255)];
      if (H) { const h = [0, 1, 2].map((q) => clamp(H[q * 3] * c[0] + H[q * 3 + 1] * c[1] + H[q * 3 + 2] * c[2], 0, 255)); c = c.map((v, q) => lerp(v, h[q], k)); }
      fillRect(img, x0, y0, x1, y1, c[0], c[1], c[2]);
    });
  },
};
const LEGO_RGB = LEGO_COLORS.map(parseColor);
const nearest = (r: number, g: number, b: number, pal: [number, number, number][]) => { let best = 0, bd = Infinity; for (let i = 0; i < pal.length; i++) { const dr = r - pal[i][0], dg = g - pal[i][1], db = b - pal[i][2]; const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (d < bd) { bd = d; best = i; } } return pal[best]; };
const lego: EffectDef = {
  id: 'lego', name: 'LEGO', category: 'Pixels & Blocks', engine: 'TILE', phase: 1,
  description: 'Brick tiles with a raised stud, colours snapped to a brick palette.',
  params: [range('brickSize', 'Brick size', 18, 6, 60, { unit: 'px', px: true }), select('palette', 'Palette', 'lego', [['lego', 'Brick colours'], ['original', 'Original colours']]), range('studHeight', 'Stud height', 60, 0, 100, { unit: '%' }), ...TILE_COMMON()],
  render(ctx) {
    const cs = ctx.px(ctx.p.brickSize); const sh = ctx.p.studHeight / 100; const rad = cs * 0.34;
    return runTiles(ctx, cs, (img, x0, y0, x1, y1, r, g, b) => {
      const c = ctx.p.palette === 'lego' ? nearest(r, g, b, LEGO_RGB) : [r, g, b]; const gap = Math.max(1, ctx.scale * 0.8);
      fillRect(img, x0, y0, x1, y1, c[0] * 0.55, c[1] * 0.55, c[2] * 0.55); fillRect(img, x0 + gap / 2, y0 + gap / 2, x1 - gap / 2, y1 - gap / 2, c[0], c[1], c[2]);
      if (x1 - x0 < cs || y1 - y0 < cs) return; const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      // krok 6: wypustki rysowane tylko w swoim zasięgu (dalej sd ≥ 0,5, krycie 0)
      paintSDFNear(img, x0, y0, x1, y1, mx, my, rad + 1, (x, y) => Math.hypot(x - mx, y - my) - rad, c[0] * (1 - 0.3 * sh), c[1] * (1 - 0.3 * sh), c[2] * (1 - 0.3 * sh));
      const ox = -rad * 0.12, oy = -rad * 0.12; paintSDFNear(img, x0, y0, x1, y1, mx + ox, my + oy, rad * 0.8 + 1, (x, y) => Math.hypot(x - mx - ox, y - my - oy) - rad * 0.8, clamp(c[0] * (1 + 0.28 * sh) + 12 * sh, 0, 255), clamp(c[1] * (1 + 0.28 * sh) + 12 * sh, 0, 255), clamp(c[2] * (1 + 0.28 * sh) + 12 * sh, 0, 255));
    });
  },
};
const S3 = Math.sqrt(3);
function hexOf(x: number, y: number, R: number, pointy: boolean): [number, number] {
  const qf = pointy ? ((S3 / 3) * x - y / 3) / R : ((2 / 3) * x) / R, rf = pointy ? ((2 / 3) * y) / R : ((-1 / 3) * x + (S3 / 3) * y) / R;
  let q = Math.round(qf), r = Math.round(rf), s = Math.round(-qf - rf); const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s + qf + rf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s; return [q, r];
}
const hexmosaic: EffectDef = {
  id: 'hexmosaic', name: 'Hex Mosaic', category: 'Pixels & Blocks', engine: 'TILE', phase: 1,
  description: 'Honeycomb of hexagonal tiles of the average colour of the area they cover.',
  params: [range('size', 'Size', 14, 4, 80, { unit: 'px', px: true }), select('orientation', 'Orientation', 'pointy', [['pointy', 'Pointy-top'], ['flat', 'Flat-top']]), range('grout', 'Grout', 1, 0, 12, { unit: 'px', px: true }), color('groutColor', 'Grout colour', '#0a0a0a'), ...common('brightness', 'contrast'), seedParam()],
  render(ctx) {
    const R = ctx.px(ctx.p.size); const pointy = ctx.p.orientation === 'pointy'; const { w, h } = ctx.prep; const d = ctx.prep.data; const gp = ctx.p.grout === 0 ? 0 : ctx.px(ctx.p.grout); const gc = parseColor(ctx.p.groutColor);
    // Krok 6: współrzędne kafelka (q, r) liczone raz na piksel (pierwsze przejście) i zapamiętane; cos/sin normalnych raz.
    const sums = new Map<number, number[]>(); const key = (q: number, r: number) => (q + 4096) * 8192 + (r + 4096);
    const Q = new Int32Array(w * h), Rr = new Int32Array(w * h); const tile: number[][] = new Array(w * h);
    let lastK = NaN, lastS: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // = hexOf(x + 0.5, y + 0.5, R, pointy), bez tworzenia tablicy na piksel
      const px = x + 0.5, py = y + 0.5;
      const qf = pointy ? ((S3 / 3) * px - py / 3) / R : ((2 / 3) * px) / R, rf = pointy ? ((2 / 3) * py) / R : ((-1 / 3) * px + (S3 / 3) * py) / R;
      let q = Math.round(qf), r = Math.round(rf); const s3 = Math.round(-qf - rf); const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s3 + qf + rf);
      if (dq > dr && dq > ds) q = -r - s3; else if (dr > ds) r = -q - s3;
      const k = key(q, r); let s = k === lastK ? lastS : sums.get(k); if (!s) { s = [0, 0, 0, 0]; sums.set(k, s); } lastK = k; lastS = s;
      const p = y * w + x, i = p * 4; Q[p] = q; Rr[p] = r; tile[p] = s; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; s[3]++;
    }
    ctx.info.cells = sums.size; const out: Img = { w, h, data: new Uint8ClampedArray(w * h * 4) }; const inr = (R * S3) / 2;
    const NC = (pointy ? [0, 60, 120] : [30, 90, 150]).map((a) => { const rd = (a * Math.PI) / 180; return [Math.cos(rd), Math.sin(rd)]; });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; const q = Q[p], r = Rr[p]; const s = tile[p]; const cx = pointy ? R * S3 * (q + r / 2) : R * 1.5 * q, cy = pointy ? R * 1.5 * r : R * S3 * (r + q / 2);
      const ex = x + 0.5 - cx, ey = y + 0.5 - cy;
      const m = Math.max(Math.max(Math.max(0, Math.abs(ex * NC[0][0] + ey * NC[0][1])), Math.abs(ex * NC[1][0] + ey * NC[1][1])), Math.abs(ex * NC[2][0] + ey * NC[2][1]));
      const ge = clamp(0.5 + (inr - m - gp / 2), 0, 1); const o = (y * w + x) * 4; // ge = udzial koloru kafelka; reszta to spoina
      out.data[o] = lerp(gc[0], s[0] / s[3], ge); out.data[o + 1] = lerp(gc[1], s[1] / s[3], ge); out.data[o + 2] = lerp(gc[2], s[2] / s[3], ge); out.data[o + 3] = 255;
    }
    return out;
  },
};
export const TILE_EFFECTS: EffectDef[] = [pixel, mosaic, lego, hexmosaic, disco];
