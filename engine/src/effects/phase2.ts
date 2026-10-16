// Reszta Fazy 2 (plik 02): LED Matrix (docs: kontrolki), Low Poly, Truchet, Smudge (proj). Wzory i zakresy: proj.
// Punkty i losowość we współrzędnych źródła albo w ułamkach obrazu, więc eksport @2x ma ten sam układ.
import type { EffectDef, Img } from '../core/types.ts';
import { color, common, motionCommon, range, seedParam, select } from '../core/params.ts';
import { blur, cellAverages, clamp, hash01, lerp, lum, mulberry32, parseColor, resize } from '../core/util.ts';
import { valueNoise } from '../core/screen.ts';

const px1 = () => [...common('brightness', 'contrast')];
const PX = { unit: 'px', px: true } as const;
const solid = (w: number, h: number, c: number[], src: Img): Img => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < d.length; i += 4) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = src.data[i + 3]; } return { w, h, data: d }; };

// ---------- LED Matrix ----------
const ledmatrix: EffectDef = {
  id: 'ledmatrix', name: 'LED Matrix', category: 'Pixels & Blocks', engine: 'GRID', phase: 2,
  description: 'A panel of glowing LEDs: black board, bright areas bleed light.',
  params: [select('ledType', 'LED type', 'round', [['round', 'Round dot'], ['square', 'Square SMD'], ['stripe', 'RGB stripe'], ['bulb', 'Marquee bulb']]), range('scale', 'Scale', 10, 4, 40, PX),
    range('glow', 'Glow', 50, 0, 100, { unit: '%' }), range('ledBrightness', 'Brightness', 100, 20, 200, { unit: '%' }), select('colorMode', 'Colour', 'perLed', [['perLed', 'Per LED'], ['solid', 'Solid']]),
    color('ledColor', 'LED colour', '#ffb000'), ...px1()],
  // etap 2 (plik 09, Tier B; proj; u = część ułamkowa speed·φ): pulse = jasność diod × (1 − intensity·(1 − cos 2πu)/2) (poświata idzie za nią);
  // sweep = ukośny pas światła (szerokość 0,15 przekątnej, smoothstep) przechodzi przez panel raz na cykl, rozjaśnia diody do × (1 + 1,5·intensity);
  // przy u = 0 pas jest przed panelem, więc φ = 0 daje obraz statyczny
  motions: [{ id: 'pulse', name: 'Pulse', params: motionCommon(60) }, { id: 'sweep', name: 'Sweep', params: motionCommon(60) }],
  // komórka = średni kolor obszaru; per LED: ten kolor × jasność; solid: ledColor × jasność komórki. Wyłączona dioda jest lekko widoczna
  // (6% szarości). Kształty: koło r = 0,38 rozstawu, kwadrat SMD 0,7 z zaokrągleniem, 3 paski R/G/B po 0,22, żarówka r = 0,42 z jaśniejszym środkiem.
  // Poświata: rozmycie warstwy diod (promień 1,5 rozstawu × glow), dodane trybem screen.
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const P = Math.max(2, ctx.p.scale * ctx.scale); const cs = Math.round(P); const a = cellAverages(s, cs, cs); ctx.info.cols = a.nx; ctx.info.rows = a.ny;
    const out = solid(w, h, [0, 0, 0], s); const d = out.data; const m = ctx.motion; const u = m ? m.p.speed * m.phase - Math.floor(m.p.speed * m.phase) : 0;
    const kb = (ctx.p.ledBrightness / 100) * (m?.id === 'pulse' ? 1 - ((m.p.intensity / 100) * (1 - Math.cos(2 * Math.PI * u))) / 2 : 1); const band = m?.id === 'sweep' && u ? -0.15 + 1.3 * u : null; const lc = parseColor(ctx.p.ledColor); const type = ctx.p.ledType; const off = 15;
    for (let cy = 0; cy < a.ny; cy++) for (let cx = 0; cx < a.nx; cx++) {
      const o = cy * a.nx + cx; const L = a.L[o]; const col = ctx.p.colorMode === 'solid' ? lc.map((v) => v * L) : [a.R[o], a.G[o], a.B[o]]; let kc = kb; if (band !== null) { let q = 1 - Math.abs(((cx + 0.5) * cs + (cy + 0.5) * cs) / (w + h) - band) / 0.15; if (q > 0) { q = q * q * (3 - 2 * q); kc *= 1 + 1.5 * (m!.p.intensity / 100) * q; } } const c = col.map((v) => clamp(v * kc, 0, 255));
      const mx = (cx + 0.5) * cs, my = (cy + 0.5) * cs; const x0 = cx * cs, y0 = cy * cs, x1 = Math.min(w, x0 + cs), y1 = Math.min(h, y0 + cs);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const dx = x + 0.5 - mx, dy = y + 0.5 - my; const i = (y * w + x) * 4; let cov = 0, rgb = c;
        if (type === 'round') cov = clamp(0.5 - (Math.hypot(dx, dy) - 0.38 * cs), 0, 1);
        else if (type === 'square') { const q = 0.35 * cs, rr = 0.12 * cs; cov = clamp(0.5 - (Math.hypot(Math.max(Math.abs(dx) - q + rr, 0), Math.max(Math.abs(dy) - q + rr, 0)) - rr), 0, 1); }
        else if (type === 'bulb') { const r = Math.hypot(dx, dy); cov = clamp(0.5 - (r - 0.42 * cs), 0, 1); const hot = 1 + 0.6 * clamp(1 - r / (0.42 * cs), 0, 1) ** 2; rgb = c.map((v) => Math.min(255, v * hot)); }
        else { const k = clamp(Math.floor(((dx / cs) + 0.5) * 3), 0, 2); const bx = (k - 1) * cs / 3; cov = clamp(0.5 - (Math.max(Math.abs(dx - bx) - 0.11 * cs, Math.abs(dy) - 0.4 * cs)), 0, 1); rgb = [0, 0, 0]; rgb[k] = c[k]; }
        if (cov) for (let q = 0; q < 3; q++) d[i + q] = lerp(0, Math.max(rgb[q], off), cov);
      }
    }
    const g = ctx.p.glow / 100; if (!g) return out;
    const gl = blur(out, Math.max(1, Math.round(1.5 * P * g))).data;
    for (let i = 0; i < d.length; i += 4) for (let q = 0; q < 3; q++) { const v = Math.min(255, gl[i + q] * 1.6 * g); d[i + q] = 255 - ((255 - d[i + q]) * (255 - v)) / 255; }
    return out;
  },
};

// ---------- Low Poly ----------
/** Triangulacja Delaunaya (Bowyer–Watson) punktów w [0,1]²; zwraca trójki indeksów. */
export function delaunay(pts: Float64Array): Int32Array {
  const n = pts.length / 2; const X = (i: number) => pts[2 * i], Y = (i: number) => pts[2 * i + 1];
  const P = new Float64Array(2 * (n + 3)); P.set(pts); P.set([-10, -10, 10, -10, 0, 10], 2 * n);   // super-trójkąt
  let tris: number[] = [n, n + 1, n + 2]; let circ: number[] = [];
  const cc = (a: number, b: number, c: number) => { const ax = P[2 * a], ay = P[2 * a + 1], bx = P[2 * b], by = P[2 * b + 1], cx = P[2 * c], cy = P[2 * c + 1];
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) || 1e-12; const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D; return [ux, uy, (ax - ux) ** 2 + (ay - uy) ** 2]; };
  circ.push(...cc(n, n + 1, n + 2));
  for (let i = 0; i < n; i++) {
    const px = X(i), py = Y(i); const edges = new Map<string, [number, number]>(); const keepT: number[] = [], keepC: number[] = [];
    for (let t = 0; t < tris.length; t += 3) {
      const k = t; const dx = px - circ[k], dy = py - circ[k + 1];
      if (dx * dx + dy * dy < circ[k + 2]) {
        for (const [a, b] of [[tris[t], tris[t + 1]], [tris[t + 1], tris[t + 2]], [tris[t + 2], tris[t]]]) { const key = a < b ? `${a},${b}` : `${b},${a}`; if (edges.has(key)) edges.delete(key); else edges.set(key, [a, b]); }
      } else { keepT.push(tris[t], tris[t + 1], tris[t + 2]); keepC.push(circ[k], circ[k + 1], circ[k + 2]); }
    }
    for (const [a, b] of edges.values()) { keepT.push(a, b, i); keepC.push(...cc(a, b, i)); }
    tris = keepT; circ = keepC;
  }
  const out: number[] = []; for (let t = 0; t < tris.length; t += 3) if (tris[t] < n && tris[t + 1] < n && tris[t + 2] < n) out.push(tris[t], tris[t + 1], tris[t + 2]);
  return Int32Array.from(out);
}
const lowpoly: EffectDef = {
  id: 'lowpoly', name: 'Low Poly', category: 'Geometric', engine: 'GEOM', phase: 2,
  description: 'Delaunay triangulation of scattered points; each triangle filled with its average colour.',
  params: [range('pointCount', 'Points', 600, 50, 4000), select('distribution', 'Distribution', 'edges', [['random', 'Random'], ['edges', 'Along edges']]), range('outline', 'Outline', 0, 0, 4, { ...PX, step: 0.5 }),
    color('outlineColor', 'Outline colour', '#000000', { level: 'advanced' }), range('jitter', 'Jitter', 50, 0, 100, { unit: '%' }), seedParam(), ...px1()],
  // Punkty w ułamkach obrazu: narożniki i punkty na brzegach, reszta losowo (random) albo 70% z prawdopodobieństwem ∝ krawędziom
  // (Sobel na obrazie w skali 1). Jitter: random rozkłada punkty na siatce z przesunięciem (0 = równa siatka, 100 = pełny los).
  // Kolor trójkąta = średnia pikseli obrazu, których środki leżą w trójkącie.
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const n = Math.round(ctx.p.pointCount); const rnd = mulberry32(ctx.p.seed * 7907 + 5); const jit = ctx.p.jitter / 100; const pts: number[] = [0, 0, 1, 0, 0, 1, 1, 1];
    const side = Math.max(2, Math.round(Math.sqrt(n) / 2)); for (let k = 1; k < side; k++) { const t = k / side; pts.push(t, 0, t, 1, 0, t, 1, t); }
    let edgeP: { cdf: Float64Array; bw: number; bh: number } | null = null;
    if (ctx.p.distribution === 'edges') {
      const b = ctx.scale === 1 ? s : resize(s, Math.round(w / ctx.scale), Math.round(h / ctx.scale)); const bw = b.w, bh = b.h; const L = new Float32Array(bw * bh); for (let p = 0, i = 0; p < L.length; p++, i += 4) L[p] = lum(b.data[i], b.data[i + 1], b.data[i + 2]);
      const cdf = new Float64Array(bw * bh); let acc = 0; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const at = (xx: number, yy: number) => L[clamp(yy, 0, bh - 1) * bw + clamp(xx, 0, bw - 1)]; acc += Math.hypot(at(x + 1, y) - at(x - 1, y), at(x, y + 1) - at(x, y - 1)) + 1e-4; cdf[y * bw + x] = acc; }
      edgeP = { cdf, bw, bh };
    }
    const m = Math.max(0, n - pts.length / 2); const gs = Math.ceil(Math.sqrt(m)); let k = 0;
    for (let q = 0; q < m; q++) {
      if (edgeP && rnd() < 0.7) { const target = rnd() * edgeP.cdf[edgeP.cdf.length - 1]; let lo = 0, hi = edgeP.cdf.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (edgeP.cdf[mid] < target) lo = mid + 1; else hi = mid; } pts.push(((lo % edgeP.bw) + rnd()) / edgeP.bw, (Math.floor(lo / edgeP.bw) + rnd()) / edgeP.bh); continue; }
      const gx = k % gs, gy = Math.floor(k / gs); k++; pts.push(clamp((gx + 0.5 + (rnd() - 0.5) * jit) / gs, 0.001, 0.999), clamp((gy + 0.5 + (rnd() - 0.5) * jit) / gs, 0.001, 0.999));
    }
    const P = Float64Array.from(pts); const T = delaunay(P); ctx.info.triangles = T.length / 3;
    const out = solid(w, h, [0, 0, 0], s); const d = s.data, o = out.data; const idx = new Int32Array(w * h).fill(-1);
    const sum = new Float64Array((T.length / 3) * 4);
    for (let t = 0; t < T.length; t += 3) {   // rasteryzacja: piksel należy do trójkąta, gdy jego środek leży wewnątrz (krawędź górna/lewa włącznie)
      const ax = P[2 * T[t]] * w, ay = P[2 * T[t] + 1] * h, bx = P[2 * T[t + 1]] * w, by = P[2 * T[t + 1] + 1] * h, cx = P[2 * T[t + 2]] * w, cy = P[2 * T[t + 2] + 1] * h;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (!area) continue; const sg = area > 0 ? 1 : -1;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx))), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5; const e0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) * sg, e1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) * sg, e2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) * sg;
        if (e0 >= 0 && e1 >= 0 && e2 >= 0 && idx[y * w + x] < 0) { idx[y * w + x] = t / 3; const i = (y * w + x) * 4; sum[(t / 3) * 4] += d[i]; sum[(t / 3) * 4 + 1] += d[i + 1]; sum[(t / 3) * 4 + 2] += d[i + 2]; sum[(t / 3) * 4 + 3]++; }
      }
    }
    for (let p = 0; p < w * h; p++) { const t = idx[p]; if (t < 0) continue; const c = sum[t * 4 + 3] || 1; o[p * 4] = sum[t * 4] / c; o[p * 4 + 1] = sum[t * 4 + 1] / c; o[p * 4 + 2] = sum[t * 4 + 2] / c; }
    const lw = ctx.p.outline * ctx.scale; if (lw > 0) {   // obrys: piksele, w których sąsiedztwie (promień lw/2) jest inny trójkąt
      const oc = parseColor(ctx.p.outlineColor); const r = Math.max(1, Math.round(lw / 2));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = idx[y * w + x]; let edge = false; for (let dy = -r; dy <= r && !edge; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && idx[yy * w + xx] !== t) { edge = true; break; } } if (edge) { const i = (y * w + x) * 4; o[i] = oc[0]; o[i + 1] = oc[1]; o[i + 2] = oc[2]; } }
    }
    return out;
  },
};

// ---------- Truchet ----------
const truchet: EffectDef = {
  id: 'truchet', name: 'Truchet', category: 'Geometric', engine: 'GEOM', phase: 2,
  description: 'Truchet tiles: a randomly turned arc, line or triangle in each cell, thicker where the image is darker.',
  params: [range('tileSize', 'Tile size', 16, 4, 80, PX), select('tileSet', 'Tile set', 'arcs', [['arcs', 'Arcs'], ['diagonals', 'Diagonals'], ['triangles', 'Triangles']]), range('thickness', 'Thickness', 70, 5, 100, { unit: '%' }),
    select('colors', 'Colours', 'image', [['image', 'From image'], ['mono', 'Two colours']]), color('fgColor', 'Line colour', '#f2efe6'), color('bgColor', 'Background', '#101010'), seedParam(), ...px1()],
  // obrót kafelka: hasz komórki (seed); grubość linii = (0,06 + 0,44·thickness·ciemność) boku; trójkąty: wypełniona połowa komórki z kryciem = ciemność.
  // „Ciemność” w trybie z obrazu liczona jako 1 − jasność, a kolor linii to kolor obrazu podbity do pełnej jasności.
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const cs = Math.max(2, Math.round(ctx.p.tileSize * ctx.scale)); const a = cellAverages(s, cs, cs); const bg = parseColor(ctx.p.bgColor), fg0 = parseColor(ctx.p.fgColor);
    const out = solid(w, h, bg, s); const d = out.data; const set = ctx.p.tileSet; const th = ctx.p.thickness / 100;
    for (let cy = 0; cy < a.ny; cy++) for (let cx = 0; cx < a.nx; cx++) {
      const o = cy * a.nx + cx; const D = 1 - a.L[o]; const flip = hash01(cx, cy, ctx.p.seed) < 0.5; const mxc = Math.max(a.R[o], a.G[o], a.B[o], 1);
      const fg = ctx.p.colors === 'image' ? [a.R[o], a.G[o], a.B[o]].map((v) => (v / mxc) * 255) : fg0; const lw = (0.06 + 0.44 * th * D) * cs; const x0 = cx * cs, y0 = cy * cs;
      for (let y = y0; y < Math.min(h, y0 + cs); y++) for (let x = x0; x < Math.min(w, x0 + cs); x++) {
        let u = (x + 0.5 - x0) / cs, v = (y + 0.5 - y0) / cs; if (flip) u = 1 - u; let cov: number;
        if (set === 'arcs') { const d1 = Math.abs(Math.hypot(u, v) - 0.5), d2 = Math.abs(Math.hypot(1 - u, 1 - v) - 0.5); cov = clamp(0.5 - (Math.min(d1, d2) * cs - lw / 2), 0, 1); }
        else if (set === 'diagonals') { const dd = Math.abs(u - v) / Math.SQRT2; cov = clamp(0.5 - (dd * cs - lw / 2), 0, 1); }
        else { const sd = (u + v - 1) / Math.SQRT2; cov = clamp(0.5 - sd * cs, 0, 1) * clamp(D * 1.2, 0, 1); }
        if (cov) { const i = (y * w + x) * 4; for (let q = 0; q < 3; q++) d[i + q] = lerp(d[i + q], fg[q], cov); }
      }
    }
    return out;
  },
};

// ---------- Smudge ----------
const smudge: EffectDef = {
  id: 'smudge', name: 'Smudge', category: 'Distort', engine: 'SHADER', phase: 2,
  description: 'Pixels dragged in one direction, like a finger through wet paint.',
  params: [range('strength', 'Strength', 70, 0, 100, { unit: '%' }), range('angle', 'Angle', 0, 0, 360, { unit: '°' }), range('length', 'Length', 70, 0, 200, PX), range('noise', 'Noise', 50, 0, 100, { unit: '%' }), seedParam(), ...px1()],
  // ślad tylko „za” pikselem (w kierunku przeciwnym do angle), wagi malejące wykładniczo; długość śladu zmienia się płynnie wg szumu
  // (ziarno ok. 1/8 krótszego boku, w ułamkach obrazu); wynik = lerp(obraz, ślad, strength). 16 próbek dwuliniowych.
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const k = ctx.p.strength / 100; const L0 = ctx.p.length * ctx.scale; const out = new Uint8ClampedArray(d.length);
    if (!k || L0 < 0.5) { out.set(d); return { w, h, data: out }; }
    const a = (ctx.p.angle * Math.PI) / 180; const ux = -Math.cos(a), uy = -Math.sin(a); const nz = ctx.p.noise / 100; const m = Math.min(w, h); const N = 16;
    const wts = Array.from({ length: N }, (_, j) => Math.exp((-3 * j) / (N - 1))); const ws = wts.reduce((p, q) => p + q, 0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const L = L0 * (1 - nz * valueNoise(((x + 0.5) / m) * 8, ((y + 0.5) / m) * 8, ctx.p.seed)); const i = (y * w + x) * 4; let r = 0, g = 0, b = 0;
      for (let j = 0; j < N; j++) {
        const t = (j / (N - 1)) * L; let sx = x + ux * t, sy = y + uy * t; sx = clamp(sx, 0, w - 1); sy = clamp(sy, 0, h - 1); const x0 = sx | 0, y0 = sy | 0, tx = sx - x0, ty = sy - y0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
        const i00 = (y0 * w + x0) * 4, i01 = (y0 * w + x1) * 4, i10 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4; const ww = wts[j];
        r += ww * ((d[i00] * (1 - tx) + d[i01] * tx) * (1 - ty) + (d[i10] * (1 - tx) + d[i11] * tx) * ty); g += ww * ((d[i00 + 1] * (1 - tx) + d[i01 + 1] * tx) * (1 - ty) + (d[i10 + 1] * (1 - tx) + d[i11 + 1] * tx) * ty); b += ww * ((d[i00 + 2] * (1 - tx) + d[i01 + 2] * tx) * (1 - ty) + (d[i10 + 2] * (1 - tx) + d[i11 + 2] * tx) * ty);
      }
      out[i] = lerp(d[i], r / ws, k); out[i + 1] = lerp(d[i + 1], g / ws, k); out[i + 2] = lerp(d[i + 2], b / ws, k); out[i + 3] = d[i + 3];
    }
    return { w, h, data: out };
  },
};

export const PHASE2_EFFECTS: EffectDef[] = [ledmatrix, lowpoly, truchet, smudge];
