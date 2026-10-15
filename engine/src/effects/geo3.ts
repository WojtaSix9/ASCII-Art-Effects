// Geometryczne, Faza 3 (plik 02, sekcja 4; wszystko proj): Lattice, Topography, Neon Grid, Schematic, Droste, Iso Extrude.
// Długości w px × skala, losowość z seeda w ułamkach obrazu, więc eksport @2x ma ten sam układ.
import type { EffectDef, Img } from '../core/types.ts';
import { color, common, range, seedParam, select, toggle } from '../core/params.ts';
import { blur, clamp, lerp, lum, mulberry32, parseColor } from '../core/util.ts';
import { bil } from '../core/screen.ts';
import { paletteLut } from './signal.ts';

const px1 = () => [...common('brightness', 'contrast')];
const PX = { unit: 'px', px: true } as const;
const DEG = Math.PI / 180;
const fill = (w: number, h: number, c: number[], src: Img): Img => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < d.length; i += 4) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = src.data[i + 3]; } return { w, h, data: d }; };
/** Odcinek o grubości t (kapsuła) z wygładzoną krawędzią, kolor c, krycie a. */
function seg(img: Img, ax: number, ay: number, bx: number, by: number, t: number, c: number[], a = 1) {
  const { w, h, data: d } = img; const r = t / 2; const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + r + 1)), y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + r + 1));
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5 - ax, py = y + 0.5 - ay; const u = clamp((px * dx + py * dy) / L2, 0, 1); const dist = Math.hypot(px - u * dx, py - u * dy);
    const k = clamp(0.5 - (dist - r), 0, 1) * Math.min(1, t) * a; if (!k) continue; const i = (y * w + x) * 4; for (let q = 0; q < 3; q++) d[i + q] = lerp(d[i + q], c[q], k);
  }
}

// ---------- Lattice ----------
const lattice: EffectDef = {
  id: 'lattice', name: 'Lattice', category: 'Geometric', engine: 'GEOM', phase: 3,
  description: 'A lattice: grid nodes joined by edges; node size and line weight follow brightness.',
  params: [range('spacing', 'Spacing', 14, 4, 60, PX), range('nodeSize', 'Node size', 5, 0, 20, PX), select('connections', 'Connections', '4', [['4', '4 (square)'], ['8', '8 (with diagonals)'], ['hex', 'Hexagonal']]),
    range('lineThickness', 'Line thickness', 1.5, 0, 6, { ...PX, step: 0.5 }), select('colorMode', 'Colour', 'image', [['image', 'From image'], ['mono', 'White']]), color('bgColor', 'Background', '#0a0a0a'), ...px1()],
  // węzły co `spacing` (heks: co drugi rząd przesunięty o pół, rzędy co 0,866·spacing); średnica węzła = nodeSize × jasność, grubość krawędzi
  // = lineThickness × średnia jasność końców; kolor z obrazu podbity do pełnej jasności albo biały
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sp = Math.max(2, ctx.p.spacing * ctx.scale); const hex = ctx.p.connections === 'hex'; const dy = hex ? sp * 0.866 : sp; const sm = blur(s, Math.max(1, Math.round(sp / 3))).data;
    const out = fill(w, h, parseColor(ctx.p.bgColor), s); const nx = Math.ceil(w / sp) + 1, ny = Math.ceil(h / dy) + 1; const mono = ctx.p.colorMode === 'mono';
    const P = (i: number, j: number) => [(i + 0.5 + (hex && j & 1 ? 0.5 : 0)) * sp, (j + 0.5) * dy] as const;
    const info = (x: number, y: number) => { const q = (clamp(Math.floor(y), 0, h - 1) * w + clamp(Math.floor(x), 0, w - 1)) * 4; const L = lum(sm[q], sm[q + 1], sm[q + 2]); const mx = Math.max(sm[q], sm[q + 1], sm[q + 2], 1); return { L, c: mono ? [255, 255, 255] : [sm[q] / mx * 255, sm[q + 1] / mx * 255, sm[q + 2] / mx * 255] }; };
    const nb = hex ? (j: number) => [[1, 0], [j & 1 ? 1 : 0, 1], [j & 1 ? 0 : -1, 1]] : ctx.p.connections === '8' ? () => [[1, 0], [0, 1], [1, 1], [-1, 1]] : () => [[1, 0], [0, 1]];
    const lt = ctx.p.lineThickness * ctx.scale; const ns = ctx.p.nodeSize * ctx.scale;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const [ax, ay] = P(i, j); const A = info(ax, ay); if (lt > 0) for (const [di, dj] of nb(j)) { const [bx, by] = P(i + di, j + dj); const B = info(bx, by); seg(out, ax, ay, bx, by, lt * (A.L + B.L) / 2, A.c.map((v, q) => (v + B.c[q]) / 2)); } }
    if (ns > 0) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const [ax, ay] = P(i, j); const A = info(ax, ay); seg(out, ax, ay, ax, ay, ns * A.L, A.c); }
    return out;
  },
};

// ---------- Topography ----------
const RAMPS: Record<string, [number, string][]> = { terrain: [[0, '#1d3b5c'], [0.3, '#3f7f5f'], [0.55, '#a7b56a'], [0.75, '#c9a06a'], [1, '#f4efe6']], heat: [[0, '#14001f'], [0.4, '#a3194d'], [0.75, '#f08a24'], [1, '#fff3c4']], mono: [[0, '#1a1a1a'], [1, '#f2f2f2']] };
const topography: EffectDef = {
  id: 'topography', name: 'Topography', category: 'Geometric', engine: 'GEOM', phase: 3,
  description: 'Contour lines of brightness, like a topographic map.',
  params: [range('lineCount', 'Lines', 14, 3, 50), range('thickness', 'Thickness', 1.2, 0.5, 6, { ...PX, step: 0.1 }), range('smoothing', 'Smoothing', 4, 0, 30, PX),
    select('colorRamp', 'Colour ramp', 'terrain', [['terrain', 'Terrain'], ['heat', 'Heat'], ['mono', 'Mono']]), toggle('fillBands', 'Fill bands', true), color('lineColor', 'Line colour', '#2a2118'), ...px1()],
  // wysokość v = wygładzona jasność × liczba linii; izolinia przy całkowitym v; odległość od niej w px = |v − round(v)| / |∇v|,
  // więc linia ma stałą grubość niezależnie od nachylenia; wypełnienie: pas floor(v) w kolorze rampy (bez wypełnienia: tło z rampy w 0)
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sm = ctx.p.smoothing > 0 ? blur(s, Math.max(1, Math.round(ctx.p.smoothing * ctx.scale))) : s; const n = ctx.p.lineCount; const V = new Float32Array(w * h);
    for (let p = 0, i = 0; p < V.length; p++, i += 4) V[p] = lum(sm.data[i], sm.data[i + 1], sm.data[i + 2]) * n;
    const lut = paletteLut(RAMPS[ctx.p.colorRamp]); const lc = parseColor(ctx.p.lineColor); const th = ctx.p.thickness * ctx.scale; const fillB = ctx.p.fillBands; const out = new Uint8ClampedArray(s.data.length);
    const at = (x: number, y: number) => V[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4; const v = V[p]; const g = Math.hypot(at(x + 1, y) - at(x - 1, y), at(x, y + 1) - at(x, y - 1)) / 2; const dist = Math.abs(v - Math.round(v)) / Math.max(g, 1e-4);
      const k = clamp(0.5 - (dist - th / 2), 0, 1) * Math.min(1, th); const band = fillB ? clamp(Math.floor(v) / Math.max(1, n - 1), 0, 1) : 0; const j = Math.round(band * 255) * 3;
      const line = fillB ? lc : [lut[255 * 3], lut[255 * 3 + 1], lut[255 * 3 + 2]].map((c, q) => lerp(c, lut[Math.round(clamp(v / n, 0, 1) * 255) * 3 + q], 0.5));
      for (let q = 0; q < 3; q++) out[i + q] = lerp(lut[j + q], line[q], k); out[i + 3] = s.data[i + 3];
    }
    return { w, h, data: out };
  },
};

// ---------- Neon Grid ----------
const hsv = (hdeg: number, sat: number, val: number) => { const c = val * sat, hp = (((hdeg % 360) + 360) % 360) / 60, xx = c * (1 - Math.abs((hp % 2) - 1)); const [r, g, b] = hp < 1 ? [c, xx, 0] : hp < 2 ? [xx, c, 0] : hp < 3 ? [0, c, xx] : hp < 4 ? [0, xx, c] : hp < 5 ? [xx, 0, c] : [c, 0, xx]; const m = val - c; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; };
const neongrid: EffectDef = {
  id: 'neongrid', name: 'Neon Grid', category: 'Geometric', engine: 'SHADER', phase: 3,
  description: 'A synthwave neon grid; the image drives the brightness and width of the glowing lines.',
  params: [range('gridSpacing', 'Grid spacing', 24, 6, 120, PX), range('lineWidth', 'Line width', 1.5, 0.5, 8, { ...PX, step: 0.5 }), range('glow', 'Glow', 60, 0, 100, { unit: '%' }),
    range('hue', 'Hue', 300, 0, 360, { unit: '°' }), toggle('perspective', 'Perspective floor', false), ...px1()],
  // linie siatki (w perspektywie: podłoga od horyzontu na 40% wysokości, zbiegająca do środka) o grubości lineWidth × (0,3 + 0,7·jasność)
  // i jasności ∝ jasność obrazu; kolor: odcień hue, przy jasnych miejscach przesunięty o 40°; poświata = rozmycie linii, screen
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sm = blur(s, Math.max(1, Math.round(ctx.scale * 2))).data; const sp = ctx.p.gridSpacing * ctx.scale, lw = ctx.p.lineWidth * ctx.scale; const persp = ctx.p.perspective; const hy = h * 0.4;
    const layer = new Uint8ClampedArray(s.data.length); const out = new Uint8ClampedArray(s.data.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const L = lum(sm[i], sm[i + 1], sm[i + 2]); let dist: number, wid = lw * (0.3 + 0.7 * L);
      if (persp) { const dyy = y + 0.5 - hy; if (dyy <= 0) { for (let q = 0; q < 3; q++) out[i + q] = s.data[i + q] * 0.25; out[i + 3] = s.data[i + 3]; continue; } const z = (h * 0.6) / dyy; const u = ((x + 0.5 - w / 2) * z) / sp, v = (z * h * 0.25) / sp; const fu = Math.abs(u - Math.round(u)) * sp / z, fv = Math.abs(v - Math.round(v)) * sp / z * (dyy / (h * 0.6)); dist = Math.min(fu, fv * 4); wid *= clamp(dyy / (h * 0.3), 0.3, 1.5); }
      else { const fu = Math.abs((x + 0.5) / sp - Math.round((x + 0.5) / sp)) * sp, fv = Math.abs((y + 0.5) / sp - Math.round((y + 0.5) / sp)) * sp; dist = Math.min(fu, fv); }
      const k = clamp(0.5 - (dist - wid / 2), 0, 1) * Math.min(1, wid) * (0.25 + 0.75 * L); const c = hsv(ctx.p.hue + 40 * L, 0.85, 1);
      for (let q = 0; q < 3; q++) layer[i + q] = c[q] * k; layer[i + 3] = 255; if (!(persp && y + 0.5 - hy <= 0)) { for (let q = 0; q < 3; q++) out[i + q] = 8 + s.data[i + q] * 0.06; out[i + 3] = s.data[i + 3]; }
    }
    const g = ctx.p.glow / 100; const gl = g ? blur({ w, h, data: layer }, Math.max(1, Math.round(3 * ctx.scale))).data : null;
    for (let i = 0; i < out.length; i += 4) for (let q = 0; q < 3; q++) { let v = layer[i + q]; if (gl) v = Math.min(255, v + gl[i + q] * 1.8 * g); out[i + q] = 255 - ((255 - out[i + q]) * (255 - v)) / 255; }
    return { w, h, data: out };
  },
};

// ---------- Schematic ----------
const schematic: EffectDef = {
  id: 'schematic', name: 'Schematic', category: 'Geometric', engine: 'GEOM', phase: 3,
  description: 'A technical drawing: grid, measurement crosses, detected edges and dimension lines.',
  params: [range('gridSpacing', 'Grid spacing', 40, 8, 160, PX), color('lineColor', 'Line colour', '#d8e8ff'), color('bgColor', 'Background', '#0c2038', { level: 'advanced' }),
    range('annotationDensity', 'Annotations', 40, 0, 100, { unit: '%' }), range('edgeThreshold', 'Edge threshold', 12, 1, 60, { unit: '%' }), seedParam(), ...px1()],
  // tło granatowe; siatka główna co gridSpacing (krycie 0,35) i pomocnicza co 1/4 (0,12); krawędzie: Sobel (na px źródła) > próg, krycie 0,9;
  // adnotacje z seeda: krzyże pomiarowe w węzłach siatki i linie wymiarowe z zakończeniami (bez tekstu)
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sc = ctx.scale; const out = fill(w, h, parseColor(ctx.p.bgColor), s); const d = out.data; const lc = parseColor(ctx.p.lineColor); const G = ctx.p.gridSpacing * sc; const t = Math.max(1, sc);
    const sm = blur(s, Math.max(1, Math.round(sc))); const L = new Float32Array(w * h); for (let p = 0, i = 0; p < L.length; p++, i += 4) L[p] = lum(sm.data[i], sm.data[i + 1], sm.data[i + 2]); const thr = ctx.p.edgeThreshold / 100;
    const at = (x: number, y: number) => L[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const onG = (v: number, step: number) => Math.abs(v + 0.5 - Math.round((v + 0.5) / step) * step) < t / 2;
      let a = onG(x, G) || onG(y, G) ? 0.35 : onG(x, G / 4) || onG(y, G / 4) ? 0.12 : 0;
      const e = Math.hypot(at(x + 1, y) - at(x - 1, y), at(x, y + 1) - at(x, y - 1)) * sc; if (e > thr) a = Math.max(a, 0.9 * clamp((e - thr) / thr + 0.5, 0, 1));
      if (a) for (let q = 0; q < 3; q++) d[i + q] = lerp(d[i + q], lc[q], a);
    }
    const rnd = mulberry32(ctx.p.seed * 811 + 3); const nA = Math.round((ctx.p.annotationDensity / 100) * (w / G) * (h / G) * 0.3);
    for (let k = 0; k < nA; k++) {
      const gx = Math.round(rnd() * (w / G)) * G, gy = Math.round(rnd() * (h / G)) * G; const kind = rnd();
      if (kind < 0.5) { const r = G * 0.18; seg(out, gx - r, gy, gx + r, gy, t, lc); seg(out, gx, gy - r, gx, gy + r, t, lc); seg(out, gx - r * 0.5, gy - r * 0.5, gx + r * 0.5, gy - r * 0.5, t, lc, 0.6); }
      else { const len = G * (1 + Math.floor(rnd() * 3)), horiz = rnd() < 0.5, e2 = G * 0.12; const bx = horiz ? gx + len : gx, by = horiz ? gy : gy + len; seg(out, gx, gy, bx, by, t, lc, 0.8); for (const [px, py] of [[gx, gy], [bx, by]]) horiz ? seg(out, px, py - e2, px, py + e2, t, lc) : seg(out, px - e2, py, px + e2, py, t, lc); }
    }
    return out;
  },
};

// ---------- Droste ----------
const droste: EffectDef = {
  id: 'droste', name: 'Droste', category: 'Geometric', engine: 'SHADER', phase: 3,
  description: 'The Droste effect: the image nested inside itself, turning a little with each level.',
  params: [range('scaleRatio', 'Scale ratio', 55, 20, 90, { unit: '%' }), range('rotation', 'Rotation per level', 12, -90, 90, { unit: '°' }), range('repeats', 'Repeats', 6, 1, 12),
    range('centerX', 'Center X', 50, 0, 100, { unit: '%' }), range('centerY', 'Center Y', 50, 0, 100, { unit: '%' }), ...px1()],
  // m = max(|dx|/(W/2), |dy|/(H/2)) względem środka; poziom k = floor(log m / log ratio), najwyżej repeats; punkt źródła = środek obrazu +
  // (piksel − środek) / ratio^k obrócony o −k × rotation; obraz na poziomie k jest więc kopią ramki pomniejszoną ratio^k razy
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const out = new Uint8ClampedArray(d.length); const r = ctx.p.scaleRatio / 100; const lr = Math.log(r); const cx = (ctx.p.centerX / 100) * w, cy = (ctx.p.centerY / 100) * h; const rot = ctx.p.rotation * DEG;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy; const m = Math.max(Math.abs(dx) / (w / 2), Math.abs(dy) / (h / 2), 1e-9); const k = m >= 1 ? 0 : Math.min(ctx.p.repeats, Math.floor(Math.log(m) / lr));
      const f = Math.pow(r, -k), a = -k * rot, c = Math.cos(a), sn = Math.sin(a); const ux = dx * f, uy = dy * f; const sx = w / 2 + ux * c - uy * sn, sy = h / 2 + ux * sn + uy * c;
      const i = (y * w + x) * 4; for (let q = 0; q < 3; q++) out[i + q] = k ? bil(d, w, h, sx, sy, q) : d[i + q]; out[i + 3] = d[i + 3];
    }
    return { w, h, data: out };
  },
};

// ---------- Iso Extrude ----------
const isoextrude: EffectDef = {
  id: 'isoextrude', name: 'Iso Extrude', category: 'Geometric', engine: '3D', phase: 3,
  description: 'Isometric bars whose height follows the brightness of each cell (a 3D histogram).',
  params: [range('cellSize', 'Cell size', 14, 4, 60, PX), range('maxHeight', 'Max height', 150, 0, 400, { unit: '%' }), range('angle', 'View angle', 30, 15, 45, { unit: '°' }),
    range('shading', 'Shading', 60, 0, 100, { unit: '%' }), toggle('outline', 'Outline', true), select('colorMode', 'Colour', 'image', [['image', 'From image'], ['height', 'Height ramp']]), color('bgColor', 'Background', '#0b0b10'), ...px1()],
  // siatka komórek obrócona o 45° i spłaszczona (kąt widoku): podstawa komórki (a, b) w ekranie X = (a − b)·cs·cos45, Y = (a + b)·cs·sin45·sin(kąt);
  // słupek o wysokości maxHeight × jasność × cs (kolor i jasność z obrazu w miejscu podstawy); ściany: góra 100%, lewa 1 − 0,3·shading,
  // prawa 1 − 0,6·shading; rysowanie od tyłu (rosnące a + b), obrys: krawędzie ścian ciemniejsze
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const cs = Math.max(2, ctx.p.cellSize * ctx.scale); const sm = blur(s, Math.max(1, Math.round(cs / 2))).data; const out = fill(w, h, parseColor(ctx.p.bgColor), s); const d = out.data;
    const kx = cs * Math.SQRT1_2, ky = cs * Math.SQRT1_2 * Math.sin(ctx.p.angle * DEG) * 1.4; const H = (ctx.p.maxHeight / 100) * cs; const sh = ctx.p.shading / 100; const ramp = paletteLut([[0, '#1b2a6b'], [0.5, '#e0457b'], [1, '#ffe08a']]);
    const toScr = (a: number, b: number) => [(a - b) * kx + w / 2, (a + b) * ky - h * 0.15];
    const amax = Math.ceil((w / (2 * kx)) + (h * 1.3 / (2 * ky))) + 2; const cells: [number, number][] = []; for (let a = -amax; a <= amax; a++) for (let b = -amax; b <= amax; b++) { const [X, Y] = toScr(a + 0.5, b + 0.5); if (X > -cs * 2 && X < w + cs * 2 && Y > -cs * 2 && Y < h + H + cs * 2) cells.push([a, b]); }
    cells.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
    const poly = (pts: number[][], c: number[]) => {   // wypukły czworokąt z wygładzoną krawędzią
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(w - 1, Math.ceil(Math.max(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
      const area = pts.reduce((acc, p, i) => { const q = pts[(i + 1) % 4]; return acc + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        let md = Infinity; const px = x + 0.5, py = y + 0.5;
        for (let i = 0; i < 4; i++) { const p = pts[i], q = pts[(i + 1) % 4]; const ex = q[0] - p[0], ey = q[1] - p[1]; const len = Math.hypot(ex, ey) || 1e-9; const sd = (area * (ex * (py - p[1]) - ey * (px - p[0]))) / len; md = Math.min(md, sd); }
        const k = clamp(md + 0.5, 0, 1); if (!k) continue; const edge = ctx.p.outline ? clamp(1.2 * ctx.scale - md, 0, 1) * 0.5 : 0; const i = (y * w + x) * 4; for (let q = 0; q < 3; q++) d[i + q] = lerp(d[i + q], c[q] * (1 - edge), k);
      }
    };
    for (const [a, b] of cells) {
      const [X, Y] = toScr(a + 0.5, b + 0.5); const sx = clamp(Math.floor(X), 0, w - 1), sy = clamp(Math.floor(Y), 0, h - 1), q = (sy * w + sx) * 4; const L = lum(sm[q], sm[q + 1], sm[q + 2]); const hh = H * L;
      const base = ctx.p.colorMode === 'height' ? [ramp[Math.round(L * 255) * 3], ramp[Math.round(L * 255) * 3 + 1], ramp[Math.round(L * 255) * 3 + 2]] : [sm[q], sm[q + 1], sm[q + 2]];
      const c00 = toScr(a, b), c10 = toScr(a + 1, b), c11 = toScr(a + 1, b + 1), c01 = toScr(a, b + 1); const up = (p: number[]) => [p[0], p[1] - hh];
      poly([c01, c11, up(c11), up(c01)], base.map((v) => v * (1 - 0.3 * sh)));   // ściana lewa (od strony b + 1)
      poly([c10, c11, up(c11), up(c10)], base.map((v) => v * (1 - 0.6 * sh)));   // ściana prawa (od strony a + 1)
      poly([up(c00), up(c10), up(c11), up(c01)], base);                           // góra
    }
    return out;
  },
};

export const GEO3_EFFECTS: EffectDef[] = [lattice, topography, neongrid, schematic, droste, isoextrude];
