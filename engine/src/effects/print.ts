// Druk i papier (plik 02, sekcje 3 i 4): Risograph, CMYK Drops, Comic, Crosshatch, Sketch. Opcje: plik 02 (CMYK Drops: docs,
// reszta: proj); zakresy, domyślne wartości i wzory: proj. Rastry: amScreen (core/screen.ts), pole kropki = pokrycie, więc ton się
// zachowuje. Długości w px skalują się z eksportem; szum liczony we współrzędnych źródła (x/skala), więc nie zmienia się z eksportem.
import type { EffectDef, Img } from '../core/types.ts';
import { color, common, range, seedParam, select, toggle } from '../core/params.ts';
import { blur, clamp, hash01, lerp, lum, parseColor } from '../core/util.ts';
import { amScreen, dilate, valueNoise } from '../core/screen.ts';

const px1 = () => [...common('brightness', 'contrast')];
const PX = { unit: 'px', px: true } as const;
const DEG = Math.PI / 180;
/** Siła krawędzi Sobel na tablicy jasności (0–1), w przeliczeniu na piksel źródła (k = skala). */
function sobelL(L: Float32Array, w: number, h: number, k: number) {
  const e = new Float32Array(w * h); const at = (x: number, y: number) => L[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
    const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
    e[y * w + x] = Math.min(1, (Math.hypot(gx, gy) / 4) * k);
  }
  return e;
}
const lumArr = (s: Img) => { const L = new Float32Array(s.w * s.h); for (let i = 0, p = 0; p < L.length; i += 4, p++) L[p] = lum(s.data[i], s.data[i + 1], s.data[i + 2]); return L; };

// ---------- Risograph ----------
const risograph: EffectDef = {
  id: 'risograph', name: 'Risograph', category: 'Print & Paper', engine: 'SHADER', phase: 2,
  description: 'Riso print: 2–3 inks, each with its own halftone, slightly out of register, with grain and overprinting.',
  params: [select('inkCount', 'Inks', '2', [['2', '2'], ['3', '3']]), color('ink1', 'Ink 1', '#ff48b0'), color('ink2', 'Ink 2', '#0078bf'), color('ink3', 'Ink 3', '#ffe800'),
    range('halftoneSize', 'Halftone size', 5, 2, 30, PX), range('misregistration', 'Misregistration', 2, 0, 20, PX), range('grain', 'Grain', 30, 0, 100, { unit: '%' }),
    toggle('overprint', 'Overprint (multiply)', true), color('paperColor', 'Paper', '#f2ede4'), seedParam(), ...px1()],
  // Rozdział: w modelu mnożenia (farby przepuszczają światło t_i) szukamy grubości c_i z log(piksel/papier) = Σ c_i·log(t_i)
  // metodą najmniejszych kwadratów (obcięte do 0–1), potem pole kropki a_i = (1 − t_i^c_i)/(1 − t_i) daje ten sam średni ton.
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const n = Number(ctx.p.inkCount); const P = parseColor(ctx.p.paperColor).map((v) => Math.max(8, v));
    const inks = [ctx.p.ink1, ctx.p.ink2, ctx.p.ink3].slice(0, n).map(parseColor); const T = inks.map((c) => c.map((v, k) => clamp(Math.max(8, v) / P[k], 0.03, 1)));
    const A = T.map((t) => t.map(Math.log));   // kolumny: log przepuszczalności na kanał
    const M = A.map((ai) => A.map((aj) => ai[0] * aj[0] + ai[1] * aj[1] + ai[2] * aj[2])); for (let i = 0; i < n; i++) M[i][i] += 1e-4;
    const inv = invert(M);
    const fields = inks.map(() => new Float32Array(w * h)); const sm = blur(s, Math.max(1, Math.round(ctx.p.halftoneSize * ctx.scale * 0.35)));
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const b = [0, 1, 2].map((k) => Math.log(clamp(Math.max(4, sm.data[i + k]) / P[k], 1e-3, 1))); const atb = A.map((a) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
      for (let q = 0; q < n; q++) { let c = 0; for (let r = 0; r < n; r++) c += inv[q][r] * atb[r]; c = clamp(c, 0, 1); const tm = Math.min(...T[q]); fields[q][p] = tm < 1 ? (1 - Math.pow(tm, c)) / (1 - tm) : 0; }
    }
    const out = new Uint8ClampedArray(d.length); for (let i = 0; i < out.length; i += 4) { out[i] = P[0]; out[i + 1] = P[1]; out[i + 2] = P[2]; out[i + 3] = d[i + 3]; }
    const cs = Math.max(2, ctx.p.halftoneSize * ctx.scale), mis = ctx.p.misregistration * ctx.scale, gr = ctx.p.grain / 100, sc = ctx.scale; const angles = [15, 75, 45];
    for (let q = 0; q < n; q++) {
      const a = 2 * Math.PI * hash01(q, 3, ctx.p.seed); const al = amScreen(fields[q], w, h, cs, angles[q] * DEG, { ox: Math.cos(a) * mis * (q ? 1 : 0), oy: Math.sin(a) * mis * (q ? 1 : 0), soft: Math.max(1, sc) });
      const ink = inks[q];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = y * w + x; let k = al[p]; if (!k) continue; if (gr) k *= 1 - gr * 0.6 * hash01(Math.floor(x / sc), Math.floor(y / sc), ctx.p.seed + 11 + q); const i = p * 4;
        for (let c = 0; c < 3; c++) out[i + c] = ctx.p.overprint ? out[i + c] * lerp(1, ink[c] / P[c], k) : lerp(out[i + c], ink[c], k);
      }
    }
    return { w, h, data: out };
  },
};
/** Odwrotność macierzy 2×2 lub 3×3. */
function invert(m: number[][]): number[][] {
  if (m.length === 2) { const [[a, b], [c, d]] = m; const det = a * d - b * c || 1e-9; return [[d / det, -b / det], [-c / det, a / det]]; }
  const [[a, b, c], [d, e, f], [g, h, i]] = m; const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g; const det = a * A + b * B + c * C || 1e-9;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}

// ---------- CMYK Drops ----------
const halftonecmyk: EffectDef = {
  id: 'halftonecmyk', name: 'CMYK Drops', category: 'Print & Paper', engine: 'SHADER', phase: 2,
  description: 'Four-colour separation (C, M, Y, K), each ink screened at its own angle on paper.',
  params: [color('paper', 'Paper', '#f7f3ea'), color('cyan', 'Cyan', '#00aeef'), color('magenta', 'Magenta', '#ec008c'), color('yellow', 'Yellow', '#fff200'), color('black', 'Black', '#231f20', { level: 'advanced' }),
    select('dotType', 'Dot type', 'dots', [['dots', 'Dots'], ['sharp', 'Sharp'], ['ink', 'Ink']]), range('size', 'Size', 8, 2, 40, PX), range('gridNoise', 'Grid noise', 0, 0, 100, { unit: '%' }),
    range('contrast', 'Contrast', 0, -100, 100), range('softness', 'Softness', 30, 0, 100, { unit: '%' }), range('minDot', 'Min dot', 5, 0, 50, { unit: '%' }),
    range('gainC', 'Ink gain C', 100, 0, 200, { unit: '%', level: 'advanced' }), range('gainM', 'Ink gain M', 100, 0, 200, { unit: '%', level: 'advanced' }),
    range('gainY', 'Ink gain Y', 100, 0, 200, { unit: '%', level: 'advanced' }), range('gainK', 'Ink gain K', 100, 0, 200, { unit: '%', level: 'advanced' }), seedParam(), ...common('brightness')],
  // Rozdział z pełnym GCR: K = 1 − max(r,g,b), C = (1 − r − K)/(1 − K) itd. Kąty rastra: C 15°, M 75°, Y 0°, K 45°.
  // Kontrast: krzywa S wokół 0,5 na wejściu; minDot: pokrycie poniżej progu = brak kropki; farby mnożone na papierze.
  render(ctx) {
    const s = blur(ctx.prep, Math.max(1, Math.round(ctx.p.size * ctx.scale * 0.3))); const { w, h } = s; const d = s.data; const kc = 1 + ctx.p.contrast / 100;
    const F = [0, 1, 2, 3].map(() => new Float32Array(w * h)); const gains = [ctx.p.gainC, ctx.p.gainM, ctx.p.gainY, ctx.p.gainK].map((g) => g / 100); const md = ctx.p.minDot / 100;
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const v = [0, 1, 2].map((c) => clamp((d[i + c] / 255 - 0.5) * kc + 0.5, 0, 1)); const K = 1 - Math.max(v[0], v[1], v[2]);
      const cmy = v.map((x) => (K < 1 ? (1 - x - K) / (1 - K) : 0)); const all = [cmy[0], cmy[1], cmy[2], K];
      for (let q = 0; q < 4; q++) { const c = clamp(all[q] * gains[q], 0, 1); F[q][p] = c < md ? 0 : c; }
    }
    const paper = parseColor(ctx.p.paper); const inks = [ctx.p.cyan, ctx.p.magenta, ctx.p.yellow, ctx.p.black].map(parseColor); const angles = [15, 75, 0, 45];
    const cs = Math.max(2, ctx.p.size * ctx.scale); const soft = (0.5 + (ctx.p.softness / 100) * 3) * ctx.scale; const shape = ctx.p.dotType === 'sharp' ? 'sharp' : ctx.p.dotType === 'ink' ? 'ink' : 'dot';
    const out = new Uint8ClampedArray(d.length); for (let i = 0; i < out.length; i += 4) { out[i] = paper[0]; out[i + 1] = paper[1]; out[i + 2] = paper[2]; out[i + 3] = ctx.prep.data[i + 3]; }
    for (let q = 0; q < 4; q++) {
      const al = amScreen(F[q], w, h, cs, angles[q] * DEG, { shape, soft, jitter: (ctx.p.gridNoise / 100) * 0.25, seed: ctx.p.seed + q }); const ink = inks[q];
      for (let p = 0, i = 0; p < w * h; p++, i += 4) { const k = al[p]; if (!k) continue; for (let c = 0; c < 3; c++) out[i + c] = out[i + c] * lerp(1, ink[c] / Math.max(1, paper[c]), k); }
    }
    return { w, h, data: out };
  },
};

// ---------- Comic ----------
const POP = ['#ffffff', '#ffe600', '#ff2d55', '#00a6ff', '#1fd16b', '#ff8a00', '#7a3cff', '#111111'], RETRO = ['#f4ead5', '#e8c46a', '#d9603b', '#4f8a8b', '#2f4858', '#b5651d', '#7f9c57', '#222222'];
const comic: EffectDef = {
  id: 'comic', name: 'Comic', category: 'Print & Paper', engine: 'SHADER', phase: 2,
  description: 'Comic-book look: flat posterized colour, black outlines and Ben-Day dots in the shadows.',
  params: [range('levels', 'Levels', 4, 2, 8), range('outlineThickness', 'Outline', 2, 0, 10, PX), range('halftoneSize', 'Ben-Day size', 6, 3, 20, PX),
    select('palette', 'Palette', 'image', [['image', 'From image'], ['pop', 'Pop'], ['retro', 'Retro']]), color('inkColor', 'Ink', '#111111'), ...px1()],
  // wygładzenie (1 px × skala), posteryzacja kanałów do `levels` (palety pop/retro: najbliższy kolor), Ben-Day 45° w cieniach
  // (jasność < 0,45: pokrycie (0,45 − L)/0,45 · 0,7), kontur: Sobel > 0,12 poszerzony do grubości
  render(ctx) {
    const s = blur(ctx.prep, Math.max(1, Math.round(ctx.scale))); const { w, h } = s; const d = s.data; const n = ctx.p.levels; const out = new Uint8ClampedArray(d.length);
    const pal = ctx.p.palette === 'pop' ? POP.map(parseColor) : ctx.p.palette === 'retro' ? RETRO.map(parseColor) : null;
    const L = lumArr(s); const shade = new Float32Array(w * h);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      let c = [0, 1, 2].map((k) => Math.round((d[i + k] / 255) * (n - 1)) * (255 / (n - 1)));
      if (pal) { let best = 0, bd = Infinity; for (let j = 0; j < pal.length; j++) { const e = (pal[j][0] - d[i]) ** 2 + (pal[j][1] - d[i + 1]) ** 2 + (pal[j][2] - d[i + 2]) ** 2; if (e < bd) { bd = e; best = j; } } c = pal[best]; }
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = d[i + 3]; shade[p] = L[p] < 0.45 ? ((0.45 - L[p]) / 0.45) * 0.7 : 0;
    }
    const ink = parseColor(ctx.p.inkColor); const dots = amScreen(shade, w, h, Math.max(2, ctx.p.halftoneSize * ctx.scale), 45 * DEG, { soft: Math.max(1, ctx.scale) });
    const t = ctx.p.outlineThickness * ctx.scale; let edge: Float32Array | null = null;
    if (t > 0) { const e = sobelL(L, w, h, ctx.scale); for (let p = 0; p < e.length; p++) e[p] = e[p] > 0.12 ? 1 : 0; /* 0,12: kontur od skoku jasności ok. 25% (po wygładzeniu skok 0,39 daje 0,19) */ edge = dilate(e, w, h, (t - 1) / 2); }
    for (let p = 0, i = 0; p < w * h; p++, i += 4) { const k = Math.max(dots[p], edge ? edge[p] : 0); if (k) for (let c = 0; c < 3; c++) out[i + c] = lerp(out[i + c], ink[c], k); }
    return { w, h, data: out };
  },
};

// ---------- Crosshatch ----------
const crosshatch: EffectDef = {
  id: 'crosshatch', name: 'Crosshatch', category: 'Print & Paper', engine: 'SHADER', phase: 2,
  description: 'Cross-hatching: further layers of lines at new angles switch on in darker areas.',
  params: [range('layers', 'Layers', 3, 2, 4), range('angle', 'Angle', 45, 0, 180, { unit: '°' }), range('spacing', 'Spacing', 6, 3, 30, PX), range('thickness', 'Thickness', 1.2, 0.5, 6, { ...PX, step: 0.1 }),
    range('jitter', 'Jitter', 20, 0, 100, { unit: '%' }), color('inkColor', 'Ink', '#1a1a1a'), color('paperColor', 'Paper', '#f6f2e8'), seedParam(), ...px1()],
  // warstwa k (kąty: angle + 0°, 90°, 45°, 135°) włącza się, gdy ciemność > k/warstwy; grubość linii rośnie od 0 do `thickness`
  // na odcinku 1/(2·warstwy) ponad progiem; jitter: falowanie linii wzdłuż jej długości (szum wartości, ±0,3 odstępu)
  render(ctx) {
    const s = blur(ctx.prep, Math.max(1, Math.round(ctx.scale))); const { w, h } = s; const L = lumArr(s); const n = ctx.p.layers; const sp = ctx.p.spacing * ctx.scale, th = ctx.p.thickness * ctx.scale;
    const ink = parseColor(ctx.p.inkColor), paper = parseColor(ctx.p.paperColor); const out = new Uint8ClampedArray(s.data.length); const jit = (ctx.p.jitter / 100) * 0.3 * sp;
    const ang = [0, 90, 45, 135].slice(0, n).map((a) => (ctx.p.angle + a) * DEG); const cs = ang.map(Math.cos), sn = ang.map(Math.sin);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; const D = 1 - L[p]; let cov = 0;
      for (let k = 0; k < n; k++) {
        const g = clamp((D - k / n) * 2 * n, 0, 1); if (!g) continue; const px = x + 0.5, py = y + 0.5; let u = px * cs[k] + py * sn[k]; const v = -px * sn[k] + py * cs[k];
        if (jit) { const li = Math.floor(u / sp); u += (valueNoise(v / (sp * 4), li * 1.7, ctx.p.seed + k) - 0.5) * 2 * jit; }
        const dist = Math.abs(u - (Math.floor(u / sp) + 0.5) * sp); cov = Math.max(cov, clamp(0.5 - (dist - (th * g) / 2), 0, 1));
      }
      const i = p * 4; for (let c = 0; c < 3; c++) out[i + c] = lerp(paper[c], ink[c], cov); out[i + 3] = s.data[i + 3];
    }
    return { w, h, data: out };
  },
};

// ---------- Sketch ----------
const sketch: EffectDef = {
  id: 'sketch', name: 'Sketch', category: 'Print & Paper', engine: 'SHADER', phase: 2,
  description: 'Pencil sketch: detected edges plus light hatching in the shadows, on textured paper.',
  params: [range('edgeStrength', 'Edge strength', 75, 0, 100, { unit: '%' }), range('strokeLength', 'Stroke length', 30, 5, 100, PX), range('hatchDensity', 'Hatching', 60, 0, 100, { unit: '%' }),
    color('lineColor', 'Line colour', '#2b2b2b'), range('paperTexture', 'Paper texture', 40, 0, 100, { unit: '%' }), range('jitter', 'Jitter', 30, 0, 100, { unit: '%' }), seedParam(), ...px1()],
  // tusz = max(krawędź, kreskowanie); krawędź: Sobel × siła; kreskowanie 45° co 5 px × skala w kreskach długości strokeLength:
  // każda kreska ma własny próg ciemności i przesunięcie (jitter), więc kreski urywają się jak ołówek; drugi kierunek (135°) w głębokich cieniach.
  // Papier: #f7f4ec × (1 − tekstura · (0,06·szum niskiej częstotliwości + 0,04·ziarno)), szum we współrzędnych źródła.
  render(ctx) {
    const s = blur(ctx.prep, Math.max(1, Math.round(ctx.scale))); const { w, h } = s; const L = lumArr(s); const sc = ctx.scale; const e = sobelL(L, w, h, sc);
    const es = ctx.p.edgeStrength / 100, hd = ctx.p.hatchDensity / 100, len = ctx.p.strokeLength * sc, sp = 5 * sc, jit = ctx.p.jitter / 100, tex = ctx.p.paperTexture / 100, seed = ctx.p.seed;
    const lc = parseColor(ctx.p.lineColor); const out = new Uint8ClampedArray(s.data.length); const lw = Math.max(0.6, 0.8 * sc);
    const hatch = (x: number, y: number, a: number, D: number, thr0: number, sd: number) => {
      const ca = Math.cos(a), sa = Math.sin(a); const u = x * ca + y * sa, v = -x * sa + y * ca; const li = Math.floor(u / sp); const si = Math.floor((v + hash01(li, 0, sd) * len) / len);
      const off = (hash01(li, si, sd + 1) - 0.5) * jit * sp * 0.6; const thr = thr0 + (1 - hd) * 0.5 + hash01(li, si, sd + 2) * 0.25; if (D < thr) return 0;
      const dist = Math.abs(u + off - (li + 0.5) * sp); return clamp(0.5 - (dist - lw / 2), 0, 1) * clamp((D - thr) * 4, 0, 1) * 0.8;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; const D = 1 - L[p]; const px = x + 0.5, py = y + 0.5;
      let k = clamp((e[p] - 0.06) * es * 3, 0, 1);
      if (hd) k = Math.max(k, hatch(px, py, 45 * DEG, D, 0.1, seed), hatch(px, py, 135 * DEG, D, 0.45, seed + 5));
      const n = tex ? 1 - tex * (0.06 * valueNoise(px / sc / 40, py / sc / 40, seed + 9) + 0.04 * hash01(Math.floor(px / sc), Math.floor(py / sc), seed + 13)) : 1;
      const i = p * 4; const paper = [247 * n, 244 * n, 236 * n]; for (let c = 0; c < 3; c++) out[i + c] = lerp(paper[c], lc[c], k); out[i + 3] = s.data[i + 3];
    }
    return { w, h, data: out };
  },
};

export const PRINT_EFFECTS: EffectDef[] = [risograph, comic, sketch, crosshatch, halftonecmyk];
