// Faza 3, partia 11 (plik 02, sekcje 1 i 4): Mixed (proj), Specimen (proj?), Forms (proj?), Flow Field (STATE → deterministyczny, proj).
// Długości w px × skala, losowość z seeda w ułamkach obrazu albo po indeksie komórki, więc eksport @2x ma ten sam układ.
import type { EffectDef, RenderCtx } from '../core/types.ts';
import { color, common, range, seedParam, select, toggle } from '../core/params.ts';
import { blur, cellAverages, clamp, hash01, lerp, lum, mulberry32, over, parseColor } from '../core/util.ts';
import { backdrop, cellVisible } from '../core/compose.ts';
import { valueNoise } from '../core/screen.ts';
import { CHARSETS } from '../data/charsets.ts';
import { CELL, COLOR_PARAMS, GRID_COMMON, charAt, charCell, runGlyphGrid, runGrid } from './grid.ts';
import { seg } from './geo3.ts';

const PX = { unit: 'px', px: true } as const;
const DEG = Math.PI / 180;
const SETS = Object.entries(CHARSETS).map(([k, v]) => [k, v.name] as [string, string]);
const rampOf = (k: string) => { const r = CHARSETS[k]?.ramp ?? CHARSETS.standard.ramp; return r.length >= 2 ? r : r + ' '; };

// ---------- Mixed ----------
// Trzy zestawy znaków wg tonu: ciemne komórki (mało tuszu na ciemnym tle) z `shadowSet`, średnie z `midSet`, jasne z `highlightSet`.
// Znak w wybranym zestawie = ten sam ramp co w Characters (ton → gęstość), więc ogólna jasność się zgadza. `mixRatio` rozmywa granice:
// ton do wyboru zestawu dostaje przesunięcie z hasza komórki ± mixRatio/4.
function mixedChar(p: Record<string, any>, t: number, cx: number, cy: number) {
  const j = (hash01(cx, cy, p.seed * 7 + 5) - 0.5) * (p.mixRatio / 100) * 0.5; const tz = t + j;
  const set = tz < p.split1 / 100 ? p.shadowSet : tz < Math.max(p.split1, p.split2) / 100 ? p.midSet : p.highlightSet; return charAt(rampOf(set), t);
}
const mixed: EffectDef = {
  id: 'mixed', name: 'Mixed', category: 'ASCII & Text', engine: 'GRID', phase: 3, needsGlyphs: true,
  description: 'Several character sets in one image: one for shadows, one for midtones, one for highlights.',
  params: [CELL(10), select('shadowSet', 'Shadows', 'dots', SETS), select('midSet', 'Midtones', 'alpha', SETS), select('highlightSet', 'Highlights', 'blocks', SETS),
    range('split1', 'Shadow / mid split', 35, 0, 100, { unit: '%' }), range('split2', 'Mid / highlight split', 70, 0, 100, { unit: '%' }), range('mixRatio', 'Mix', 20, 0, 100, { unit: '%' }),
    ...COLOR_PARAMS, ...GRID_COMMON(), seedParam()],
  glyphText: (p) => [p.shadowSet, p.midSet, p.highlightSet].map(rampOf).join(''),
  render(ctx) {
    if (!ctx.glyphs) throw new Error('Mixed needs a glyph provider (canvasGlyphs)'); const { fs, cw, ch } = charCell(ctx); const masks = new Map<string, Uint8Array>();
    return runGlyphGrid(ctx, cw, ch, (img, c) => {
      const chr = mixedChar(ctx.p, c.t, c.cx, c.cy); if (chr === ' ') return; let m = masks.get(chr); if (!m) { m = ctx.glyphs!.mask(chr, cw, ch, fs); masks.set(chr, m); } const w = c.x1 - c.x0;
      for (let y = c.y0; y < c.y1; y++) for (let x = c.x0; x < c.x1; x++) { const v = m[(y - c.y0) * cw + (x - c.x0)]; if (v && x - c.x0 < w) over(img.data, (y * img.w + x) * 4, c.r, c.g, c.b, v / 255); }
    });
  },
  text(ctx) {
    const { cw, ch } = charCell(ctx); const a = cellAverages(ctx.prep, cw, ch); const rows: string[] = [];
    for (let y = 0; y < a.ny; y++) { let s = ''; for (let x = 0; x < a.nx; x++) { if (!cellVisible(hash01(x, y, ctx.p.seed), ctx.p.coverage)) { s += ' '; continue; } let t = a.L[y * a.nx + x]; if (ctx.p.invert) t = 1 - t; s += mixedChar(ctx.p, t, x, y); } rows.push(s); }
    return rows.join('\n') + '\n';
  },
};

// ---------- Specimen ----------
// Interpretacja (proj?): plansza próbek pisma. Rzędy tekstu o różnych wysokościach (z seeda, między minSize a maxSize), tekst płynie
// przez kolejne rzędy jak w specimenie; krycie znaku = jasność obrazu pod nim, „waga” = pogrubienie maski (dylatacja) ∝ jasność × weightRange.
// Krój: ten sam co w Characters (jedna czcionka glifów); osobnego wyboru kroju nie ma (BRAK).
const specimen: EffectDef = {
  id: 'specimen', name: 'Specimen', category: 'Geometric', engine: 'GRID', phase: 3, needsGlyphs: true,
  description: 'A type specimen sheet: lines of text in mixed sizes, weight and opacity following the image.',
  params: [{ id: 'textSource', label: 'Text', kind: 'text', default: 'Specimen Aa Bb Cc Dd Ee Ff Gg 0123456789 The quick brown fox jumps over the lazy dog', level: 'main' },
    range('minSize', 'Min size', 10, 4, 80, PX), range('maxSize', 'Max size', 36, 4, 160, PX), range('weightRange', 'Weight range', 60, 0, 100, { unit: '%' }),
    ...COLOR_PARAMS, ...GRID_COMMON().filter((p) => p.id !== 'coverage'), seedParam()],
  glyphText: (p) => String(p.textSource),
  render(ctx) {
    if (!ctx.glyphs) throw new Error('Specimen needs a glyph provider (canvasGlyphs)');
    const p = ctx.p; const out = backdrop(ctx); const s = ctx.prep; const { w, h } = s; const text = [...(String(p.textSource).replace(/\s+/g, ' ').trim() + ' ')]; const ink = parseColor(p.inkColor);
    const lo = Math.min(p.minSize, p.maxSize), hi = Math.max(p.minSize, p.maxSize); const masks = new Map<string, Uint8Array>(); let k = 0, row = 0, glyphs = 0;
    // pozycje w liczbach rzeczywistych (px × skala), zaokrąglane dopiero na granicach: przy @2x ten sam układ rzędów i znaków
    for (let yF = 0; Math.round(yF) < h && text.length > 1; row++) {
      const fF = lerp(lo, hi, Math.pow(hash01(row, 3, p.seed * 13 + 1), 1.6)) * ctx.scale; const fs = Math.max(2, Math.round(fF)); const y0 = Math.round(yF), ch = Math.max(1, Math.round(yF + fF) - y0), y1 = Math.min(h, y0 + ch); const cF = fF * 0.6;
      for (let j = 0; Math.round(j * cF) < w; j++, k++) {
        const chr = text[k % text.length]; if (chr === ' ') continue; const x0 = Math.round(j * cF), cw = Math.max(1, Math.round((j + 1) * cF) - x0), x1 = Math.min(w, x0 + cw);
        let r = 0, g = 0, b = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; r += s.data[i]; g += s.data[i + 1]; b += s.data[i + 2]; n++; }
        r /= n; g /= n; b /= n; let t = lum(r, g, b); if (p.invert) t = 1 - t; if (t <= 0.002) continue;
        const rad = Math.round((p.weightRange / 100) * t * fs * 0.07); const key = `${chr}|${cw}|${ch}|${fs}|${rad}`; let m = masks.get(key);
        if (!m) { const m0 = ctx.glyphs.mask(chr, cw, ch, fs); m = rad ? dilate8(m0, cw, ch, rad) : m0; masks.set(key, m); }
        const c = p.colorMode === 'mono' ? ink : [r, g, b]; glyphs++;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = m[(y - y0) * cw + (x - x0)]; if (v) over(out.data, (y * w + x) * 4, c[0], c[1], c[2], (v / 255) * t); }
      }
      yF += fF;
    }
    ctx.info.rows = row; ctx.info.glyphs = glyphs; return out;
  },
};
function dilate8(m: Uint8Array, w: number, h: number, r: number) {
  const a = new Uint8Array(m.length), b = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w) v = Math.max(v, m[y * w + xx]); } a[y * w + x] = v; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h) v = Math.max(v, a[yy * w + x]); } b[y * w + x] = v; }
  return b;
}

// ---------- Forms ----------
// Interpretacja (proj?): 7 brył (docs: „Forms 7” wariantów) w komórkach siatki, rysowanych jako sylwetka 2D z cieniowaniem.
// Współrzędne (u, v) w promieniach bryły, v w dół; światło z lewej góry. Każda bryła daje odległość od krawędzi (sd, w promieniach)
// i jasność s ∈ [0,15; 1]; kolor = kolor komórki × lerp(1, s, shading). Rozmiar ∝ √ton (scaleByTone) albo stały.
const LIGHT = (() => { const l = [-0.45, -0.55, 0.7]; const n = Math.hypot(...l); return l.map((v) => v / n); })();
const lam = (nx: number, ny: number, nz: number) => { const n = Math.hypot(nx, ny, nz) || 1; return 0.15 + 0.85 * Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / n); };
const sdBox = (u: number, v: number, a: number, b: number) => { const dx = Math.abs(u) - a, dy = Math.abs(v) - b; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); };
const sdEll = (u: number, v: number, a: number, b: number) => (Math.hypot(u / a, v / b) - 1) * Math.min(a, b);
/** Trójkąt wypukły: maksimum odległości od prostych krawędzi (dodatnie na zewnątrz), przybliżenie sd wystarczające do wygładzenia. */
function sdTri(u: number, v: number, P: number[][]) {
  let m = -Infinity; const or = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]) > 0 ? 1 : -1;
  for (let i = 0; i < 3; i++) { const a = P[i], b = P[(i + 1) % 3]; const ex = b[0] - a[0], ey = b[1] - a[1]; m = Math.max(m, (-or * (ex * (v - a[1]) - ey * (u - a[0]))) / Math.hypot(ex, ey)); }
  return m;
}
type Form = (u: number, v: number) => [number, number];
const FORMS: Record<string, Form> = {
  sphere: (u, v) => { const d = Math.hypot(u, v); return [d - 1, lam(u, v, Math.sqrt(Math.max(0, 1 - d * d)))]; },
  cube: (u, v) => { const sd = Math.max(Math.abs(u), Math.abs(0.5 * u + 0.866 * v), Math.abs(0.5 * u - 0.866 * v)) - 0.866; const s = v < -0.577 * Math.abs(u) ? 1 : u < 0 ? 0.72 : 0.45; return [sd, s]; },
  cylinder: (u, v) => {
    const top = sdEll(u, v + 0.62, 0.72, 0.24), body = Math.min(sdBox(u, v - 0.06, 0.72, 0.68), sdEll(u, v - 0.74, 0.72, 0.24)); const k = clamp(u / 0.72, -1, 1);
    return [Math.min(top, body), top <= 0 ? 0.95 : lam(k, 0, Math.sqrt(1 - k * k))];
  },
  cone: (u, v) => {
    const tri = sdTri(u, v, [[0, -1], [-0.82, 0.7], [0.82, 0.7]]), base = sdEll(u, v - 0.7, 0.82, 0.22); const hw = Math.max(0.05, 0.82 * (v + 1) / 1.7); const k = clamp(u / hw, -1, 1);
    return [Math.min(tri, base), lam(k * 0.9, -0.45, Math.sqrt(1 - k * k))];
  },
  pyramid: (u, v) => { const L = [-0.95, 0.62], F = [0.2, 0.9], R = [0.92, 0.5], T = [0, -1]; const a = sdTri(u, v, [T, L, F]), b = sdTri(u, v, [T, F, R]); return [Math.min(a, b), a <= b ? 0.9 : 0.5]; },
  torus: (u, v) => { const d = Math.hypot(u, v) || 1e-9; const q = clamp((d - 0.64) / 0.34, -1, 1); return [Math.abs(d - 0.64) - 0.34, lam((u / d) * q, (v / d) * q, Math.sqrt(1 - q * q))]; },
  octahedron: (u, v) => [(Math.abs(u) + Math.abs(v) * 0.75 - 0.75) / 1.25, v < 0 ? (u < 0 ? 1 : 0.7) : u < 0 ? 0.6 : 0.35],
};
const forms: EffectDef = {
  id: 'forms', name: 'Forms', category: 'Geometric', engine: 'GEOM', phase: 3,
  description: 'Each cell becomes a small shaded solid: sphere, cube, cylinder, cone, pyramid, torus or octahedron.',
  params: [select('formType', 'Form', 'sphere', [['sphere', 'Sphere'], ['cube', 'Cube'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['pyramid', 'Pyramid'], ['torus', 'Torus'], ['octahedron', 'Octahedron']]),
    CELL(16), range('size', 'Size', 95, 10, 100, { unit: '%' }), toggle('scaleByTone', 'Size by tone', true), range('rotation', 'Rotation', 0, -180, 180, { unit: '°' }),
    range('shading', 'Shading', 80, 0, 100, { unit: '%' }), ...COLOR_PARAMS, ...GRID_COMMON().map((p) => (p.id === 'bgMode' ? { ...p, default: 'solid' } : p)), seedParam()],
  render(ctx) {
    const p = ctx.p; const cs = ctx.px(p.cellSize); const f = FORMS[p.formType] ?? FORMS.sphere; const sh = p.shading / 100; const rot = p.rotation * DEG, co = Math.cos(rot), si = Math.sin(rot);
    return runGrid(ctx, cs, cs, (img, c) => {
      const mx = (c.x0 + c.x1) / 2, my = (c.y0 + c.y1) / 2; const R = (cs / 2) * (p.size / 100) * (p.scaleByTone ? Math.sqrt(c.t) : 1); if (R < 0.3) return;
      const x0 = Math.max(c.x0, Math.floor(mx - R - 1)), x1 = Math.min(c.x1, Math.ceil(mx + R + 1)), y0 = Math.max(c.y0, Math.floor(my - R - 1)), y1 = Math.min(c.y1, Math.ceil(my + R + 1));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const dx = (x + 0.5 - mx) / R, dy = (y + 0.5 - my) / R; const u = dx * co + dy * si, v = -dx * si + dy * co; const [sd, s] = f(u, v); const a = clamp(0.5 - sd * R, 0, 1); if (!a) continue;
        const k = lerp(1, s, sh); over(img.data, (y * img.w + x) * 4, c.r * k, c.g * k, c.b * k, a);
      }
    });
  },
};

// ---------- Flow Field ----------
// STATE → jedna klatka (proj): `lineCount` linii z punktów startowych z seeda (ułamki obrazu), każda `length` kroków po `step` px.
// Kierunek = styczna do izolinii jasności (gradient obrócony o 90°, wygładzony), zmieszany z polem szumu (noiseScale = udział szumu;
// szum w ułamkach szerokości). Kolor linii z obrazu w punkcie startu, grubość × (0,4 + 0,6 · jasność).
function flowDir(ctx: RenderCtx, L: Float32Array, w: number, h: number, x: number, y: number, mixN: number, d: number) {
  const at = (xx: number, yy: number) => L[clamp(Math.round(yy), 0, h - 1) * w + clamp(Math.round(xx), 0, w - 1)];
  const gx = at(x + d, y) - at(x - d, y), gy = at(x, y + d) - at(x, y - d); const gm = Math.hypot(gx, gy);
  const na = valueNoise((x / w) * 5, (y / w) * 5, ctx.p.seed * 31 + 7) * Math.PI * 4; let tx = -gy, ty = gx;
  const wN = gm < 1e-4 ? 1 : mixN; if (gm >= 1e-4) { tx /= gm; ty /= gm; } else { tx = 0; ty = 0; }
  const vx = tx * (1 - wN) + Math.cos(na) * wN, vy = ty * (1 - wN) + Math.sin(na) * wN; const vm = Math.hypot(vx, vy) || 1; return [vx / vm, vy / vm];
}
const flowfield: EffectDef = {
  id: 'flowfield', name: 'Flow Field', category: 'Geometric', engine: 'STATE', phase: 3,
  description: 'Lines flowing along the contours of the image, coloured from it (a single still frame).',
  params: [range('lineCount', 'Lines', 1500, 50, 6000), range('length', 'Length', 30, 2, 200), range('step', 'Step', 2, 0.5, 10, { ...PX, step: 0.5 }), range('noiseScale', 'Noise', 25, 0, 100, { unit: '%' }),
    range('thickness', 'Thickness', 1.2, 0.3, 8, { ...PX, step: 0.1 }), ...COLOR_PARAMS, color('bgColor', 'Background', '#0a0a0a'), ...common('brightness', 'contrast'), seedParam()],
  render(ctx) {
    const p = ctx.p; const s = ctx.prep; const { w, h } = s; const sm = blur(s, Math.max(1, Math.round(4 * ctx.scale))); const L = new Float32Array(w * h); for (let q = 0, i = 0; q < L.length; q++, i += 4) L[q] = lum(sm.data[i], sm.data[i + 1], sm.data[i + 2]);
    const bg = parseColor(p.bgColor); const out = { w, h, data: new Uint8ClampedArray(s.data.length) }; for (let i = 0; i < out.data.length; i += 4) { out.data[i] = bg[0]; out.data[i + 1] = bg[1]; out.data[i + 2] = bg[2]; out.data[i + 3] = s.data[i + 3]; }
    const rnd = mulberry32(p.seed * 977 + 13); const st = p.step * ctx.scale, th = p.thickness * ctx.scale, mixN = p.noiseScale / 100, d = Math.max(1, 1.5 * ctx.scale); const ink = parseColor(p.inkColor);
    for (let n = 0; n < p.lineCount; n++) {
      let x = rnd() * w, y = rnd() * h; const i = (clamp(Math.floor(y), 0, h - 1) * w + clamp(Math.floor(x), 0, w - 1)) * 4; const Ls = L[i / 4];
      const c = p.colorMode === 'mono' ? ink : [sm.data[i], sm.data[i + 1], sm.data[i + 2]]; const t = th * (0.4 + 0.6 * Ls);
      for (let k = 0; k < p.length; k++) { const [vx, vy] = flowDir(ctx, L, w, h, x, y, mixN, d); const nx = x + vx * st, ny = y + vy * st; seg(out, x, y, nx, ny, t, c); x = nx; y = ny; if (x < -st || y < -st || x > w + st || y > h + st) break; }
    }
    ctx.info.lines = p.lineCount; return out;
  },
};

export const GEO4_EFFECTS: EffectDef[] = [mixed, specimen, forms, flowfield];
