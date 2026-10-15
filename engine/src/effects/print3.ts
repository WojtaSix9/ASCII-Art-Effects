// Druk i papier, Faza 3 (plik 02, sekcja 3; wszystko proj): Engraving, Warhol, Cyanotype, Woodblock, Mezzotint.
// Długości w px × skala; szum i ziarno we współrzędnych źródła (x/skala), więc eksport @2x ma ten sam układ.
import type { EffectDef, Img } from '../core/types.ts';
import { color, common, range, seedParam, select } from '../core/params.ts';
import { blur, clamp, hash01, lerp, lum, parseColor, resize } from '../core/util.ts';
import { dilate, valueNoise } from '../core/screen.ts';

const px1 = () => [...common('brightness', 'contrast')];
const PX = { unit: 'px', px: true } as const;
const DEG = Math.PI / 180;
const lumArr = (s: Img) => { const L = new Float32Array(s.w * s.h); for (let i = 0, p = 0; p < L.length; i += 4, p++) L[p] = lum(s.data[i], s.data[i + 1], s.data[i + 2]); return L; };

// ---------- Engraving ----------
const engraving: EffectDef = {
  id: 'engraving', name: 'Engraving', category: 'Print & Paper', engine: 'GEOM', phase: 3,
  description: 'Engraved lines that swell in the shadows, thin out in the light and bend along the forms.',
  params: [range('lineSpacing', 'Line spacing', 5, 2, 30, PX), range('angle', 'Angle', 30, 0, 180, { unit: '°' }), range('thicknessRange', 'Thickness', 85, 10, 100, { unit: '%' }),
    range('curvature', 'Curvature', 40, 0, 100, { unit: '%' }), color('inkColor', 'Ink', '#1b1a17'), color('paperColor', 'Paper', '#f3ecdc'), ...px1()],
  // linie w obróconym układzie (u wzdłuż normalnej); u przesunięte o curvature·1,5 odstępu × (jasność mocno rozmyta − 0,5), więc linie
  // wyginają się wzdłuż plam światła; grubość = odstęp × thickness × ciemność (wygładzona 1 px × skala)
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sp = Math.max(1.5, ctx.p.lineSpacing * ctx.scale); const L = lumArr(blur(s, Math.max(1, Math.round(ctx.scale)))); const F = lumArr(blur(s, Math.max(2, Math.round(Math.min(w, h) * 0.04))));
    const ca = Math.cos(ctx.p.angle * DEG), sa = Math.sin(ctx.p.angle * DEG); const cv = (ctx.p.curvature / 100) * 1.5 * sp; const th = ctx.p.thicknessRange / 100; const ink = parseColor(ctx.p.inkColor), paper = parseColor(ctx.p.paperColor);
    const out = new Uint8ClampedArray(s.data.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; const u = -(x + 0.5) * sa + (y + 0.5) * ca + (F[p] - 0.5) * cv * 2; const dist = Math.abs(u - (Math.floor(u / sp) + 0.5) * sp); const lw = sp * th * (1 - L[p]);
      const k = clamp(0.5 - (dist - lw / 2), 0, 1) * Math.min(1, lw); /* linia cieńsza niż 1 px: krycie × grubość (inaczej biel miała ślad 0,5 px) */ const i = p * 4; for (let c = 0; c < 3; c++) out[i + c] = lerp(paper[c], ink[c], k); out[i + 3] = s.data[i + 3];
    }
    return { w, h, data: out };
  },
};

// ---------- Warhol ----------
const WARHOL: Record<string, string[][]> = {
  pop: [['#1b1464', '#ff2e88', '#ffd400'], ['#003049', '#00c2a8', '#fcbf49'], ['#370617', '#f48c06', '#90e0ef'], ['#240046', '#7bf1a8', '#ff5d8f']],
  neon: [['#0b0033', '#ff00c8', '#00f0ff'], ['#001a00', '#39ff14', '#ffe600'], ['#1a0000', '#ff3d00', '#ffd6ff'], ['#00111a', '#00b3ff', '#f9f871']],
  pastel: [['#4a4e69', '#f2a7b5', '#fde2e4'], ['#355070', '#b5e2fa', '#f9f7f3'], ['#6d597a', '#eec170', '#f7e1d7'], ['#3d405b', '#81b29a', '#f4f1de']],
};
const rotHue = (c: number[], deg: number) => { const a = deg * DEG, cs = Math.cos(a), sn = Math.sin(a); const m = [0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928, 0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.14, 0.072 - cs * 0.072 - sn * 0.283, 0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072]; return [0, 1, 2].map((r) => clamp(m[r * 3] * c[0] + m[r * 3 + 1] * c[1] + m[r * 3 + 2] * c[2], 0, 255)); };
const warhol: EffectDef = {
  id: 'warhol', name: 'Warhol', category: 'Print & Paper', engine: 'SHADER', phase: 3,
  description: 'Pop-art grid: copies of the image, each in a different bold, posterized palette.',
  params: [select('grid', 'Grid', '2', [['2', '2 × 2'], ['3', '3 × 3']]), select('palettes', 'Palettes', 'pop', [['pop', 'Pop'], ['neon', 'Neon'], ['pastel', 'Pastel']]), range('levels', 'Levels', 3, 2, 5),
    range('hueShiftPerTile', 'Hue shift per tile', 0, 0, 180, { unit: '°' }), ...px1()],
  // kafelek = cały obraz pomniejszony do rozmiaru kafelka (proporcje obrazu), ton posteryzowany do `levels` poziomów i zamieniony na kolory
  // palety kafelka (paleta k z listy po kolei, poziomy pośrednie interpolowane), dodatkowo obrót odcienia o k × hueShiftPerTile
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const n = Number(ctx.p.grid); const tw = Math.ceil(w / n), th = Math.ceil(h / n); const small = resize(blur(s, Math.max(1, Math.round(ctx.scale))), tw, th); const sd = small.data;
    const lv = Math.round(ctx.p.levels); const pals = WARHOL[ctx.p.palettes]; const out = new Uint8ClampedArray(s.data.length);
    for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
      const k = ty * n + tx; const base = pals[k % pals.length].map(parseColor).map((c) => rotHue(c, k * ctx.p.hueShiftPerTile)); const cols = Array.from({ length: lv }, (_, j) => { const f = (j / (lv - 1)) * (base.length - 1); const a = Math.floor(f), b = Math.min(base.length - 1, a + 1); return base[a].map((v, c) => lerp(v, base[b][c], f - a)); });
      for (let y = ty * th; y < Math.min(h, (ty + 1) * th); y++) for (let x = tx * tw; x < Math.min(w, (tx + 1) * tw); x++) {
        const q = ((y - ty * th) * tw + (x - tx * tw)) * 4; const L = lum(sd[q], sd[q + 1], sd[q + 2]); const c = cols[clamp(Math.round(L * (lv - 1)), 0, lv - 1)]; const i = (y * w + x) * 4; out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
      }
    }
    return { w, h, data: out };
  },
};

// ---------- Cyanotype ----------
const blueprint: EffectDef = {
  id: 'blueprint', name: 'Cyanotype', category: 'Print & Paper', engine: 'SHADER', phase: 3,
  description: 'A cyanotype print: Prussian blue and white, with paper stains and grain.',
  params: [range('toneCurve', 'Tone curve', 0, -100, 100), select('lineMode', 'Mode', 'tones', [['tones', 'Tones'], ['edges', 'Edges']]), range('paperStain', 'Paper stain', 35, 0, 100, { unit: '%' }),
    range('grain', 'Grain', 25, 0, 100, { unit: '%' }), seedParam(), ...px1()],
  // ton t = jasność^γ (γ = 2^(−krzywa/100)); kolor = lerp(błękit pruski #0d2b5e, papier #eef2f4, t). Edges: białe krawędzie (Sobel) na błękicie.
  // Plamy: szum niskiej częstotliwości (ok. 1/5 krótszego boku) przyciemnia i ociepla papier; ziarno: szum 1 px źródła
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const L = lumArr(blur(s, Math.max(1, Math.round(ctx.scale * 0.6)))); const g = Math.pow(2, -ctx.p.toneCurve / 100); const dark = [13, 43, 94], paper = [238, 242, 244];
    const st = ctx.p.paperStain / 100, gr = ctx.p.grain / 100, sc = ctx.scale, m = Math.min(w, h); const edges = ctx.p.lineMode === 'edges'; const out = new Uint8ClampedArray(s.data.length);
    const at = (x: number, y: number) => L[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; let t = edges ? clamp(Math.hypot(at(x + 1, y) - at(x - 1, y), at(x, y + 1) - at(x, y - 1)) * sc * 4, 0, 1) : Math.pow(L[p], g);
      if (gr) t = clamp(t + (hash01(Math.floor(x / sc), Math.floor(y / sc), ctx.p.seed) - 0.5) * 0.2 * gr, 0, 1);
      const stain = st ? valueNoise(((x + 0.5) / m) * 5, ((y + 0.5) / m) * 5, ctx.p.seed + 3) : 0; const i = p * 4;
      for (let c = 0; c < 3; c++) { let v = lerp(dark[c], paper[c], t); if (st) v = lerp(v, v * [0.86, 0.8, 0.66][c], st * stain * t); out[i + c] = v; } out[i + 3] = s.data[i + 3];
    }
    return { w, h, data: out };
  },
};

// ---------- Woodblock ----------
const EDO = ['#1f2a44', '#2f5d8a', '#c0392b', '#d98e48', '#e9d8a6', '#6b8f71', '#f4ead5', '#151515'];
/** k-średnich na próbce (siatka co ~1/60 krótszego boku): deterministyczne, start z kolorów rozłożonych wg jasności. */
function kmeans(s: Img, k: number): number[][] {
  const { w, h, data: d } = s; const step = Math.max(1, Math.floor(Math.min(w, h) / 60)); const pts: number[][] = []; for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) { const i = (y * w + x) * 4; pts.push([d[i], d[i + 1], d[i + 2]]); }
  pts.sort((a, b) => lum(a[0], a[1], a[2]) - lum(b[0], b[1], b[2])); let cs = Array.from({ length: k }, (_, j) => [...pts[Math.floor(((j + 0.5) / k) * pts.length)]]);
  for (let it = 0; it < 8; it++) { const sum = cs.map(() => [0, 0, 0, 0]); for (const p of pts) { let b = 0, bd = Infinity; for (let j = 0; j < k; j++) { const e = (p[0] - cs[j][0]) ** 2 + (p[1] - cs[j][1]) ** 2 + (p[2] - cs[j][2]) ** 2; if (e < bd) { bd = e; b = j; } } sum[b][0] += p[0]; sum[b][1] += p[1]; sum[b][2] += p[2]; sum[b][3]++; } cs = cs.map((c, j) => (sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c)); }
  return cs;
}
const ukiyoe: EffectDef = {
  id: 'ukiyoe', name: 'Woodblock', category: 'Print & Paper', engine: 'SHADER', phase: 3,
  description: 'Japanese woodblock print: flat colour from a limited palette, dark outlines, wood grain and paper texture.',
  params: [range('colorCount', 'Colours', 6, 3, 12), range('outline', 'Outline', 1.5, 0, 6, { ...PX, step: 0.5 }), range('woodGrain', 'Wood grain', 35, 0, 100, { unit: '%' }),
    range('paperTexture', 'Paper texture', 30, 0, 100, { unit: '%' }), select('palette', 'Palette', 'image', [['image', 'From image'], ['edo', 'Edo']]), seedParam(), ...px1()],
  // wygładzenie (0,6% krótszego boku), każdy piksel do najbliższego koloru palety (z obrazu: k-średnich, edo: stałe 8 barw); kontur: granica
  // między plamami poszerzona do grubości, kolor #1a1714; słoje: pasy wzdłuż poziomu falowane szumem, ±8% jasności; papier: ziarno ±5%
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sm = blur(s, Math.max(1, Math.round(0.006 * Math.min(w, h))));   /* 1,5% gubiło kształty (oko) */ const d = sm.data; const k = Math.round(ctx.p.colorCount);
    const pal = ctx.p.palette === 'edo' ? EDO.slice(0, Math.max(3, Math.min(8, k))).map(parseColor) : kmeans(ctx.scale === 1 ? sm : resize(sm, Math.round(w / ctx.scale), Math.round(h / ctx.scale)), k);
    const idx = new Uint8Array(w * h); for (let p = 0, i = 0; p < idx.length; p++, i += 4) { let b = 0, bd = Infinity; for (let j = 0; j < pal.length; j++) { const e = (d[i] - pal[j][0]) ** 2 + (d[i + 1] - pal[j][1]) ** 2 + (d[i + 2] - pal[j][2]) ** 2; if (e < bd) { bd = e; b = j; } } idx[p] = b; }
    let edge: Float32Array | null = null; const ow = ctx.p.outline * ctx.scale; if (ow > 0) { const e = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x; if ((x + 1 < w && idx[p + 1] !== idx[p]) || (y + 1 < h && idx[p + w] !== idx[p])) e[p] = 1; } edge = dilate(e, w, h, (ow - 1) / 2); }
    const wg = ctx.p.woodGrain / 100, pt = ctx.p.paperTexture / 100, sc = ctx.scale, m = Math.min(w, h); const out = new Uint8ClampedArray(d.length); const line = [26, 23, 20];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4; const c = pal[idx[p]]; let f = 1;
      if (wg) f += 0.08 * wg * Math.sin(((y + 0.5) / m) * 140 + valueNoise(((x + 0.5) / m) * 3, ((y + 0.5) / m) * 12, ctx.p.seed) * 9);
      if (pt) f += 0.05 * pt * (hash01(Math.floor(x / sc), Math.floor(y / sc), ctx.p.seed + 5) - 0.5) * 2;
      for (let q = 0; q < 3; q++) out[i + q] = edge && edge[p] ? line[q] : c[q] * f; out[i + 3] = s.data[i + 3];
    }
    return { w, h, data: out };
  },
};

// ---------- Mezzotint ----------
const mezzotint: EffectDef = {
  id: 'mezzotint', name: 'Mezzotint', category: 'Print & Paper', engine: 'SHADER', phase: 3,
  description: 'Mezzotint: a grainy, velvety, high-contrast texture: dark ground with patches of light.',
  params: [range('grainSize', 'Grain size', 2, 1, 10, { ...PX, step: 0.5 }), range('density', 'Density', 60, 0, 100, { unit: '%' }), range('threshold', 'Threshold', 50, 0, 100, { unit: '%' }),
    color('inkColor', 'Ink', '#17110d'), color('paperColor', 'Paper', '#efe6d2'), seedParam(), ...px1()],
  // ciemność D = 1 − jasność po krzywej S (kontrast 1 + density·2 wokół progu); komórka ziarna (grainSize px źródła) jest tuszem,
  // gdy D > losowy próg komórki (seed) — jak chropowata płyta: średnie pokrycie tuszem ≈ D
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const L = lumArr(blur(s, Math.max(1, Math.round(ctx.scale)))); const gs = ctx.p.grainSize; const kc = 1 + (ctx.p.density / 100) * 2, thr = ctx.p.threshold / 100;
    const ink = parseColor(ctx.p.inkColor), paper = parseColor(ctx.p.paperColor); const out = new Uint8ClampedArray(s.data.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; const D = clamp(0.5 - (L[p] - thr) * kc, 0, 1); const gx = Math.floor((x + 0.5) / ctx.scale / gs), gy = Math.floor((y + 0.5) / ctx.scale / gs);
      const on = D > hash01(gx, gy, ctx.p.seed) ? 1 : 0; const i = p * 4; for (let c = 0; c < 3; c++) out[i + c] = on ? ink[c] : paper[c]; out[i + 3] = s.data[i + 3];
    }
    return { w, h, data: out };
  },
};

export const PRINT3_EFFECTS: EffectDef[] = [engraving, warhol, blueprint, ukiyoe, mezzotint];
