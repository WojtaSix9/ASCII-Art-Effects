// Dither: 15 algorytmow x 15 palet (plik 01, sekcja 5). Implementacja wlasna (proj); algorytmy standardowe.
import type { EffectDef, Img, RenderCtx } from '../core/types.ts';
import { common, range, select, seedParam } from '../core/params.ts';
import type { MotionDef } from '../core/types.ts';
import { clamp, hash01, lerp, lum, mulberry32, parseColor, resize } from '../core/util.ts';
import { PALETTES } from '../data/palettes.ts';

export const ALGORITHMS = ['bayer2', 'bayer4', 'bayer8', 'bayer16', 'halftone', 'radial', 'linesH', 'linesV', 'linesD', 'whiteNoise', 'blueNoise', 'floyd', 'atkinson', 'stucki', 'sierraLite'] as const;
const ORDERED = new Set(['bayer2', 'bayer4', 'bayer8', 'bayer16', 'halftone', 'radial', 'linesH', 'linesV', 'linesD', 'whiteNoise', 'blueNoise']);
const RAMP = new Set(['mono', 'grey4', 'grey8', 'gameboy', 'sepia']); // palety jako rampa jasnosci (ciemna -> jasna)

function bayer(n: number): Float32Array { // n = 2^k, wartosci (v + 0.5) / n^2
  let m = [[0]]; for (let s = 1; s < n; s *= 2) { const nm: number[][] = Array.from({ length: 2 * s }, () => new Array(2 * s).fill(0)); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const v = m[y][x] * 4; nm[y][x] = v; nm[y][x + s] = v + 2; nm[y + s][x] = v + 3; nm[y + s][x + s] = v + 1; } m = nm; }
  const o = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) o[y * n + x] = (m[y][x] + 0.5) / (n * n); return o;
}
function clustered(): Float32Array { // klastrowy punkt 8x8: rosnaca odleglosc od srodka komorki
  const idx: [number, number, number][] = []; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) idx.push([y * 8 + x, Math.hypot(x - 3.5, y - 3.5) + 0.001 * Math.atan2(y - 3.5, x - 3.5), 0]);
  idx.sort((a, b) => a[1] - b[1]); const o = new Float32Array(64); idx.forEach((e, r) => { o[e[0]] = (r + 0.5) / 64; }); return o;
}
let BLUE: Float32Array | null = null;
/** Szum niebieski 64x64 metoda void-and-cluster (Ulichney), deterministyczny; wartosci to unikalne rangi (r + 0.5) / 4096. */
export function blueNoise64(): Float32Array {
  if (BLUE) return BLUE; const N = 64, T = N * N, sigma = 1.5, R = 6; const rnd = mulberry32(12345); const kern: number[] = []; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) kern.push(Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)));
  const energy = new Float32Array(T); const bin = new Uint8Array(T);
  const splat = (p: number, sgn: number) => { const px = p % N, py = (p / N) | 0; let k = 0; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) energy[((py + dy + N) % N) * N + ((px + dx + N) % N)] += sgn * kern[k++]; };
  const pick = (want: number, max: boolean) => { let best = -1, bv = max ? -Infinity : Infinity; for (let p = 0; p < T; p++) if (bin[p] === want) { const e = energy[p]; if (max ? e > bv : e < bv) { bv = e; best = p; } } return best; };
  const ones = Math.round(T * 0.1); let c = 0; while (c < ones) { const p = Math.floor(rnd() * T); if (!bin[p]) { bin[p] = 1; splat(p, 1); c++; } }
  for (let it = 0; it < 4 * T; it++) { const a = pick(1, true); bin[a] = 0; splat(a, -1); const b = pick(0, false); if (b === a) { bin[a] = 1; splat(a, 1); break; } bin[b] = 1; splat(b, 1); }
  const rank = new Float32Array(T); const b0 = new Uint8Array(bin); const e0 = new Float32Array(energy);
  for (let r = ones - 1; r >= 0; r--) { const p = pick(1, true); bin[p] = 0; splat(p, -1); rank[p] = r; }               // faza 1
  bin.set(b0); energy.set(e0);
  let r = ones; while (r < T) { const p = pick(0, false); rank[p] = r++; bin[p] = 1; splat(p, 1); }                    // fazy 2 i 3: wstawianie w najwieksza pustke az do pelnego wypelnienia
  BLUE = new Float32Array(T); for (let p = 0; p < T; p++) BLUE[p] = (rank[p] + 0.5) / T; return BLUE;
}

type Pal = { colors: [number, number, number][]; ramp: boolean };
const palOf = (id: string): Pal | null => { const p = PALETTES[id]; if (!p.colors) return null; return { colors: p.colors.map(parseColor), ramp: RAMP.has(id) }; };
const nearestIdx = (r: number, g: number, b: number, pal: [number, number, number][]) => { let best = 0, bd = Infinity; for (let i = 0; i < pal.length; i++) { const dr = r - pal[i][0], dg = g - pal[i][1], db = b - pal[i][2]; const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (d < bd) { bd = d; best = i; } } return best; };

const KERNELS: Record<string, { dx: number; dy: number; w: number }[]> = {
  floyd: [{ dx: 1, dy: 0, w: 7 / 16 }, { dx: -1, dy: 1, w: 3 / 16 }, { dx: 0, dy: 1, w: 5 / 16 }, { dx: 1, dy: 1, w: 1 / 16 }],
  atkinson: [{ dx: 1, dy: 0, w: 1 / 8 }, { dx: 2, dy: 0, w: 1 / 8 }, { dx: -1, dy: 1, w: 1 / 8 }, { dx: 0, dy: 1, w: 1 / 8 }, { dx: 1, dy: 1, w: 1 / 8 }, { dx: 0, dy: 2, w: 1 / 8 }],
  stucki: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]].map(([dx, dy, w]) => ({ dx, dy, w: w / 42 })),
  sierraLite: [{ dx: 1, dy: 0, w: 2 / 4 }, { dx: -1, dy: 1, w: 1 / 4 }, { dx: 0, dy: 1, w: 1 / 4 }],
};
/** Ruch macierzy (etap 2): flow = przesunięcie wzoru (px, całkowite), shift = przesunięcie fazy wzorów okresowych (linie, radial)
 *  o ułamek okresu, shimmer = przesunięcie każdego progu o ułamek cyklu (wartość progu krąży przez cały zakres). */
export type DitherMotion = { ox: number; oy: number; shift: number; shimmer: number };
function thresholdAt(alg: string, x: number, y: number, W: number, H: number, angle: number, seed: number, period: number, mv?: DitherMotion): number {
  if (!mv) return thresholdAt0(alg, x, y, W, H, angle, seed, period, 0);
  let t: number;
  if (alg === 'whiteNoise') t = thresholdAt0(alg, (((x + mv.ox) % W) + W) % W, (((y + mv.oy) % H) + H) % H, W, H, angle, seed, period, 0);   // szum bez struktury: zawinięcie na krawędzi obrazu niewidoczne
  else if (alg === 'radial' || alg.startsWith('lines')) t = thresholdAt0(alg, x, y, W, H, angle, seed, period, mv.shift);
  else t = thresholdAt0(alg, x + mv.ox, y + mv.oy, W, H, angle, seed, period, 0);   // wzory kafelkowe (Bayer, halftone, blue noise): przesunięcie o wielokrotność kafla zamyka pętlę
  if (mv.shimmer) { t += mv.shimmer; t -= Math.floor(t); }
  return t;
}
function thresholdAt0(alg: string, x: number, y: number, W: number, H: number, angle: number, seed: number, period: number, shift: number): number {
  switch (alg) {
    case 'bayer2': return BAY[2][(y & 1) * 2 + (x & 1)]; case 'bayer4': return BAY[4][(y & 3) * 4 + (x & 3)]; case 'bayer8': return BAY[8][(y & 7) * 8 + (x & 7)]; case 'bayer16': return BAY[16][(y & 15) * 16 + (x & 15)];
    case 'halftone': return CLUSTER[(y & 7) * 8 + (x & 7)];
    case 'radial': { const d = Math.hypot(x - W / 2, y - H / 2); const f = shift ? ((((d / period - shift) % 1) + 1) % 1) : (d / period) % 1; return (f < 0.5 ? f * 2 : 2 - f * 2) * 0.96 + 0.02; }
    case 'linesH': case 'linesV': case 'linesD': { const base = alg === 'linesH' ? 0 : alg === 'linesV' ? 90 : 45; const a = ((base + angle) * Math.PI) / 180; const c = x * Math.sin(a) + y * Math.cos(a); const f = ((((c + 0.5) / period - shift) % 1) + 1) % 1; return (f < 0.5 ? f * 2 : 2 - f * 2) * 0.96 + 0.02; }
    case 'whiteNoise': return hash01(x, y, seed);
    case 'blueNoise': return blueNoise64()[(y & 63) * 64 + (x & 63)];
  } throw new Error(`unknown algorithm ${alg}`);
}
const BAY: Record<number, Float32Array> = { 2: bayer(2), 4: bayer(4), 8: bayer(8), 16: bayer(16) }; const CLUSTER = clustered();

/** Dithering obrazu (RGBA) do palety; zwraca nowy obraz tej samej wielkosci. Wspolrzedne wzorow w pikselach obrazu. */
export function ditherImage(src: Img, o: { algorithm: string; palette: string; chroma: string; threshold: number; angle: number; seed: number; levels: number; period: number; motion?: DitherMotion }): Img {
  const { w, h } = src; const d = src.data; const out = new Uint8ClampedArray(d.length); const pal = palOf(o.palette); const bias = (50 - o.threshold) / 100;
  const ramp = pal ? pal.ramp || o.chroma === 'luma' : true; const n = pal ? pal.colors.length : o.levels;
  const lumaPal = pal && ramp ? [...pal.colors].sort((a, b) => lum(...a) - lum(...b)) : null;
  const spread = !pal || ramp ? 1 / (n - 1) : 1 / (Math.ceil(Math.cbrt(n)) - 1);
  const emit = (i: number, r: number, g: number, b: number) => { out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = d[i + 3]; };
  if (ORDERED.has(o.algorithm)) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const t = thresholdAt(o.algorithm, x, y, w, h, o.angle, o.seed, o.period, o.motion) - 0.5;
      if (ramp) { const L = clamp(lum(d[i], d[i + 1], d[i + 2]) + bias + t * spread, 0, 1); const k = clamp(Math.round(L * (n - 1)), 0, n - 1);
        if (!pal) { const Lq = k / (n - 1), L0 = Math.max(lum(d[i], d[i + 1], d[i + 2]), 1e-3); const s = Lq / L0; emit(i, clamp(d[i] * s, 0, 255), clamp(d[i + 1] * s, 0, 255), clamp(d[i + 2] * s, 0, 255)); } else { const c = lumaPal![k]; emit(i, c[0], c[1], c[2]); } }
      else { const e = t * spread * 255 + bias * 255; const c = pal!.colors[nearestIdx(clamp(d[i] + e, 0, 255), clamp(d[i + 1] + e, 0, 255), clamp(d[i + 2] + e, 0, 255), pal!.colors)]; emit(i, c[0], c[1], c[2]); }
    }
  } else {
    const K = KERNELS[o.algorithm]; const buf = new Float32Array(w * h * 3); for (let p = 0; p < w * h; p++) { buf[p * 3] = d[p * 4]; buf[p * 3 + 1] = d[p * 4 + 1]; buf[p * 3 + 2] = d[p * 4 + 2]; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4; let r = buf[p * 3] + bias * 255, g = buf[p * 3 + 1] + bias * 255, b = buf[p * 3 + 2] + bias * 255; let qr: number, qg: number, qb: number;
      if (ramp) { const L = clamp(lum(r, g, b), 0, 1); const k = clamp(Math.round(L * (n - 1)), 0, n - 1); const Lq = k / (n - 1);
        if (!pal) { const L0 = Math.max(L, 1e-3), s = Lq / L0; qr = clamp(r * s, 0, 255); qg = clamp(g * s, 0, 255); qb = clamp(b * s, 0, 255); emit(i, qr, qg, qb); const er = (L - Lq) * 255; for (const t of K) { const xx = x + t.dx, yy = y + t.dy; if (xx < 0 || xx >= w || yy >= h) continue; const q = (yy * w + xx) * 3; buf[q] += er * t.w; buf[q + 1] += er * t.w; buf[q + 2] += er * t.w; } continue; }
        const c = lumaPal![k]; qr = c[0]; qg = c[1]; qb = c[2]; const er = (L - Lq) * 255; emit(i, qr, qg, qb); for (const t of K) { const xx = x + t.dx, yy = y + t.dy; if (xx < 0 || xx >= w || yy >= h) continue; const q = (yy * w + xx) * 3; buf[q] += er * t.w; buf[q + 1] += er * t.w; buf[q + 2] += er * t.w; } continue; }
      const c = pal!.colors[nearestIdx(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255), pal!.colors)]; qr = c[0]; qg = c[1]; qb = c[2]; emit(i, qr, qg, qb);
      const er = r - qr, eg = g - qg, eb = b - qb; for (const t of K) { const xx = x + t.dx, yy = y + t.dy; if (xx < 0 || xx >= w || yy >= h) continue; const q = (yy * w + xx) * 3; buf[q] += er * t.w; buf[q + 1] += eg * t.w; buf[q + 2] += eb * t.w; }
    }
  }
  return { w, h, data: out };
}

// Etap 2 (plik 09, Tier B; plik 01 sekcja 9: macierz „płynie” w 8 kierunkach, tryb shimmer; proj): tylko algorytmy uporządkowane.
// Dyfuzja błędu „gotuje się” w ruchu, więc dla niej ruch jest wyłączony (onlyIf) i UI to mówi. u = część ułamkowa speed·φ.
// flow: wzór przesuwa się o `tiles` kafli na cykl (kafel: Bayer n, halftone 8, blue noise 64) w jednym z 8 kierunków; linie i radial
// przesuwają fazę o `tiles` okresów (wzdłuż swojej normalnej, kierunek bez znaczenia); white noise przewija się przez cały obraz.
// shimmer: każdy próg przesuwa się o u cyklu, więc wzór „mieni się” w miejscu.
const ORDERED_IDS = ['bayer2', 'bayer4', 'bayer8', 'bayer16', 'halftone', 'radial', 'linesH', 'linesV', 'linesD', 'whiteNoise', 'blueNoise'];
const ONLY_ORDERED = { param: 'algorithm', values: ORDERED_IDS, note: 'Dyfuzja błędu (Floyd–Steinberg, Atkinson, Stucki, Sierra Lite) migocze w ruchu, więc nie ma animacji. Wybierz algorytm uporządkowany (Bayer, Halftone, Radial, Lines, Noise).' };
const DIRS: Record<string, [number, number]> = { e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1], n: [0, -1], ne: [1, -1] };
const DITHER_MOTIONS: MotionDef[] = [
  { id: 'flow', name: 'Flow', onlyIf: ONLY_ORDERED, params: [range('speed', 'Speed (cycles per loop)', 1, 1, 8), select('direction', 'Direction', 'se', [['n', '↑ N'], ['ne', '↗ NE'], ['e', '→ E'], ['se', '↘ SE'], ['s', '↓ S'], ['sw', '↙ SW'], ['w', '← W'], ['nw', '↖ NW']]), range('tiles', 'Distance (pattern tiles per cycle)', 3, 1, 16)] },
  { id: 'shimmer', name: 'Shimmer', onlyIf: ONLY_ORDERED, params: [range('speed', 'Speed (cycles per loop)', 1, 1, 8)] },
];
const TILE: Record<string, number> = { bayer2: 2, bayer4: 4, bayer8: 8, bayer16: 16, halftone: 8, blueNoise: 64 };
function ditherMotion(ctx: RenderCtx, w: number, h: number): DitherMotion | undefined {
  const m = ctx.motion; if (!m) return undefined; const v = m.p.speed * m.phase; const u = v - Math.floor(v);
  if (m.id === 'shimmer') return u ? { ox: 0, oy: 0, shift: 0, shimmer: u } : undefined;
  const [dx, dy] = DIRS[m.p.direction] ?? DIRS.se; const alg = ctx.p.algorithm;
  const L = alg === 'whiteNoise' ? null : (TILE[alg] ?? 0) * m.p.tiles;   // px (w pikselach wzoru) na cykl
  const ox = L === null ? Math.round(u * w) * dx : Math.round(u * L) * dx, oy = L === null ? Math.round(u * h) * dy : Math.round(u * L) * dy;
  return { ox, oy, shift: u * m.p.tiles, shimmer: 0 };
}
const dither: EffectDef = {
  id: 'dither', name: 'Dither', category: 'Print & Paper', engine: 'SHADER', phase: 1,
  description: 'Reduces the image to a small palette using ordered patterns, noise or error diffusion.',
  params: [select('algorithm', 'Algorithm', 'bayer8', [['bayer2', 'Bayer 2×2'], ['bayer4', 'Bayer 4×4'], ['bayer8', 'Bayer 8×8'], ['bayer16', 'Bayer 16×16'], ['halftone', 'Halftone (clustered dot)'], ['radial', 'Radial'], ['linesH', 'Lines horizontal'], ['linesV', 'Lines vertical'], ['linesD', 'Lines diagonal'], ['whiteNoise', 'White noise'], ['blueNoise', 'Blue noise'], ['floyd', 'Floyd–Steinberg'], ['atkinson', 'Atkinson'], ['stucki', 'Stucki'], ['sierraLite', 'Sierra Lite']]),
    select('palette', 'Palette', 'mono', Object.entries(PALETTES).map(([k, v]) => [k, v.name] as [string, string])), select('chroma', 'Chroma', 'standard', [['standard', 'Standard (nearest colour)'], ['luma', 'Luminance only']], { level: 'advanced' }),
    range('pixelSize', 'Pixel size', 1, 1, 32, { unit: 'px', px: true }), range('strength', 'Effect strength', 100, 0, 100, { unit: '%' }), range('threshold', 'Threshold', 50, 0, 100, { level: 'advanced' }), range('angle', 'Angle', 0, 0, 180, { unit: '°', level: 'advanced' }),
    range('levels', 'Levels (original colours)', 2, 2, 8, { level: 'advanced' }), ...common('brightness', 'contrast'), seedParam()],
  motions: DITHER_MOTIONS,
  render(ctx) {
    const ps = Math.max(1, ctx.px(ctx.p.pixelSize)); const small = ps > 1 ? resize(ctx.prep, Math.ceil(ctx.prep.w / ps), Math.ceil(ctx.prep.h / ps)) : ctx.prep;
    const r = ditherImage(small, { algorithm: ctx.p.algorithm, palette: ctx.p.palette, chroma: ctx.p.chroma, threshold: ctx.p.threshold, angle: ctx.p.angle, seed: ctx.p.seed, levels: ctx.p.levels, period: 8, motion: ditherMotion(ctx, small.w, small.h) });
    let out = r; if (ps > 1) { out = { w: ctx.prep.w, h: ctx.prep.h, data: new Uint8ClampedArray(ctx.prep.w * ctx.prep.h * 4) }; for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) { const s = (Math.min(r.h - 1, Math.floor(y / ps)) * r.w + Math.min(r.w - 1, Math.floor(x / ps))) * 4, o = (y * out.w + x) * 4; out.data[o] = r.data[s]; out.data[o + 1] = r.data[s + 1]; out.data[o + 2] = r.data[s + 2]; out.data[o + 3] = r.data[s + 3]; } }
    const k = ctx.p.strength / 100; if (k < 1) for (let i = 0; i < out.data.length; i += 4) for (let c = 0; c < 3; c++) out.data[i + c] = lerp(ctx.prep.data[i + c], out.data[i + c], k);
    return out;
  },
};
export const DITHER_EFFECTS: EffectDef[] = [dither];
