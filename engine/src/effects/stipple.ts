// Stippling i Pointillize (plik 02, sekcje 3 i 4; proj). Punkty powstają we współrzędnych źródła (px przy skali 1) z seeda,
// więc eksport @2x ma te same punkty, tylko 2× większe. Ciemność i kolor czytane z obrazu zmniejszonego do skali 1.
import type { EffectDef, Img } from '../core/types.ts';
import { color, common, range, seedParam, select } from '../core/params.ts';
import { blur, clamp, hash01, lerp, lum, parseColor, resize } from '../core/util.ts';
import { blueNoise64 } from './dither.ts';

const px1 = () => [...common('brightness', 'contrast')];
const PX = { unit: 'px', px: true } as const;
/** Obraz w skali 1 (współrzędne źródła) i jego wymiary. */
const base = (s: Img, scale: number) => (scale === 1 ? s : resize(s, Math.max(1, Math.round(s.w / scale)), Math.max(1, Math.round(s.h / scale))));
/** Koło z wygładzoną krawędzią, nakładane kolorem c z kryciem a. */
function disc(img: Img, cx: number, cy: number, r: number, c: number[], a = 1) {
  const { w, h, data: d } = img; const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(w - 1, Math.ceil(cx + r + 1)), y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = clamp(0.5 - (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r), 0, 1) * a; if (!k) continue; const i = (y * w + x) * 4;
    d[i] = lerp(d[i], c[0], k); d[i + 1] = lerp(d[i + 1], c[1], k); d[i + 2] = lerp(d[i + 2], c[2], k);
  }
}
const fill = (w: number, h: number, c: number[], alpha: Uint8ClampedArray): Img => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < d.length; i += 4) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = alpha[i + 3]; } return { w, h, data: d }; };

// ---------- Stippling ----------
const stippling: EffectDef = {
  id: 'stippling', name: 'Stippling', category: 'Print & Paper', engine: 'GEOM', phase: 2,
  description: 'An image built from thousands of small dots: dense in shadows, sparse in highlights.',
  params: [range('density', 'Density', 55, 0, 100, { unit: '%' }), range('dotMin', 'Dot min', 1, 0.5, 10, { ...PX, step: 0.5 }), range('dotMax', 'Dot max', 2.5, 0.5, 12, { ...PX, step: 0.5 }),
    select('distribution', 'Distribution', 'bluenoise', [['random', 'Random'], ['bluenoise', 'Blue noise'], ['weighted', 'Weighted Voronoi']]), color('inkColor', 'Ink', '#141414'), color('paperColor', 'Paper', '#f4f1ea'), seedParam(), ...px1()],
  // Kandydaci: siatka o boku g = dotMax·(2,2 − 1,5·gęstość) px źródła, punkt w losowym miejscu komórki; przyjęty, gdy ciemność > próg
  // (random: hasz, blue noise: tekstura 64×64 po indeksach komórek). Weighted: 2 iteracje Lloyda ważone ciemnością (punkty przesuwają się
  // do środka ciężkości swoich komórek Voronoi). Średnica kropki: dotMin…dotMax wg ciemności.
  render(ctx) {
    const sc = ctx.scale; const B = blur(base(ctx.prep, sc), 1, 1); const bw = B.w, bh = B.h; const D = new Float32Array(bw * bh); for (let p = 0, i = 0; p < D.length; p++, i += 4) D[p] = 1 - lum(B.data[i], B.data[i + 1], B.data[i + 2]);
    const dMin = ctx.p.dotMin, dMax = Math.max(ctx.p.dotMin, ctx.p.dotMax); const g = Math.max(0.8, dMax * (2.2 - 1.5 * (ctx.p.density / 100))); const nx = Math.ceil(bw / g), ny = Math.ceil(bh / g);
    const bn = ctx.p.distribution === 'random' ? null : blueNoise64(); const at = (x: number, y: number) => D[clamp(Math.floor(y), 0, bh - 1) * bw + clamp(Math.floor(x), 0, bw - 1)];
    let pts: number[] = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = (i + hash01(i, j, ctx.p.seed)) * g, y = (j + hash01(i, j, ctx.p.seed + 1)) * g; if (x >= bw || y >= bh) continue;
      const thr = bn ? bn[(j & 63) * 64 + (i & 63)] : hash01(i, j, ctx.p.seed + 2); if (at(x, y) > thr) pts.push(x, y);
    }
    if (ctx.p.distribution === 'weighted' && pts.length) pts = lloyd(pts, D, bw, bh, g, 2);
    const out = fill(ctx.prep.w, ctx.prep.h, parseColor(ctx.p.paperColor), ctx.prep.data); const ink = parseColor(ctx.p.inkColor);
    for (let k = 0; k < pts.length; k += 2) { const dk = at(pts[k], pts[k + 1]); disc(out, pts[k] * sc, pts[k + 1] * sc, (lerp(dMin, dMax, dk) / 2) * sc, ink); }
    ctx.info.dots = pts.length / 2; return out;
  },
};
/** Iteracje Lloyda ważone ciemnością: piksel należy do najbliższego punktu (szukanie w kubełkach siatki o boku g). */
function lloyd(pts: number[], D: Float32Array, w: number, h: number, g: number, iters: number) {
  for (let it = 0; it < iters; it++) {
    const n = pts.length / 2; const gx = Math.ceil(w / g), gy = Math.ceil(h / g); const head = new Int32Array(gx * gy).fill(-1), next = new Int32Array(n);
    for (let k = 0; k < n; k++) { const c = clamp(Math.floor(pts[2 * k + 1] / g), 0, gy - 1) * gx + clamp(Math.floor(pts[2 * k] / g), 0, gx - 1); next[k] = head[c]; head[c] = k; }
    const sx = new Float64Array(n), sy = new Float64Array(n), sw = new Float64Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wgt = D[y * w + x]; if (wgt <= 0.02) continue; const px = x + 0.5, py = y + 0.5; const ci = Math.floor(px / g), cj = Math.floor(py / g); let best = -1, bd = Infinity;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= gx || b >= gy) continue; for (let k = head[b * gx + a]; k >= 0; k = next[k]) { const e = (pts[2 * k] - px) ** 2 + (pts[2 * k + 1] - py) ** 2; if (e < bd) { bd = e; best = k; } } }
      if (best >= 0) { sx[best] += px * wgt; sy[best] += py * wgt; sw[best] += wgt; }
    }
    for (let k = 0; k < n; k++) if (sw[k] > 0) { pts[2 * k] = sx[k] / sw[k]; pts[2 * k + 1] = sy[k] / sw[k]; }
  }
  return pts;
}

// ---------- Pointillize ----------
const pointillize: EffectDef = {
  id: 'pointillize', name: 'Pointillize', category: 'Print & Paper', engine: 'GEOM', phase: 2,
  description: 'Pointillism: random round dabs of the image colour, of varying size, partly overlapping.',
  params: [range('dotMin', 'Dot min', 4, 1, 40, PX), range('dotMax', 'Dot max', 10, 1, 60, PX), range('density', 'Density', 60, 0, 100, { unit: '%' }), range('jitter', 'Jitter', 80, 0, 100, { unit: '%' }),
    range('overlap', 'Overlap', 40, 0, 100, { unit: '%' }), color('bgColor', 'Background', '#f4f1ea'), seedParam(), ...px1()],
  // siatka o boku g = dotMax·(1,3 − 0,7·gęstość) px źródła, jedna plamka na komórkę: środek przesunięty o ±jitter/2 komórki,
  // średnica dotMin…dotMax (losowo) × (1 + 0,8·overlap), kolor = średni kolor obrazu w miejscu plamki; kolejność rysowania losowa (seed)
  render(ctx) {
    const sc = ctx.scale; const B0 = base(ctx.prep, sc); const dMin = ctx.p.dotMin, dMax = Math.max(ctx.p.dotMin, ctx.p.dotMax); const g = Math.max(1, dMax * (1.3 - 0.7 * (ctx.p.density / 100)));
    const B = blur(B0, Math.max(1, Math.round(g / 3))); const bw = B.w, bh = B.h; const nx = Math.ceil(bw / g), ny = Math.ceil(bh / g); const jit = ctx.p.jitter / 100, ov = 1 + 0.8 * (ctx.p.overlap / 100);
    const dots: { x: number; y: number; r: number; o: number; c: number[] }[] = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = (i + 0.5 + (hash01(i, j, ctx.p.seed) - 0.5) * jit) * g, y = (j + 0.5 + (hash01(i, j, ctx.p.seed + 1) - 0.5) * jit) * g;
      const sx = clamp(Math.floor(x), 0, bw - 1), sy = clamp(Math.floor(y), 0, bh - 1), q = (sy * bw + sx) * 4;
      dots.push({ x, y, r: (lerp(dMin, dMax, hash01(i, j, ctx.p.seed + 2)) / 2) * ov, o: hash01(i, j, ctx.p.seed + 3), c: [B.data[q], B.data[q + 1], B.data[q + 2]] });
    }
    dots.sort((a, b) => a.o - b.o); const out = fill(ctx.prep.w, ctx.prep.h, parseColor(ctx.p.bgColor), ctx.prep.data);
    for (const d of dots) disc(out, d.x * sc, d.y * sc, d.r * sc, d.c);
    ctx.info.dots = dots.length; return out;
  },
};

export const STIPPLE_EFFECTS: EffectDef[] = [stippling, pointillize];
