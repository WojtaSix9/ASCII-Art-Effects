// Glitch i sygnał oraz światło (plik 02, sekcje 7 i 8): RGB Split, Scanline, CRT Screen, Thermal, Edge Glow, Aberration.
// Opcje z pliku 02 (RGB Split, Scanline: docs; reszta: proj); zakresy, domyślne wartości i wzory: proj.
// Długości w px skalują się z eksportem; losowość (szum, migotanie) zależy od seeda i jest stała w ułamkach obrazu.
import type { EffectDef, Img } from '../core/types.ts';
import { color, common, motionCommon, range, seedParam, select, toggle } from '../core/params.ts';
import { blur, clamp, hash01, lerp, lum, parseColor } from '../core/util.ts';

const px1 = () => [...common('brightness', 'contrast')];
const PX = { unit: 'px', px: true } as const;
const copy = (s: Img): Img => ({ w: s.w, h: s.h, data: new Uint8ClampedArray(s.data) });
/** Próbka dwuliniowa kanału c w punkcie (x, y) w układzie pikseli (środek piksela = +0,5); brzegi powielane. */
function bil(d: Uint8ClampedArray | Float32Array, w: number, h: number, x: number, y: number, c: number) {
  x = clamp(x - 0.5, 0, w - 1); y = clamp(y - 0.5, 0, h - 1); const x0 = x | 0, y0 = y | 0, tx = x - x0, ty = y - y0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const a = d[(y0 * w + x0) * 4 + c], b = d[(y0 * w + x1) * 4 + c], e = d[(y1 * w + x0) * 4 + c], f = d[(y1 * w + x1) * 4 + c];
  return (a + (b - a) * tx) * (1 - ty) + (e + (f - e) * tx) * ty;
}
/** Pokrycie wiersza [y, y+1) ciemnymi pasami grubości T co okres P (z przesunięciem o): dokładna całka, więc działa przy każdej skali. */
const bandCover = (y: number, P: number, T: number, o: number) => { const F = (t: number) => Math.floor(t / P) * T + Math.min(t - Math.floor(t / P) * P, T); return F(y + 1 + o) - F(y + o); };

// ---------- RGB Split ----------
const rgbsplit: EffectDef = {
  id: 'rgbsplit', name: 'RGB Split', category: 'Glitch & Signal', engine: 'SHADER', phase: 2,
  description: 'Shifts the red, green and blue channels apart.',
  params: [range('offset', 'Offset', 10, 1, 20, PX), range('angle', 'Angle', 0, 0, 360, { unit: '°' }), toggle('perChannel', 'Per channel (120° apart)', false), ...px1()],
  // etap 2, ruch „pulse” (plik 09: oscylacja offsetu wzdłuż kąta; proj): offset × (1 − intensity · (1 − cos 2π·speed·φ) / 2),
  // przy φ = 0 dokładnie offset (obraz statyczny), najmniejszy w połowie cyklu
  motions: [{ id: 'pulse', name: 'Pulse', params: motionCommon(60) }],
  // zwykle: R przesunięty o +offset w kierunku angle, B o −offset, G na miejscu; perChannel: R, G, B co 120°
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const out = new Uint8ClampedArray(d.length); const m = ctx.motion;
    const k = ctx.p.offset * ctx.scale * (m ? 1 - ((m.p.intensity / 100) * (1 - Math.cos(2 * Math.PI * m.p.speed * m.phase))) / 2 : 1); const a = (ctx.p.angle * Math.PI) / 180;
    const dirs = ctx.p.perChannel ? [0, 1, 2].map((c) => [Math.cos(a + (c * 2 * Math.PI) / 3) * k, Math.sin(a + (c * 2 * Math.PI) / 3) * k]) : [[Math.cos(a) * k, Math.sin(a) * k], [0, 0], [-Math.cos(a) * k, -Math.sin(a) * k]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) out[i + c] = bil(d, w, h, x + 0.5 - dirs[c][0], y + 0.5 - dirs[c][1], c); out[i + 3] = d[i + 3]; }
    return { w, h, data: out };
  },
};

// ---------- Scanline ----------
const scanline: EffectDef = {
  id: 'scanline', name: 'Scanline', category: 'Glitch & Signal', engine: 'SHADER', phase: 2,
  description: 'Dark horizontal scan lines, like an old monitor; roll shifts them vertically.',
  params: [range('spacing', 'Spacing', 3, 1, 20, PX), range('thickness', 'Thickness', 2, 1, 10, PX), range('intensity', 'Intensity', 60, 0, 100, { unit: '%' }), range('roll', 'Roll', 0, 0, 100, { unit: '%' }), ...px1()],
  // etap 2, ruch „roll” (plik 09; proj): wzór przesuwa się o speed pełnych okresów na pętlę (roll + speed·φ okresów)
  motions: [{ id: 'roll', name: 'Roll', params: [range('speed', 'Speed (cycles per loop)', 1, 1, 8)] }],
  // okres = spacing + thickness; wiersz przyciemniany proporcjonalnie do pokrycia pasem; roll przesuwa wzór o ułamek okresu
  render(ctx) {
    const s = ctx.prep; const out = copy(s); const k = ctx.p.intensity / 100; if (!k) return out; const T = ctx.p.thickness * ctx.scale, P = T + ctx.p.spacing * ctx.scale, o = (ctx.p.roll / 100 + (ctx.motion ? ctx.motion.p.speed * ctx.motion.phase : 0)) * P; const d = out.data;
    for (let y = 0; y < s.h; y++) { const m = 1 - k * bandCover(y, P, T, o); if (m === 1) continue; for (let i = y * s.w * 4, e = i + s.w * 4; i < e; i += 4) { d[i] *= m; d[i + 1] *= m; d[i + 2] *= m; } }
    return out;
  },
};

// ---------- CRT Screen ----------
const crt: EffectDef = {
  id: 'crt', name: 'CRT Screen', category: 'Glitch & Signal', engine: 'SHADER', phase: 2,
  description: 'A tube screen: curved glass, scan lines, RGB phosphor mask, glow and a slight flicker.',
  params: [range('curvature', 'Curvature', 40, 0, 100, { unit: '%' }), range('scanlines', 'Scan lines', 50, 0, 100, { unit: '%' }), range('phosphorMask', 'Phosphor mask', 40, 0, 100, { unit: '%' }),
    range('bloom', 'Bloom', 30, 0, 100, { unit: '%' }), range('flicker', 'Flicker', 20, 0, 100, { unit: '%' }), seedParam(), ...px1()],
  // kolejność: poświata (z obrazu przed maską), maska luminoforu (kolumny R, G, B co 1 px × skala), linie (okres 3 px × skala),
  // migotanie (pasy jasności wysokości ok. 1/24 obrazu, zależne od seeda), na końcu zakrzywienie z czarnymi narożnikami
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sc = ctx.scale; let img = copy(s); const d = img.data;
    const bl = ctx.p.bloom / 100; if (bl) { const g = blur(s, Math.max(1, Math.round(4 * sc))).data; for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = 255 - ((255 - d[i + c]) * (255 - g[i + c] * bl * 0.8)) / 255; }
    const pm = ctx.p.phosphorMask / 100; const cw = Math.max(1, Math.round(sc));
    const sl = ctx.p.scanlines / 100; const P = 3 * sc, T = 1 * sc; const fl = ctx.p.flicker / 100; const band = Math.max(1, h / 24);
    for (let y = 0; y < h; y++) {
      const ms = 1 - sl * 0.6 * bandCover(y, P, T, 0); const mf = 1 - fl * 0.25 * hash01(Math.floor(y / band), 7, ctx.p.seed); const m = ms * mf;
      for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const col = Math.floor(x / cw) % 3; for (let c = 0; c < 3; c++) d[i + c] *= m * (c === col ? 1 : 1 - pm * 0.6); }
    }
    const k = (ctx.p.curvature / 100) * 0.25; if (!k) return img;
    const src = img.data; const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = ((x + 0.5) / w) * 2 - 1, ny = ((y + 0.5) / h) * 2 - 1; const r2 = nx * nx + ny * ny; const sx = nx * (1 + k * r2), sy = ny * (1 + k * r2); const i = (y * w + x) * 4;
      if (Math.abs(sx) > 1 || Math.abs(sy) > 1) { out[i + 3] = src[i + 3]; continue; }
      for (let c = 0; c < 3; c++) out[i + c] = bil(src, w, h, ((sx + 1) / 2) * w, ((sy + 1) / 2) * h, c); out[i + 3] = src[i + 3];
    }
    img = { w, h, data: out }; return img;
  },
};

// ---------- Thermal ----------
export const THERMAL_PALETTES: Record<string, [number, string][]> = {
  ironbow: [[0, '#000010'], [0.2, '#3a0a6e'], [0.4, '#a5167e'], [0.6, '#e8501a'], [0.8, '#fbb11f'], [1, '#fffbe6']],
  rainbow: [[0, '#10006a'], [0.2, '#0050ff'], [0.4, '#00d6c8'], [0.6, '#5cf000'], [0.8, '#ffd000'], [1, '#ff1a00']],
  whitehot: [[0, '#000000'], [1, '#ffffff']],
};
/** Tablica 256 kolorów palety (interpolacja liniowa między punktami). */
export function paletteLut(stops: [number, string][]) {
  const lut = new Uint8ClampedArray(256 * 3); const cs = stops.map(([p, c]) => [p, ...parseColor(c)] as number[]);
  for (let i = 0; i < 256; i++) { const t = i / 255; let j = 0; while (j < cs.length - 2 && t > cs[j + 1][0]) j++; const a = cs[j], b = cs[j + 1]; const u = clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1); for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(lerp(a[c + 1], b[c + 1], u)); }
  return lut;
}
const thermal: EffectDef = {
  id: 'thermal', name: 'Thermal', category: 'Glitch & Signal', engine: 'SHADER', phase: 2,
  description: 'A thermal camera look: brightness mapped to a heat palette, with sensor noise and an optional crosshair.',
  params: [select('palette', 'Palette', 'ironbow', [['ironbow', 'Ironbow'], ['rainbow', 'Rainbow'], ['whitehot', 'White-hot']]), range('contrast', 'Contrast', 30, 0, 100, { unit: '%' }),
    range('noise', 'Noise', 15, 0, 100, { unit: '%' }), toggle('crosshair', 'Crosshair', true), seedParam(), ...common('brightness')],
  // ton = jasność (lekko wygładzona, 1 px × skala), kontrast rozciąga wokół 0,5, szum ±noise·0,15 w komórkach 1 px × skala
  render(ctx) {
    const s = blur(ctx.prep, Math.max(1, Math.round(ctx.scale))); const { w, h } = s; const d = s.data; const out = new Uint8ClampedArray(d.length); const lut = paletteLut(THERMAL_PALETTES[ctx.p.palette]);
    const kc = 1 + (ctx.p.contrast / 100) * 2, nz = (ctx.p.noise / 100) * 0.15, bs = Math.max(1, Math.round(ctx.scale));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; let t = (lum(d[i], d[i + 1], d[i + 2]) - 0.5) * kc + 0.5; if (nz) t += (hash01(Math.floor(x / bs), Math.floor(y / bs), ctx.p.seed) - 0.5) * 2 * nz;
      const j = Math.round(clamp(t, 0, 1) * 255) * 3; out[i] = lut[j]; out[i + 1] = lut[j + 1]; out[i + 2] = lut[j + 2]; out[i + 3] = d[i + 3];
    }
    if (ctx.p.crosshair) {   // celownik: biały krzyż z przerwą w środku, długość ramion 6% krótszego boku, grubość 1 px × skala
      const m = Math.min(w, h), L = 0.06 * m, gap = 0.015 * m, t = Math.max(1, Math.round(ctx.scale)); const cx = w / 2, cy = h / 2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = Math.abs(x + 0.5 - cx), dy = Math.abs(y + 0.5 - cy);
        if ((dy < t / 2 + 0.01 && dx > gap && dx < L) || (dx < t / 2 + 0.01 && dy > gap && dy < L)) { const i = (y * w + x) * 4; out[i] = out[i + 1] = out[i + 2] = 255; }
      }
    }
    return { w, h, data: out };
  },
};

// ---------- Edge Glow ----------
/** Siła krawędzi (Sobel na jasności), 0–1; skok czerń–biel ≈ 1. Mnożnik k = skala renderu: gradient liczony na piksel źródła,
 *  więc ta sama krawędź daje tę samą siłę w podglądzie i w eksporcie @2x. */
function sobel(s: Img, k = 1) {
  const { w, h } = s; const L = new Float32Array(w * h); for (let i = 0, p = 0; p < L.length; i += 4, p++) L[p] = lum(s.data[i], s.data[i + 1], s.data[i + 2]);
  const e = new Float32Array(w * h); const at = (x: number, y: number) => L[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
    const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
    e[y * w + x] = Math.min(1, (Math.hypot(gx, gy) / 4) * k);
  }
  return e;
}
const edgeglow: EffectDef = {
  id: 'edgeglow', name: 'Edge Glow', category: 'Light & Colour', engine: 'SHADER', phase: 2,
  description: 'Detected edges glow like neon over a darkened image.',
  params: [range('threshold', 'Threshold', 15, 0, 100, { unit: '%' }), range('glowRadius', 'Glow radius', 6, 1, 50, PX), select('colorMode', 'Colour', 'source', [['source', 'From image'], ['single', 'Single colour']]),
    color('glowColor', 'Glow colour', '#39ffd2'), range('sourceDim', 'Darken image', 70, 0, 100, { unit: '%' }), ...px1()],
  // krawędź = gładkie przejście siły Sobela wokół progu (±0,05); kolor krawędzi: kolor obrazu podbity do pełnej jasności albo jeden kolor;
  // wynik = obraz × (1 − dim) + screen(rdzeń krawędzi + rozmyta poświata × 1,5)
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const e = sobel(s, ctx.scale);
    const thr = ctx.p.threshold / 100; const single = ctx.p.colorMode === 'single'; const gc = parseColor(ctx.p.glowColor); const dim = 1 - ctx.p.sourceDim / 100;
    const layer = new Uint8ClampedArray(d.length);
    for (let p = 0, i = 0; p < e.length; p++, i += 4) {
      const a = clamp((e[p] - thr + 0.05) / 0.1, 0, 1); if (!a) continue;
      const mx = Math.max(d[i], d[i + 1], d[i + 2], 1); const c = single ? gc : [(d[i] / mx) * 255, (d[i + 1] / mx) * 255, (d[i + 2] / mx) * 255];
      layer[i] = c[0] * a; layer[i + 1] = c[1] * a; layer[i + 2] = c[2] * a; layer[i + 3] = 255;
    }
    const g = blur({ w, h, data: layer }, Math.max(1, Math.round(ctx.p.glowRadius * ctx.scale))).data; const out = new Uint8ClampedArray(d.length);
    for (let i = 0; i < d.length; i += 4) { for (let c = 0; c < 3; c++) { const q = Math.min(255, layer[i + c] + g[i + c] * 1.5); const b = d[i + c] * dim; out[i + c] = 255 - ((255 - b) * (255 - q)) / 255; } out[i + 3] = d[i + 3]; }
    return { w, h, data: out };
  },
};

// ---------- Aberration (lens) ----------
const lens: EffectDef = {
  id: 'lens', name: 'Aberration', category: 'Light & Colour', engine: 'SHADER', phase: 2,
  description: 'Lens flaws: chromatic aberration, barrel distortion, purple fringing and vignetting.',
  params: [range('strength', 'Strength', 60, 0, 100, { unit: '%' }), range('radial', 'Radial', 80, 0, 100, { unit: '%' }), range('barrel', 'Barrel', 20, -100, 100),
    range('fringe', 'Fringe', 30, 0, 100, { unit: '%' }), range('vignette', 'Vignette', 30, 0, 100, { unit: '%' }), ...px1()],
  // G próbkowany w punkcie po dystorsji beczkowatej (k = barrel·0,15·r²); R i B przesunięte od G o ±strength·0,8% krótszego boku:
  // kierunek promieniowy i rosnący z odległością (radial) albo stały w poziomie (1 − radial). Fringe: fioletowy nalot na mocnych krawędziach.
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const out = new Uint8ClampedArray(d.length); const cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy), m = Math.min(w, h);
    const kb = (ctx.p.barrel / 100) * 0.15, ca = (ctx.p.strength / 100) * 0.008 * m, rad = ctx.p.radial / 100, vg = ctx.p.vignette / 100, fr = ctx.p.fringe / 100;
    const e = fr ? sobel(s, ctx.scale) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy; const rn = Math.hypot(dx, dy) / R; const f = 1 + kb * rn * rn; const gx = cx + dx * f, gy = cy + dy * f;
      const ux = rn > 0 ? dx / (rn * R) : 0, uy = rn > 0 ? dy / (rn * R) : 0; const ox = ca * lerp(1, ux * rn * 1.5, rad), oy = ca * lerp(0, uy * rn * 1.5, rad);
      const i = (y * w + x) * 4; let r = bil(d, w, h, gx - ox, gy - oy, 0), g = bil(d, w, h, gx, gy, 1), b = bil(d, w, h, gx + ox, gy + oy, 2);
      if (e) { const k = fr * clamp(e[y * w + x] * 1.5, 0, 1) * 0.6; r = lerp(r, Math.max(r, 170), k); g = lerp(g, g * 0.6, k); b = lerp(b, Math.max(b, 230), k); }
      const v = 1 - vg * 0.7 * Math.pow(rn, 2.2); out[i] = r * v; out[i + 1] = g * v; out[i + 2] = b * v; out[i + 3] = d[i + 3];
    }
    return { w, h, data: out };
  },
};

export const SIGNAL_EFFECTS: EffectDef[] = [rgbsplit, scanline, crt, thermal, edgeglow, lens];
