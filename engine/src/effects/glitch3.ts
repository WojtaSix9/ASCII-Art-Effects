// Glitch i sygnał, Faza 3 (plik 02, sekcja 7; proj, Forensics i Beacon: proj?): Pixel Sort, Forensics, Digital Distortion,
// Datamosh, Lofi, Beacon. Datamosh i Beacon są w pliku 02 typu STATE; bez animacji liczone deterministycznie z seeda (proj).
// Losowe położenia w ułamkach obrazu, długości w px × skala, więc eksport @2x ma ten sam układ.
import type { EffectDef, Img } from '../core/types.ts';
import { color, common, range, seedParam, select, toggle } from '../core/params.ts';
import { blur, clamp, hash01, lerp, lum, mulberry32, parseColor, resize } from '../core/util.ts';
import { bil, valueNoise } from '../core/screen.ts';
import { paletteLut } from './signal.ts';

const px1 = () => [...common('brightness', 'contrast')];
const PX = { unit: 'px', px: true } as const;
const copy = (s: Img): Img => ({ w: s.w, h: s.h, data: new Uint8ClampedArray(s.data) });
const hue = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return ((h * 60) + 360) % 360; };

// ---------- Pixel Sort ----------
const pixelsort: EffectDef = {
  id: 'pixelsort', name: 'Pixel Sort', category: 'Glitch & Signal', engine: 'SHADER', phase: 3,
  description: 'Pixels sorted along rows or columns by brightness, within runs chosen by a threshold.',
  params: [range('thresholdLow', 'Threshold low', 25, 0, 100, { unit: '%' }), range('thresholdHigh', 'Threshold high', 95, 0, 100, { unit: '%' }),
    select('direction', 'Direction', 'horizontal', [['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['horizontalRev', 'Horizontal (reversed)'], ['verticalRev', 'Vertical (reversed)']]),
    select('sortBy', 'Sort by', 'luminance', [['luminance', 'Luminance'], ['hue', 'Hue']]), range('maxLength', 'Max length', 0, 0, 400, PX), ...px1()],
  // w każdej linii: ciągi pikseli z jasnością w [low, high] (maxLength > 0 dzieli dłuższe ciągi) sortowane rosnąco wg klucza
  // (odwrócone kierunki: malejąco); piksele poza ciągami bez zmian. Wynik jest permutacją pikseli w obrębie linii.
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const out = copy(s); const d = out.data; const lo = ctx.p.thresholdLow / 100, hi = Math.max(lo, ctx.p.thresholdHigh / 100);
    const vert = ctx.p.direction.startsWith('vertical'), rev = ctx.p.direction.endsWith('Rev'); const n = vert ? h : w, lines = vert ? w : h; const ml = ctx.p.maxLength > 0 ? Math.max(2, Math.round(ctx.p.maxLength * ctx.scale)) : Infinity;
    const byHue = ctx.p.sortBy === 'hue'; const idx = (line: number, k: number) => (vert ? k * w + line : line * w + k) * 4;
    for (let line = 0; line < lines; line++) {
      let k = 0;
      while (k < n) {
        const i0 = idx(line, k); const L0 = lum(d[i0], d[i0 + 1], d[i0 + 2]); if (L0 < lo || L0 > hi) { k++; continue; }
        let e = k; while (e < n && e - k < ml) { const i = idx(line, e); const L = lum(d[i], d[i + 1], d[i + 2]); if (L < lo || L > hi) break; e++; }
        const px: number[][] = []; for (let q = k; q < e; q++) { const i = idx(line, q); px.push([d[i], d[i + 1], d[i + 2], d[i + 3], byHue ? hue(d[i], d[i + 1], d[i + 2]) : lum(d[i], d[i + 1], d[i + 2])]); }
        px.sort((a, b) => (rev ? b[4] - a[4] : a[4] - b[4])); for (let q = k; q < e; q++) { const i = idx(line, q), p = px[q - k]; d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = p[3]; }
        k = e;
      }
    }
    return out;
  },
};

// ---------- Forensics ----------
const MAPS: Record<string, [number, string][]> = { heat: [[0, '#000000'], [0.35, '#7a0a0a'], [0.65, '#ff6a00'], [0.85, '#ffd400'], [1, '#ffffff']], cyan: [[0, '#00060a'], [0.5, '#007f8c'], [1, '#c8fffb']], gray: [[0, '#000000'], [1, '#ffffff']] };
const forensics: EffectDef = {
  id: 'forensics', name: 'Forensics', category: 'Glitch & Signal', engine: 'SHADER', phase: 3,
  description: 'Image-forensics look: noise map, error-level analysis or edges, in a false-colour map.',
  params: [select('mode', 'Mode', 'ela', [['noise', 'Noise'], ['ela', 'Error level (ELA)'], ['edge', 'Edges']]), select('colormap', 'Colour map', 'heat', [['heat', 'Heat'], ['cyan', 'Cyan'], ['gray', 'Grey']]),
    range('gain', 'Gain', 60, 0, 100, { unit: '%' }), toggle('overlayLabels', 'Overlay marks', true), color('overlayColor', 'Overlay colour', '#39ff88', { level: 'advanced' }), ...px1()],
  // noise: |obraz − rozmycie 1 px| ; ELA (przybliżenie): reszta od średniej bloku 8×8 px źródła i jej błąd kwantyzacji krokiem 24 –
  // tekstury dają duży błąd, gładkie plamy mały, jak przy ponownym zapisie JPEG; edge: Sobel. Mapa kolorów; nakładka: siatka 8×8 bloków
  // co 8 bloków, ramki narożne i krzyż w środku (bez tekstu, żeby nie zależeć od czcionek).
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const sc = ctx.scale; const v = new Float32Array(w * h); const g = 1 + (ctx.p.gain / 100) * 15;
    if (ctx.p.mode === 'noise') { const b = blur(s, Math.max(1, Math.round(sc)), 1).data; for (let p = 0, i = 0; p < v.length; p++, i += 4) v[p] = (Math.abs(d[i] - b[i]) + Math.abs(d[i + 1] - b[i + 1]) + Math.abs(d[i + 2] - b[i + 2])) / 765 * g; }
    else if (ctx.p.mode === 'edge') { const L = (x: number, y: number) => { const i = (clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)) * 4; return lum(d[i], d[i + 1], d[i + 2]); }; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) v[y * w + x] = Math.hypot(L(x + 1, y) - L(x - 1, y), L(x, y + 1) - L(x, y - 1)) * sc * g * 0.5; }
    else {
      const B = Math.max(1, Math.round(8 * sc)); const nx = Math.ceil(w / B), ny = Math.ceil(h / B); const mean = new Float32Array(nx * ny * 3), cnt = new Float32Array(nx * ny);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const b = Math.floor(y / B) * nx + Math.floor(x / B), i = (y * w + x) * 4; mean[b * 3] += d[i]; mean[b * 3 + 1] += d[i + 1]; mean[b * 3 + 2] += d[i + 2]; cnt[b]++; }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const b = Math.floor(y / B) * nx + Math.floor(x / B), i = (y * w + x) * 4; let e = 0; for (let c = 0; c < 3; c++) { const r = d[i + c] - mean[b * 3 + c] / cnt[b]; e += Math.abs(r - Math.round(r / 24) * 24); } v[y * w + x] = (e / 36) * g * 0.06; }   /* 0,25 dawało prawie całą biel (oko) */
    }
    const lut = paletteLut(MAPS[ctx.p.colormap]); const out = new Uint8ClampedArray(d.length);
    for (let p = 0, i = 0; p < v.length; p++, i += 4) { const j = Math.round(clamp(v[p], 0, 1) * 255) * 3; out[i] = lut[j]; out[i + 1] = lut[j + 1]; out[i + 2] = lut[j + 2]; out[i + 3] = d[i + 3]; }
    if (ctx.p.overlayLabels) {
      const oc = parseColor(ctx.p.overlayColor); const t = Math.max(1, Math.round(sc)); const G = Math.round(64 * sc); const m = Math.min(w, h), arm = 0.06 * m, pad = 0.04 * m;
      const put = (x: number, y: number, a: number) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) out[i + c] = lerp(out[i + c], oc[c], a); };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x % G) < t || (y % G) < t) put(x, y, 0.25);
      for (const [cx, cy, sx, sy] of [[pad, pad, 1, 1], [w - pad, pad, -1, 1], [pad, h - pad, 1, -1], [w - pad, h - pad, -1, -1]]) for (let k = 0; k < arm; k++) for (let q = 0; q < t; q++) { put(Math.round(cx + sx * k), Math.round(cy + sy * q), 1); put(Math.round(cx + sx * q), Math.round(cy + sy * k), 1); }
      for (let k = -arm / 2; k <= arm / 2; k++) for (let q = 0; q < t; q++) { put(Math.round(w / 2 + k), Math.round(h / 2 + q), 1); put(Math.round(w / 2 + q), Math.round(h / 2 + k), 1); }
    }
    return { w, h, data: out };
  },
};

// ---------- Digital Distortion ----------
const glitch: EffectDef = {
  id: 'glitch', name: 'Digital Distortion', category: 'Glitch & Signal', engine: 'SHADER', phase: 3,
  description: 'A broken signal: shifted horizontal slices, split RGB, displaced blocks and noise lines.',
  params: [range('intensity', 'Intensity', 65, 0, 100, { unit: '%' }), range('sliceMax', 'Max slice', 24, 2, 120, PX), range('rgb', 'RGB shift', 40, 0, 100, { unit: '%' }), range('blockSize', 'Block size', 32, 4, 160, PX), seedParam(), ...px1()],
  // z seeda (w ułamkach obrazu): intensity·30 pasków przesuniętych o do ±15% szerokości z rozdzieleniem R/B (do 16 px × rgb),
  // intensity·20 bloków skopiowanych z przesuniętego miejsca z zamienionymi kanałami, intensity·10 linii szumu (1 px × skala)
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const src = s.data; const out = copy(s); const d = out.data; const k = ctx.p.intensity / 100; if (!k) return out; const rnd = mulberry32(ctx.p.seed * 6151 + 29); const sc = ctx.scale;
    const at = (x: number, y: number, c: number) => src[(clamp(y, 0, h - 1) * w + clamp(Math.round(x), 0, w - 1)) * 4 + c];
    for (let n = Math.round(k * 30), q = 0; q < n; q++) {
      const y0 = Math.floor(rnd() * h), sh = Math.max(1, Math.round((0.1 + rnd() * 0.9) * ctx.p.sliceMax * sc)), dx = (rnd() - 0.5) * 2 * 0.15 * w * k, rs = (ctx.p.rgb / 100) * rnd() * 16 * sc;
      for (let y = y0; y < Math.min(h, y0 + sh); y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; d[i] = at(x - dx + rs, y, 0); d[i + 1] = at(x - dx, y, 1); d[i + 2] = at(x - dx - rs, y, 2); }
    }
    const B = Math.max(2, Math.round(ctx.p.blockSize * sc));
    for (let n = Math.round(k * 20), q = 0; q < n; q++) {
      const bx = Math.floor(rnd() * w), by = Math.floor(rnd() * h), bw = Math.max(2, Math.round(B * (0.5 + rnd() * 1.5))), bh = Math.max(2, Math.round(B * (0.3 + rnd()))), ox = Math.round((rnd() - 0.5) * 4 * B), oy = Math.round((rnd() - 0.5) * B), sw = Math.floor(rnd() * 3);
      for (let y = by; y < Math.min(h, by + bh); y++) for (let x = bx; x < Math.min(w, bx + bw); x++) { const i = (y * w + x) * 4; const c = [at(x + ox, y + oy, 0), at(x + ox, y + oy, 1), at(x + ox, y + oy, 2)]; d[i] = c[sw]; d[i + 1] = c[(sw + 1) % 3]; d[i + 2] = c[(sw + 2) % 3]; }
    }
    for (let n = Math.round(k * 10), q = 0; q < n; q++) { const y0 = Math.floor(rnd() * h), t = Math.max(1, Math.round(sc)); for (let y = y0; y < Math.min(h, y0 + t); y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const v = 255 * hash01(Math.floor(x / sc), q, ctx.p.seed); d[i] = d[i + 1] = d[i + 2] = v; } }
    return out;
  },
};

// ---------- Datamosh ----------
const datamosh: EffectDef = {
  id: 'datamosh', name: 'Datamosh', category: 'Glitch & Signal', engine: 'STATE', phase: 3,
  description: 'Pixels smeared along block motion vectors, like broken video compression.',
  params: [range('blockSize', 'Block size', 16, 4, 64, PX), range('smearAmount', 'Smear', 80, 0, 100, { unit: '%' }), range('keyframeInterval', 'Frames since keyframe', 12, 1, 30), seedParam(), ...px1()],
  // wektor ruchu bloku: kierunek i długość z gładkiego szumu (seed) w ułamkach obrazu, długość do 0,5 bloku × smear;
  // `keyframeInterval` kroków „P-klatek”: każdy blok przyjmuje piksele przesunięte o swój wektor, bez korekty (jak przy zgubionej klatce kluczowej)
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; let cur = new Float32Array(s.data); const k = ctx.p.smearAmount / 100; if (!k) return copy(s);
    const B = Math.max(2, Math.round(ctx.p.blockSize * ctx.scale)); const nx = Math.ceil(w / B), ny = Math.ceil(h / B); const vx = new Float32Array(nx * ny), vy = new Float32Array(nx * ny); const m = Math.min(w, h);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const u = ((i + 0.5) * B) / m * 3, v = ((j + 0.5) * B) / m * 3; const a = valueNoise(u, v, ctx.p.seed) * 4 * Math.PI, len = valueNoise(u + 17, v + 9, ctx.p.seed + 1) * 0.5 * B * k; vx[j * nx + i] = Math.cos(a) * len; vy[j * nx + i] = Math.sin(a) * len; }
    for (let step = 0; step < ctx.p.keyframeInterval; step++) {
      const nxt = new Float32Array(cur.length);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const b = Math.floor(y / B) * nx + Math.floor(x / B); const sx = x + 0.5 - vx[b], sy = y + 0.5 - vy[b]; const i = (y * w + x) * 4; for (let c = 0; c < 4; c++) nxt[i + c] = bil(cur, w, h, sx, sy, c); }
      cur = nxt;
    }
    return { w, h, data: new Uint8ClampedArray(cur) };
  },
};

// ---------- Lofi ----------
const lofi: EffectDef = {
  id: 'lofi', name: 'Lofi', category: 'Glitch & Signal', engine: 'SHADER', phase: 3,
  description: 'A worn-out medium: low resolution, few colours, compression blocks and VHS tape errors.',
  params: [range('resolution', 'Resolution', 35, 5, 100, { unit: '%' }), range('colorBits', 'Colour bits', 4, 1, 8), range('compressionArtifacts', 'Compression', 50, 0, 100, { unit: '%' }),
    range('noise', 'Noise', 30, 0, 100, { unit: '%' }), range('tracking', 'Tracking', 40, 0, 100, { unit: '%' }), seedParam(), ...px1()],
  // 1) zmniejszenie do `resolution` i powiększenie bez wygładzania; 2) kwantyzacja kanałów do 2^bits poziomów; 3) kompresja: chroma
  // uśredniona w blokach 8×8 (piksele po pomniejszeniu), mieszana z oryginałem; 4) taśma: kilka pasów przesuniętych w poziomie (z seeda),
  // rozlany kolor (R przesunięty w prawo o 2 px × skala) i szum
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const f = ctx.p.resolution / 100; const sw = Math.max(1, Math.round(w * f)), sh = Math.max(1, Math.round(h * f)); const small = resize(s, sw, sh); const sd = small.data;
    const ca = ctx.p.compressionArtifacts / 100; if (ca) {
      const B = 8; for (let by = 0; by < sh; by += B) for (let bx = 0; bx < sw; bx += B) {
        let cb = 0, cr = 0, n = 0; for (let y = by; y < Math.min(sh, by + B); y++) for (let x = bx; x < Math.min(sw, bx + B); x++) { const i = (y * sw + x) * 4; cb += sd[i + 2] - lum(sd[i], sd[i + 1], sd[i + 2]) * 255; cr += sd[i] - lum(sd[i], sd[i + 1], sd[i + 2]) * 255; n++; }
        cb /= n; cr /= n; for (let y = by; y < Math.min(sh, by + B); y++) for (let x = bx; x < Math.min(sw, bx + B); x++) { const i = (y * sw + x) * 4; const Y = lum(sd[i], sd[i + 1], sd[i + 2]) * 255; const r = Y + cr, b = Y + cb, g = (Y - 0.2126 * r - 0.0722 * b) / 0.7152; sd[i] = lerp(sd[i], r, ca); sd[i + 1] = lerp(sd[i + 1], g, ca); sd[i + 2] = lerp(sd[i + 2], b, ca); }
      }
    }
    const lv = Math.pow(2, Math.round(ctx.p.colorBits)) - 1; for (let i = 0; i < sd.length; i += 4) for (let c = 0; c < 3; c++) sd[i + c] = Math.round((sd[i + c] / 255) * lv) * (255 / lv);
    const out = new Uint8ClampedArray(s.data.length); const tr = ctx.p.tracking / 100, nz = ctx.p.noise / 100; const rnd = mulberry32(ctx.p.seed * 3001 + 7); const bands: [number, number, number][] = [];
    for (let q = 0; q < Math.round(tr * 6); q++) bands.push([rnd() * h, (0.01 + rnd() * 0.05) * h, (rnd() - 0.5) * 0.08 * w * tr]);
    const bleed = 2 * ctx.scale * tr;
    for (let y = 0; y < h; y++) {
      let shift = 0; for (const [y0, bh, dx] of bands) if (y >= y0 && y < y0 + bh) shift += dx;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4; const sx = (xx: number) => clamp(Math.floor(((xx - shift) / w) * sw), 0, sw - 1); const syy = clamp(Math.floor((y / h) * sh), 0, sh - 1);
        const j = (syy * sw + sx(x)) * 4, jr = (syy * sw + sx(x - bleed)) * 4; const n0 = nz ? (hash01(Math.floor(x / ctx.scale), Math.floor(y / ctx.scale), ctx.p.seed) - 0.5) * 80 * nz : 0;
        out[i] = sd[jr] + n0; out[i + 1] = sd[j + 1] + n0; out[i + 2] = sd[j + 2] + n0; out[i + 3] = s.data[i + 3];
      }
    }
    return { w, h, data: out };
  },
};

// ---------- Beacon ----------
const beacon: EffectDef = {
  id: 'beacon', name: 'Beacon', category: 'Glitch & Signal', engine: 'STATE', phase: 3,
  description: 'A field of light dots crossed by a pulsing signal from a source, like a radar ping.',
  params: [range('centerX', 'Center X', 50, 0, 100, { unit: '%' }), range('centerY', 'Center Y', 50, 0, 100, { unit: '%' }), range('pingSpeed', 'Ping spacing', 30, 5, 100, { unit: '%' }),
    range('ringWidth', 'Ring width', 25, 2, 100, { unit: '%' }), range('dotSize', 'Dot size', 8, 3, 40, PX), select('colors', 'Colours', 'image', [['image', 'From image'], ['cyan', 'Cyan'], ['amber', 'Amber']]), ...px1()],
  // stan w ustalonej chwili (proj): pierścienie co (pingSpeed% krótszego boku / 2) od źródła, profil gaussowski o szerokości ringWidth% odstępu;
  // kropki na siatce co dotSize px: promień i jasność = (0,15 + 0,85·sygnał) × jasność obrazu; kolor z obrazu albo stały
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const cs = Math.max(2, Math.round(ctx.p.dotSize * ctx.scale)); const nx = Math.ceil(w / cs), ny = Math.ceil(h / cs); const sm = blur(s, Math.max(1, Math.round(cs / 2))).data;
    const cx = (ctx.p.centerX / 100) * w, cy = (ctx.p.centerY / 100) * h; const sp = (ctx.p.pingSpeed / 100) * 0.5 * Math.min(w, h); const rw = Math.max(0.5, (ctx.p.ringWidth / 100) * sp * 0.5);
    const fixed = ctx.p.colors === 'cyan' ? [60, 230, 255] : ctx.p.colors === 'amber' ? [255, 176, 40] : null; const out = new Uint8ClampedArray(s.data.length); for (let i = 3; i < out.length; i += 4) out[i] = s.data[i];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const mx = (i + 0.5) * cs, my = (j + 0.5) * cs; const r = Math.hypot(mx - cx, my - cy); const ph = r / sp - Math.floor(r / sp); const dr = Math.min(ph, 1 - ph) * sp; const sig = Math.exp(-((dr / rw) ** 2));
      const q = (clamp(Math.floor(my), 0, h - 1) * w + clamp(Math.floor(mx), 0, w - 1)) * 4; const L = 0.25 + 0.75 * lum(sm[q], sm[q + 1], sm[q + 2]); const k = (0.15 + 0.85 * sig) * L;
      const c = fixed ?? [sm[q], sm[q + 1], sm[q + 2]].map((v) => Math.min(255, v * 1.3 + 20)); const rad = cs * 0.45 * Math.sqrt(k);
      for (let y = Math.max(0, Math.floor(my - cs / 2)); y < Math.min(h, Math.ceil(my + cs / 2)); y++) for (let x = Math.max(0, Math.floor(mx - cs / 2)); x < Math.min(w, Math.ceil(mx + cs / 2)); x++) {
        const a = clamp(0.5 - (Math.hypot(x + 0.5 - mx, y + 0.5 - my) - rad), 0, 1); if (!a) continue; const o = (y * w + x) * 4; for (let ch = 0; ch < 3; ch++) out[o + ch] = c[ch] * a * (0.4 + 0.6 * k / Math.max(L, 1e-3));
      }
    }
    return { w, h, data: out };
  },
};

export const GLITCH3_EFFECTS: EffectDef[] = [pixelsort, forensics, glitch, datamosh, lofi, beacon];
