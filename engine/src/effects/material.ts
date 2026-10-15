// Materiał i faktura, Faza 3 (plik 02; wszystko proj, Marble i Molten Metal proj?): Waves, Oil Paint, Watercolor, Chrome, Thin-Film,
// Marble, Molten Metal, Crystallize, Emboss. Długości w px × skala; szum w ułamkach szerokości obrazu albo w px źródła (x / skala),
// więc eksport @2x ma ten sam wygląd.
import type { EffectDef, Img } from '../core/types.ts';
import { color, common, range, seedParam, select, toggle } from '../core/params.ts';
import { blur, clamp, lerp, lum, parseColor } from '../core/util.ts';
import { bil, valueNoise, voronoi } from '../core/screen.ts';
import { paletteLut } from './signal.ts';

const px1 = () => [...common('brightness', 'contrast')];
const PX = { unit: 'px', px: true } as const;
const PCT = { unit: '%' } as const;
const DEG = Math.PI / 180;
const out0 = (s: Img) => ({ w: s.w, h: s.h, data: new Uint8ClampedArray(s.data.length) });
const lumF = (s: Img) => { const L = new Float32Array(s.w * s.h); for (let p = 0, i = 0; p < L.length; p++, i += 4) L[p] = lum(s.data[i], s.data[i + 1], s.data[i + 2]); return L; };
const fbm = (x: number, y: number, sd: number, oct = 4) => { let v = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { v += a * valueNoise(x * f, y * f, sd + o * 17); n += a; a *= 0.5; f *= 2; } return v / n; };
/** Gradient pola F (różnice centralne, px). */
const grad = (F: Float32Array, w: number, h: number, x: number, y: number) => { const at = (xx: number, yy: number) => F[clamp(yy, 0, h - 1) * w + clamp(xx, 0, w - 1)]; return [(at(x + 1, y) - at(x - 1, y)) / 2, (at(x, y + 1) - at(x, y - 1)) / 2]; };
const LIGHT = (deg: number, elev = 45) => { const a = deg * DEG, e = elev * DEG; return [Math.cos(a) * Math.cos(e), -Math.sin(a) * Math.cos(e), Math.sin(e)]; };

// ---------- Waves ----------
const waves: EffectDef = {
  id: 'waves', name: 'Waves', category: 'Material & Texture', engine: 'SHADER', phase: 3,
  description: 'The image on a rippling surface, or drawn with wavy lines.',
  params: [range('frequency', 'Frequency', 10, 1, 60), range('amplitude', 'Amplitude', 8, 0, 60, PX), range('direction', 'Direction', 0, -90, 90, { unit: '°' }), toggle('lineMode', 'Wavy lines', false),
    range('lineSpacing', 'Line spacing', 6, 2, 40, { ...PX, level: 'advanced' }), color('bgColor', 'Background', '#0a0a0a', { level: 'advanced' }), ...px1()],
  // fala biegnie wzdłuż kierunku d (frequency okresów na szerokość obrazu); powierzchnia: próbka przesunięta prostopadle o A·sin,
  // jasność × (1 + 0,25·nachylenie); linie: rodzina linii prostopadłych do d przesuniętych o A·sin, grubość ∝ jasność, kolor z obrazu
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const a = ctx.p.direction * DEG, dx = Math.cos(a), dy = Math.sin(a); const k = (2 * Math.PI * ctx.p.frequency) / w; const A = ctx.p.amplitude * ctx.scale; const out = out0(s);
    const sp = ctx.p.lineSpacing * ctx.scale; const bg = parseColor(ctx.p.bgColor); const sm = ctx.p.lineMode ? blur(s, Math.max(1, Math.round(sp / 2))).data : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const X = x + 0.5 - w / 2, Y = y + 0.5 - h / 2; const u = X * dx + Y * dy, v = -X * dy + Y * dx; const ph = k * u; const off = A * Math.sin(ph);
      if (sm) {
        const vv = (v - off) / sp; const dist = Math.abs(vv - Math.round(vv)) * sp; const L = lum(sm[i], sm[i + 1], sm[i + 2]); const wid = sp * 0.85 * L; const c = clamp(0.5 - (dist - wid / 2), 0, 1) * Math.min(1, wid);
        for (let q = 0; q < 3; q++) out.data[i + q] = lerp(bg[q], Math.min(255, sm[i + q] * 1.15 + 20), c);
      } else {
        const sl = A * k * Math.cos(ph); const m = 1 + 0.25 * clamp(sl, -1, 1); for (let q = 0; q < 3; q++) out.data[i + q] = bil(s.data, w, h, x + 0.5 - dy * off, y + 0.5 + dx * off, q) * m;
      }
      out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Oil Paint ----------
/** Kuwahara (4 kwadranty o boku r): średnia koloru z kwadrantu o najmniejszej wariancji jasności; sumy z obrazów całkowych, O(1)/piksel. */
function kuwahara(s: Img, r: number): Img {
  const { w, h } = s; const W1 = w + 1; const I = [0, 1, 2, 3, 4].map(() => new Float64Array(W1 * (h + 1)));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const L = lum(s.data[i], s.data[i + 1], s.data[i + 2]); const v = [s.data[i], s.data[i + 1], s.data[i + 2], L, L * L]; const o = (y + 1) * W1 + x + 1; for (let c = 0; c < 5; c++) I[c][o] = v[c] + I[c][o - 1] + I[c][o - W1] - I[c][o - W1 - 1]; }
  const box = (c: number, x0: number, y0: number, x1: number, y1: number) => I[c][y1 * W1 + x1] - I[c][y0 * W1 + x1] - I[c][y1 * W1 + x0] + I[c][y0 * W1 + x0];
  const out = out0(s);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = Infinity, br = 0, bg = 0, bb = 0;
    for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x0 = clamp(qx < 0 ? x - r : x, 0, w), x1 = clamp(qx < 0 ? x + 1 : x + r + 1, 0, w), y0 = clamp(qy < 0 ? y - r : y, 0, h), y1 = clamp(qy < 0 ? y + 1 : y + r + 1, 0, h); const n = (x1 - x0) * (y1 - y0); if (!n) continue;
      const m = box(3, x0, y0, x1, y1) / n, va = box(4, x0, y0, x1, y1) / n - m * m; if (va < best) { best = va; br = box(0, x0, y0, x1, y1) / n; bg = box(1, x0, y0, x1, y1) / n; bb = box(2, x0, y0, x1, y1) / n; }
    }
    const i = (y * w + x) * 4; out.data[i] = br; out.data[i + 1] = bg; out.data[i + 2] = bb; out.data[i + 3] = s.data[i + 3];
  }
  return out;
}
const oilpaint: EffectDef = {
  id: 'oilpaint', name: 'Oil Paint', category: 'Material & Texture', engine: 'SHADER', phase: 3,
  description: 'Oil painting: Kuwahara smoothing, brush-stroke texture and lit paint relief.',
  params: [range('brushSize', 'Brush size', 5, 1, 30, PX), select('strokeDirection', 'Stroke direction', 'auto', [['auto', 'Follow image'], ['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['diagonal', 'Diagonal']]),
    range('impasto', 'Impasto', 50, 0, 100, PCT), range('specular', 'Specular', 30, 0, 100, PCT), seedParam(), ...px1()],
  // kolor = Kuwahara o promieniu brushSize; pociągnięcia = szum rozciągnięty wzdłuż kierunku (auto: wzdłuż izolinii wygładzonej jasności),
  // w px źródła, długość ~3 × pędzel; relief = jasność kolorów + pociągnięcia, oświetlony z lewej góry (impasto) z odblaskiem (specular)
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sc = ctx.scale; const r = Math.max(1, Math.round(ctx.p.brushSize * sc)); const k = kuwahara(s, r); const out = out0(s);
    const L = lumF(blur(s, Math.max(1, Math.round(r * 2)))); const fixed = ({ horizontal: 0, vertical: 90, diagonal: 45 } as Record<string, number>)[ctx.p.strokeDirection]; const bs = ctx.p.brushSize; const sd = ctx.p.seed * 41 + 3;
    const Hm = new Float32Array(w * h); const KL = lumF(k);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let ang: number; if (fixed !== undefined) ang = fixed * DEG; else { const [gx, gy] = grad(L, w, h, x, y); ang = Math.atan2(gy, gx) + Math.PI / 2; }
      const X = x / sc, Y = y / sc; const u = X * Math.cos(ang) + Y * Math.sin(ang), v = -X * Math.sin(ang) + Y * Math.cos(ang);
      Hm[y * w + x] = KL[y * w + x] * 0.5 + valueNoise(u / (bs * 3), v / (bs * 0.45), sd) * 0.5;
    }
    const imp = (ctx.p.impasto / 100) * 3, spc = ctx.p.specular / 100; const Ld = LIGHT(135, 50); const Hv = [Ld[0], Ld[1], Ld[2] + 1]; const hn = Math.hypot(...Hv);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const [gx, gy] = grad(Hm, w, h, x, y); const nx = -gx * imp * r, ny = -gy * imp * r, nl = Math.hypot(nx, ny, 1); const nd = (nx * Ld[0] + ny * Ld[1] + Ld[2]) / nl;
      const shade = 1 + (nd - Ld[2]) * 0.9; const sp = spc * Math.pow(Math.max(0, (nx * Hv[0] + ny * Hv[1] + Hv[2]) / (nl * hn)), 30) * 0.8;
      for (let q = 0; q < 3; q++) { const v = k.data[i + q] * shade; out.data[i + q] = v + (255 - v) * sp; } out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Watercolor ----------
const watercolor: EffectDef = {
  id: 'watercolor', name: 'Watercolor', category: 'Material & Texture', engine: 'SHADER', phase: 3,
  description: 'Watercolour: soft bleeding washes, darker pigment edges, paper grain and granulation.',
  params: [range('wetness', 'Wetness', 50, 0, 100, PCT), range('edgeDarkening', 'Edge darkening', 50, 0, 100, PCT), range('paperGrain', 'Paper grain', 40, 0, 100, PCT), range('granulation', 'Granulation', 40, 0, 100, PCT),
    color('paperColor', 'Paper', '#f6f1e6', { level: 'advanced' }), seedParam(), ...px1()],
  // rozlew: obraz wygładzony Kuwaharą i rozmyty (∝ wetness), próbkowany z przesunięciem z szumu (rozmyte brzegi plam); pigment = 1 − kolor
  // (subtraktywnie na papierze); ciemniejsze brzegi: + edgeDarkening × |plama − jej mocne rozmycie|; granulacja i papier: szum w px źródła
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sc = ctx.scale; const wt = ctx.p.wetness / 100; const mn = Math.min(w, h); const base = blur(kuwahara(s, Math.max(1, Math.round(4 * sc))), Math.max(1, Math.round((1 + 5 * wt) * sc)));
    const big = blur(base, Math.max(1, Math.round(10 * sc))).data; const pp = parseColor(ctx.p.paperColor); const sd = ctx.p.seed * 53 + 9; const amp = (2 + 10 * wt) * sc; const out = out0(s);
    const ed = ctx.p.edgeDarkening / 100, gr = ctx.p.granulation / 100, pg = ctx.p.paperGrain / 100;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const nx = x / mn, ny = y / mn; const ox = (fbm(nx * 6, ny * 6, sd) - 0.5) * 2 * amp, oy = (fbm(nx * 6 + 31, ny * 6 + 17, sd) - 0.5) * 2 * amp;
      const c = [0, 1, 2].map((q) => bil(base.data, w, h, x + 0.5 + ox, y + 0.5 + oy, q)); const e = Math.abs(lum(c[0], c[1], c[2]) - lum(big[i], big[i + 1], big[i + 2]));
      const gran = 1 + gr * (fbm(x / sc / 7, y / sc / 7, sd + 5, 2) - 0.5) * 0.9; const paper = 1 - pg * 0.08 * valueNoise(x / sc / 2.5, y / sc / 2.5, sd + 7);
      for (let q = 0; q < 3; q++) { const pig = clamp((1 - c[q] / 255) * gran * (1 + ed * e * 3), 0, 1); out.data[i + q] = pp[q] * (1 - pig) * paper; }
      out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Chrome ----------
const ENVS: Record<string, [number, string][]> = {
  studio: [[0, '#ffffff'], [0.35, '#c9d2dc'], [0.48, '#2a2f36'], [0.52, '#6b5a4a'], [0.75, '#2b241e'], [1, '#0d0b09']],
  sunset: [[0, '#2b3f7a'], [0.3, '#f2a65a'], [0.48, '#ffe7b8'], [0.52, '#3a2a2a'], [1, '#120c0c']],
  cool: [[0, '#f4fbff'], [0.4, '#7fb2d9'], [0.5, '#0f2236'], [0.6, '#355e7a'], [1, '#061019']],
};
const chrome: EffectDef = {
  id: 'chrome', name: 'Chrome', category: 'Material & Texture', engine: 'SHADER', phase: 3,
  description: 'Brightness as height, rendered as polished metal reflecting an environment.',
  params: [range('relief', 'Relief', 60, 0, 100, PCT), select('environment', 'Environment', 'studio', [['studio', 'Studio'], ['sunset', 'Sunset'], ['cool', 'Cool']]), range('smoothness', 'Smoothness', 4, 0, 30, PX),
    color('tint', 'Tint', '#ffffff'), ...px1()],
  // wysokość = jasność rozmyta o smoothness; normalna z gradientu × relief; wektor odbicia r = 2(n·v)n − v (v = (0,0,1));
  // otoczenie = gradient wg wysokości kąta r (niebo u góry, horyzont, ziemia) z lekkim przesunięciem wg r_x; płaskie jasne miejsca
  // odbijają niebo, ciemne ziemię (bez tego płaskie miejsca trafiały w horyzont i obraz był brązowy, `oko`)
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sm = ctx.p.smoothness * ctx.scale; const L = lumF(sm >= 0.5 ? blur(s, Math.max(1, Math.round(sm))) : s); const env = paletteLut(ENVS[ctx.p.environment] ?? ENVS.studio); const tn = parseColor(ctx.p.tint);
    const kz = (ctx.p.relief / 100) * 0.04 * Math.min(w, h); const out = out0(s);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const [gx, gy] = grad(L, w, h, x, y); const nx = -gx * kz, ny = -gy * kz, nl = Math.hypot(nx, ny, 1); const nz = 1 / nl; const rx = (2 * nz * nx) / nl, ry = (2 * nz * ny) / nl;
      const t = clamp(0.62 - 0.45 * L[y * w + x] + 0.5 * ry + 0.12 * rx, 0, 1); const j = Math.round(t * 255) * 3;
      for (let q = 0; q < 3; q++) out.data[i + q] = env[j + q] * (tn[q] / 255); out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Thin-Film ----------
const thinfilm: EffectDef = {
  id: 'thinfilm', name: 'Thin-Film', category: 'Material & Texture', engine: 'SHADER', phase: 3,
  description: 'Soap-bubble iridescence: interference colours driven by brightness as film thickness.',
  params: [range('thicknessScale', 'Thickness', 100, 20, 300, PCT), range('hueShift', 'Hue shift', 0, 0, 360, { unit: '°' }), range('fresnel', 'Film strength', 70, 0, 100, PCT), range('noise', 'Noise', 30, 0, 100, PCT), seedParam(), ...px1()],
  // grubość d = (150 + 650·(jasność + szum)) nm × thicknessScale; kolor interferencji dla λ = 650 / 532 / 450 nm:
  // I = 0,5 + 0,5·cos(4π·1,33·d/λ + hueShift); wynik = obraz × (1 − f) + (0,35·obraz + 0,8·I·255) × f, f = fresnel
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sc = ctx.scale; const L = lumF(blur(s, Math.max(1, Math.round(2 * sc)))); const ts = ctx.p.thicknessScale / 100; const ph = ctx.p.hueShift * DEG; const f = ctx.p.fresnel / 100; const nz = ctx.p.noise / 100;
    const lam = [650, 532, 450]; const mn = Math.min(w, h); const sd = ctx.p.seed * 61 + 5; const out = out0(s);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const d = (150 + 650 * (L[y * w + x] + nz * (fbm((x / mn) * 4, (y / mn) * 4, sd) - 0.5))) * ts;
      for (let q = 0; q < 3; q++) { const I = 0.5 + 0.5 * Math.cos((4 * Math.PI * 1.33 * d) / lam[q] + ph); out.data[i + q] = lerp(s.data[i + q], s.data[i + q] * 0.35 + I * 255 * 0.8, f); }
      out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Marble ----------
const MARBLES: Record<string, { base: [number, string][]; vein: string }> = {
  carrara: { base: [[0, '#8f8c88'], [1, '#f4f2ee']], vein: '#5d5a58' }, nero: { base: [[0, '#050505'], [1, '#3a3836']], vein: '#e8e4dc' },
  verde: { base: [[0, '#0d2a1f'], [1, '#4f8a6a']], vein: '#d9eadf' }, rosso: { base: [[0, '#4a1210'], [1, '#c4604f']], vein: '#f1dcd0' },
};
const marble: EffectDef = {
  id: 'marble', name: 'Marble', category: 'Material & Texture', engine: 'SHADER', phase: 3,
  description: 'Marble: the image as stone tone, crossed by turbulent veins that bend with it.',
  params: [range('veinScale', 'Vein scale', 6, 1, 30), range('turbulence', 'Turbulence', 50, 0, 100, PCT), select('palette', 'Stone', 'carrara', [['carrara', 'Carrara'], ['nero', 'Nero'], ['verde', 'Verde'], ['rosso', 'Rosso']]),
    range('contrast', 'Image contrast', 70, 0, 100, PCT), seedParam(), ...common('brightness')],
  // interpretacja (proj?): ton kamienia = paleta(jasność obrazu × contrast + szum × (1 − contrast)); żyłki: |sin(veinScale·(x + y)·π/szer.
  // + turbulencja·fbm + 3·jasność)|^0,2 odwrócone, więc żyłki wyginają się wzdłuż zmian jasności
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const L = lumF(blur(s, Math.max(1, Math.round(2 * ctx.scale)))); const P = MARBLES[ctx.p.palette] ?? MARBLES.carrara; const base = paletteLut(P.base); const vc = parseColor(P.vein);
    const ct = ctx.p.contrast / 100, tb = ctx.p.turbulence / 100; const mn = Math.min(w, h); const sd = ctx.p.seed * 71 + 1; const out = out0(s);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const nx = x / mn, ny = y / mn; const n = fbm(nx * 3, ny * 3, sd, 5); const Lp = L[y * w + x];
      const t = clamp(Lp * ct + n * (1 - ct) * 0.9 + 0.05, 0, 1); const j = Math.round(t * 255) * 3;
      const v = Math.sin(((nx + ny) * ctx.p.veinScale + tb * 16 * (fbm(nx * 2.5 + 9, ny * 2.5, sd + 3, 5) - 0.5) + 3 * Lp) * Math.PI); const vein = Math.pow(1 - Math.abs(v), 6) * (0.4 + 0.6 * fbm(nx * 8, ny * 8, sd + 9, 3));
      for (let q = 0; q < 3; q++) out.data[i + q] = lerp(base[j + q], vc[q], clamp(vein * 1.4, 0, 1)); out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Molten Metal ----------
const HEATS: Record<string, [number, string][]> = {
  forge: [[0, '#140302'], [0.35, '#7a0d04'], [0.6, '#e2400c'], [0.8, '#ffb22e'], [1, '#fff6d8']],
  gold: [[0, '#1a0f02'], [0.4, '#7a4a08'], [0.7, '#e3a923'], [1, '#fff4c2']],
  plasma: [[0, '#05031a'], [0.4, '#3a0f8a'], [0.7, '#2a9de0'], [1, '#e8fbff']],
};
const molten: EffectDef = {
  id: 'molten', name: 'Molten Metal', category: 'Material & Texture', engine: 'SHADER', phase: 3,
  description: 'Molten metal: bright areas pool into glowing liquid blobs with a hot palette.',
  params: [range('flow', 'Flow', 40, 0, 100, PCT), select('heatPalette', 'Heat palette', 'forge', [['forge', 'Forge'], ['gold', 'Gold'], ['plasma', 'Plasma']]), range('viscosity', 'Viscosity', 50, 0, 100, PCT),
    range('glow', 'Glow', 60, 0, 100, PCT), range('threshold', 'Threshold', 45, 5, 95, PCT), seedParam(), ...px1()],
  // interpretacja (proj?): pole = jasność rozmyta (promień ∝ viscosity, jak metaballe) próbkowana z przesunięciem szumu (flow);
  // metal tam, gdzie pole > próg (wygładzona krawędź), kolor = paleta(pole), odblask z gradientu pola; poświata = rozmyta maska × paleta
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sc = ctx.scale; const mn = Math.min(w, h); const vr = Math.max(1, Math.round((2 + 0.03 * mn / sc * (ctx.p.viscosity / 100)) * sc)); const F0 = lumF(blur(s, vr));
    const fl = (ctx.p.flow / 100) * 0.05 * mn; const sd = ctx.p.seed * 83 + 7; const F = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const nx = x / mn, ny = y / mn; const ox = (fbm(nx * 4, ny * 4, sd) - 0.5) * 2 * fl, oy = (fbm(nx * 4 + 11, ny * 4 + 23, sd) - 0.5) * 2 * fl; F[y * w + x] = F0[clamp(Math.round(y + oy), 0, h - 1) * w + clamp(Math.round(x + ox), 0, w - 1)]; }
    const th = ctx.p.threshold / 100; const pal = paletteLut(HEATS[ctx.p.heatPalette] ?? HEATS.forge); const g = ctx.p.glow / 100; const mask = { w, h, data: new Uint8ClampedArray(w * h * 4) }; const out = out0(s);
    const edge = 0.02; for (let p = 0; p < w * h; p++) { const m = clamp((F[p] - th) / edge + 0.5, 0, 1) * 255; mask.data[p * 4] = m; mask.data[p * 4 + 3] = 255; }
    const gl = g ? blur(mask, Math.max(1, Math.round(0.03 * mn))).data : null; const Ld = LIGHT(135, 55);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4; const m = mask.data[i] / 255; const t = clamp((F[p] - th) / Math.max(0.05, 1 - th), 0, 1); const j = Math.round((0.35 + 0.65 * t) * 255) * 3;
      const [gx, gy] = grad(F, w, h, x, y); const k = 0.25 * mn; const nx = -gx * k, ny = -gy * k, nl = Math.hypot(nx, ny, 1); const sp = Math.pow(Math.max(0, (nx * Ld[0] + ny * Ld[1] + Ld[2]) / nl), 24) * 0.7;
      const gv = gl ? (gl[i] / 255) * g : 0; const gj = Math.round(0.45 * 255) * 3;
      for (let q = 0; q < 3; q++) { const bgc = 6 + pal[gj + q] * gv * 0.9; const metal = pal[j + q] + (255 - pal[j + q]) * sp; out.data[i + q] = lerp(bgc, metal, m); }
      out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Crystallize ----------
const crystallize: EffectDef = {
  id: 'crystallize', name: 'Crystallize', category: 'Material & Texture', engine: 'GEOM', phase: 3,
  description: 'Voronoi crystals in their average colour, with faceted bevels and edges.',
  params: [range('cellSize', 'Cell size', 18, 4, 120, PX), range('edge', 'Edge', 1, 0, 6, { ...PX, step: 0.5 }), range('bevelShading', 'Bevel shading', 50, 0, 100, PCT), seedParam(), ...px1()],
  // komórki Voronoi o boku cellSize (jitter 0,9) w średnim kolorze; faseta: normalna nachylona od punktu komórki ku pikselowi o kąt
  // ∝ odległość / (odległość + odległość od granicy), światło z lewej góry; krawędź: ciemna linia o grubości edge
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const cs = Math.max(2, ctx.p.cellSize * ctx.scale); const V = voronoi(w, h, cs, 0.9, ctx.p.seed * 19 + 2);
    const sum = new Float64Array(V.n * 4); for (let p = 0, i = 0; p < w * h; p++, i += 4) { const k = V.id[p] * 4; sum[k] += s.data[i]; sum[k + 1] += s.data[i + 1]; sum[k + 2] += s.data[i + 2]; sum[k + 3]++; }
    const bv = ctx.p.bevelShading / 100; const et = ctx.p.edge * ctx.scale; const Ld = LIGHT(135, 50); const out = out0(s);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4, k = V.id[p] * 4; const n = sum[k + 3]; const [sx, sy] = V.site(V.id[p]); const dx = x + 0.5 - sx, dy = y + 0.5 - sy, dl = Math.hypot(dx, dy) || 1;
      const tilt = (V.f1[p] / (V.f1[p] + V.edge[p] + 1e-6)) * 0.8; const nx = (dx / dl) * tilt, ny = (dy / dl) * tilt, nz = Math.sqrt(1 - tilt * tilt); const nd = nx * Ld[0] + ny * Ld[1] + nz * Ld[2];
      const shade = lerp(1, 1 + (nd - Ld[2]) * 1.2, bv); const e = et > 0 ? clamp(0.5 - (V.edge[p] - et / 2), 0, 1) * Math.min(1, et) * 0.7 : 0;
      for (let q = 0; q < 3; q++) out.data[i + q] = (sum[k + q] / n) * shade * (1 - e); out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Emboss ----------
const emboss: EffectDef = {
  id: 'emboss', name: 'Emboss', category: 'Material & Texture', engine: 'SHADER', phase: 3,
  description: 'Embossed relief: the image as a raised surface lit from one direction.',
  params: [range('angle', 'Light angle', 135, 0, 360, { unit: '°' }), range('height', 'Height', 50, 0, 100, PCT), range('softness', 'Softness', 1, 0, 20, PX),
    select('baseColorMode', 'Base colour', 'gray', [['gray', 'Gray'], ['image', 'Image']]), ...px1()],
  // wysokość = jasność (rozmyta o softness); kolor = 128 + (n·L − L_z)·(255 albo kolor obrazu) — płaskie miejsca zostają szare (albo
  // w kolorze obrazu), zbocza zwrócone do światła jaśniejsze
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sf = ctx.p.softness * ctx.scale; const L = lumF(sf >= 0.5 ? blur(s, Math.max(1, Math.round(sf))) : s); const Ld = LIGHT(ctx.p.angle, 45);
    const kz = (ctx.p.height / 100) * 8 * ctx.scale; const img = ctx.p.baseColorMode === 'image'; const out = out0(s);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const [gx, gy] = grad(L, w, h, x, y); const nx = -gx * kz * 4, ny = -gy * kz * 4, nl = Math.hypot(nx, ny, 1); const d = (nx * Ld[0] + ny * Ld[1] + Ld[2]) / nl - Ld[2];
      for (let q = 0; q < 3; q++) out.data[i + q] = img ? s.data[i + q] * (1 + d * 1.5) : 128 + d * 255; out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

export const MATERIAL_EFFECTS: EffectDef[] = [waves, oilpaint, watercolor, chrome, thinfilm, marble, molten, crystallize, emboss];
