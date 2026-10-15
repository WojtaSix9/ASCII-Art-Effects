// Światło i kolor, Faza 3 (plik 02, sekcja 8; wszystko proj): Anaglyph 3D, Prism, Dreamdust, Light Wind, Kaleidoscope, Warpbloom.
// Dreamdust jest w pliku 02 typu STATE (zależy od poprzednich klatek); bez animacji w v1 liczony deterministycznie z seeda (proj).
import type { EffectDef, Img } from '../core/types.ts';
import { color, common, range, seedParam, select } from '../core/params.ts';
import { blur, clamp, lerp, lum, mulberry32, parseColor } from '../core/util.ts';
import { bil } from '../core/screen.ts';

const px1 = () => [...common('brightness', 'contrast')];
const PX = { unit: 'px', px: true } as const;
const DEG = Math.PI / 180;
const screenAdd = (d: Uint8ClampedArray, g: ArrayLike<number>, k: number) => { for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) { const v = Math.min(255, g[i + c] * k); d[i + c] = 255 - ((255 - d[i + c]) * (255 - v)) / 255; } };

// ---------- Anaglyph 3D ----------
const anaglyph: EffectDef = {
  id: 'anaglyph', name: 'Anaglyph 3D', category: 'Light & Colour', engine: 'SHADER', phase: 3,
  description: 'Red–cyan 3D: the channels shift apart by a depth taken from brightness.',
  params: [range('separation', 'Separation', 10, 0, 40, PX), select('depthSource', 'Depth', 'luminance', [['luminance', 'Brightness (light = near)'], ['inverted', 'Inverted (dark = near)'], ['vertical', 'Vertical (bottom = near)']]),
    select('colorMode', 'Colour', 'color', [['color', 'Colour'], ['grey', 'Grey']]), ...px1()],
  // głębia d (0–1, wygładzona); widok lewy przesunięty o −sep·d/2, prawy o +sep·d/2; R z lewego, G i B z prawego
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sm = blur(s, Math.max(1, Math.round(3 * ctx.scale))).data; const sep = ctx.p.separation * ctx.scale; const out = new Uint8ClampedArray(s.data.length); const grey = ctx.p.colorMode === 'grey';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const L = lum(sm[i], sm[i + 1], sm[i + 2]); const d = ctx.p.depthSource === 'vertical' ? (y + 0.5) / h : ctx.p.depthSource === 'inverted' ? 1 - L : L; const o = (sep * d) / 2;
      const px = x + 0.5, py = y + 0.5; const ch = (xx: number, c: number) => grey ? lum(bil(s.data, w, h, xx, py, 0), bil(s.data, w, h, xx, py, 1), bil(s.data, w, h, xx, py, 2)) * 255 : bil(s.data, w, h, xx, py, c);
      out[i] = ch(px + o, 0); out[i + 1] = ch(px - o, 1); out[i + 2] = ch(px - o, 2); out[i + 3] = s.data[i + 3];
    }
    return { w, h, data: out };
  },
};

// ---------- Prism ----------
/** 7 barw widma (od czerwieni do fioletu), wagi kanałów; dla każdego kanału suma wag = 1. */
const SPECTRUM = [[1, 0, 0], [1, 0.5, 0], [0.9, 0.9, 0], [0, 1, 0], [0, 0.8, 1], [0, 0.2, 1], [0.6, 0, 1]];
const SPEC_SUM = [0, 1, 2].map((c) => SPECTRUM.reduce((a, s) => a + s[c], 0));
const prism: EffectDef = {
  id: 'prism', name: 'Prism', category: 'Light & Colour', engine: 'SHADER', phase: 3,
  description: 'Light split as by a prism: rainbow fringes and dispersion along edges.',
  params: [range('angle', 'Angle', 0, 0, 360, { unit: '°' }), range('strength', 'Strength', 80, 0, 100, { unit: '%' }), range('spread', 'Spread', 12, 1, 60, PX), ...px1()],
  // próbka k (k = 0…6) z przesunięciem (k/6 − 0,5)·spread wzdłuż kąta, ważona barwą widma; wagi kanału znormalizowane,
  // więc płaski obszar się nie zmienia, a na krawędziach kolory rozchodzą się w tęczę; strength miesza z oryginałem
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const k = ctx.p.strength / 100; const sp = ctx.p.spread * ctx.scale; const ux = Math.cos(ctx.p.angle * DEG), uy = Math.sin(ctx.p.angle * DEG); const out = new Uint8ClampedArray(d.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const acc = [0, 0, 0];
      for (let j = 0; j < 7; j++) { const t = (j / 6 - 0.5) * sp; const sx = x + 0.5 + ux * t, sy = y + 0.5 + uy * t; for (let c = 0; c < 3; c++) if (SPECTRUM[j][c]) acc[c] += bil(d, w, h, sx, sy, c) * SPECTRUM[j][c]; }
      for (let c = 0; c < 3; c++) out[i + c] = lerp(d[i + c], acc[c] / SPEC_SUM[c], k); out[i + 3] = d[i + 3];
    }
    return { w, h, data: out };
  },
};

// ---------- Dreamdust ----------
const dreamdust: EffectDef = {
  id: 'dreamdust', name: 'Dreamdust', category: 'Light & Colour', engine: 'STATE', phase: 3,
  description: 'A dreamy glow with floating dust, bokeh and sparkles.',
  params: [range('particleDensity', 'Particles', 50, 0, 100, { unit: '%' }), range('particleSize', 'Particle size', 6, 1, 30, PX), range('glow', 'Glow', 50, 0, 100, { unit: '%' }),
    range('drift', 'Drift', 30, 0, 100, { unit: '%' }), seedParam(), ...px1()],
  // 1) poświata: rozmyte jasne partie (próg 0,5) dodane trybem screen; 2) pył: N = gęstość·pole/1500 px² (we współrzędnych źródła)
  // cząstek z seeda, kolor obrazu w miejscu cząstki rozjaśniony, miękki krążek bokeh; drift = smuga w górę (symulacja 8 kroków ruchu,
  // coraz słabsza); 3) co szósta cząstka to iskra (krzyż czterech promieni). Wszystko w ułamkach obrazu, więc @2x wygląda tak samo.
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const out = { w, h, data: new Uint8ClampedArray(s.data) }; const d = out.data; const sc = ctx.scale; const g = ctx.p.glow / 100;
    if (g) { const br = new Uint8ClampedArray(d.length); for (let i = 0; i < d.length; i += 4) { const k = clamp((lum(d[i], d[i + 1], d[i + 2]) - 0.5) * 2, 0, 1); br[i] = d[i] * k; br[i + 1] = d[i + 1] * k; br[i + 2] = d[i + 2] * k; br[i + 3] = 255; } screenAdd(d, blur({ w, h, data: br }, Math.max(1, Math.round(12 * sc))).data, g * 1.2); }
    const bw = w / sc, bh = h / sc; const n = Math.round((ctx.p.particleDensity / 100) * (bw * bh) / 1500); const rnd = mulberry32(ctx.p.seed * 4241 + 17); const drift = ctx.p.drift / 100; ctx.info.particles = n;
    for (let k = 0; k < n; k++) {
      const x = rnd() * w, y = rnd() * h, r = (0.3 + rnd() * 0.7) * ctx.p.particleSize * sc * 0.5, a = 0.25 + rnd() * 0.5, sparkle = rnd() < 1 / 6;
      const q = (clamp(Math.floor(y), 0, h - 1) * w + clamp(Math.floor(x), 0, w - 1)) * 4; const c = [0, 1, 2].map((ch) => Math.min(255, s.data[q + ch] * 0.5 + 140));
      const steps = drift ? 8 : 1;
      for (let t = 0; t < steps; t++) {   // smuga dryfu: kolejne położenia w górę, coraz słabsze
        const yy = y - t * drift * r * 1.5, aa = a * (1 - t / steps);
        const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(w - 1, Math.ceil(x + r + 1)), y0 = Math.max(0, Math.floor(yy - r - 1)), y1 = Math.min(h - 1, Math.ceil(yy + r + 1));
        for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) { const dd = Math.hypot(px + 0.5 - x, py + 0.5 - yy) / Math.max(r, 0.5); if (dd >= 1) continue; const k2 = aa * (1 - dd * dd); const i = (py * w + px) * 4; for (let ch = 0; ch < 3; ch++) d[i + ch] = 255 - ((255 - d[i + ch]) * (255 - c[ch] * k2)) / 255; }
      }
      if (sparkle) { const L = r * 3; for (let t = -L; t <= L; t += 0.5) for (const [ox, oy] of [[t, 0], [0, t]]) { const px = Math.floor(x + ox), py = Math.floor(y + oy); if (px < 0 || py < 0 || px >= w || py >= h) continue; const k2 = a * (1 - Math.abs(t) / L) * 0.8; const i = (py * w + px) * 4; for (let ch = 0; ch < 3; ch++) d[i + ch] = 255 - ((255 - d[i + ch]) * (255 - 255 * k2)) / 255; } }
    }
    return out;
  },
};

// ---------- Light Wind ----------
const lightwind: EffectDef = {
  id: 'lightwind', name: 'Light Wind', category: 'Light & Colour', engine: 'SHADER', phase: 3,
  description: 'Directional streaks of light pulled from the bright areas (god rays).',
  params: [range('angle', 'Angle', 90, 0, 360, { unit: '°' }), range('length', 'Length', 120, 0, 400, PX), range('threshold', 'Threshold', 65, 0, 100, { unit: '%' }),
    range('falloff', 'Falloff', 50, 0, 100, { unit: '%' }), color('tint', 'Tint', '#ffe9c4'), ...px1()],
  // maska jasnych partii (gładko od progu), smuga jednostronna w kierunku angle z wagą f^n na n-tym pikselu (f z długości i falloff),
  // liczona przez podwajanie przesunięć (log₂ długości kroków); zabarwiona, dodana trybem screen
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const L = ctx.p.length * ctx.scale; const out = { w, h, data: new Uint8ClampedArray(d) }; if (L < 1) return out;
    const thr = ctx.p.threshold / 100; const tint = parseColor(ctx.p.tint); let m = new Float32Array(w * h * 3);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) { const k = clamp((lum(d[i], d[i + 1], d[i + 2]) - thr) / Math.max(0.02, 1 - thr), 0, 1); for (let c = 0; c < 3; c++) m[p * 3 + c] = k * (d[i + c] * 0.5 + tint[c] * 0.5); }
    const f = Math.pow(0.02, 1 / (L * (0.3 + 0.7 * (1 - ctx.p.falloff / 100)))); const ux = Math.cos(ctx.p.angle * DEG), uy = Math.sin(ctx.p.angle * DEG);
    let norm = 1; for (let step = 1; step < L; step *= 2) {
      const fs = Math.pow(f, step); const n2 = new Float32Array(m); const ox = ux * step, oy = uy * step;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = Math.round(x - ox), sy = Math.round(y - oy); if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue; const a = (y * w + x) * 3, b = (sy * w + sx) * 3; n2[a] += m[b] * fs; n2[a + 1] += m[b + 1] * fs; n2[a + 2] += m[b + 2] * fs; }
      m = n2; norm += norm * fs;
    }
    const od = out.data; const gain = 1.2 / norm;   /* 2,5 prześwietlało jasne niebo do bieli (oko) */ for (let p = 0, i = 0; p < w * h; p++, i += 4) for (let c = 0; c < 3; c++) { const v = Math.min(255, m[p * 3 + c] * gain); od[i + c] = 255 - ((255 - od[i + c]) * (255 - v)) / 255; }
    return out;
  },
};

// ---------- Kaleidoscope ----------
const starburst: EffectDef = {
  id: 'starburst', name: 'Kaleidoscope', category: 'Light & Colour', engine: 'SHADER', phase: 3,
  description: 'Mirrored sectors around a centre.',
  params: [range('segments', 'Segments', 8, 2, 24), range('rotation', 'Rotation', 0, 0, 360, { unit: '°' }), range('centerX', 'Center X', 50, 0, 100, { unit: '%' }), range('centerY', 'Center Y', 50, 0, 100, { unit: '%' }),
    range('zoom', 'Zoom', 100, 50, 300, { unit: '%' }), ...px1()],
  // kąt piksela zawinięty do sektora 2π/segments i odbity w drugiej połowie sektora; promień / zoom; próbka z obrazu wokół środka
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const out = new Uint8ClampedArray(d.length); const n = Math.round(ctx.p.segments); const seg = (2 * Math.PI) / n; const rot = ctx.p.rotation * DEG; const z = ctx.p.zoom / 100;
    const cx = (ctx.p.centerX / 100) * w, cy = (ctx.p.centerY / 100) * h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy; const r = Math.hypot(dx, dy) / z; let a = Math.atan2(dy, dx) - rot; a = ((a % seg) + seg) % seg; if (a > seg / 2) a = seg - a; a += rot;
      const mir = (v: number, n: number) => { const p = 2 * n; v = ((v % p) + p) % p; return v > n ? p - v : v; };   /* poza obrazem odbicie lustrzane, nie powielony brzeg */
      const sx = mir(cx + r * Math.cos(a), w), sy = mir(cy + r * Math.sin(a), h); const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) out[i + c] = bil(d, w, h, sx, sy, c); out[i + 3] = d[i + 3];
    }
    return { w, h, data: out };
  },
};

// ---------- Warpbloom ----------
const warpbloom: EffectDef = {
  id: 'warpbloom', name: 'Warpbloom', category: 'Light & Colour', engine: 'SHADER', phase: 3,
  description: 'A wavy warp combined with a soft glow of the bright areas.',
  params: [range('warpAmount', 'Warp', 40, 0, 100, { unit: '%' }), range('frequency', 'Frequency', 4, 1, 20), range('bloomIntensity', 'Bloom', 60, 0, 100, { unit: '%' }), range('threshold', 'Threshold', 55, 0, 100, { unit: '%' }), ...px1()],
  // przesunięcie x += A·sin(2π·f·y/H), y += A·sin(2π·f·x/W), A = warp·2% krótszego boku (f fal na wysokość/szerokość obrazu);
  // poświata: jasne partie powyżej progu rozmyte (3% krótszego boku) i dodane trybem screen
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const d = s.data; const A = (ctx.p.warpAmount / 100) * 0.02 * Math.min(w, h); const f = ctx.p.frequency; const out = new Uint8ClampedArray(d.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + 0.5, py = y + 0.5; const sx = px + A * Math.sin((2 * Math.PI * f * py) / h), sy = py + A * Math.sin((2 * Math.PI * f * px) / w);
      const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) out[i + c] = A ? bil(d, w, h, sx, sy, c) : d[i + c]; out[i + 3] = d[i + 3];
    }
    const k = ctx.p.bloomIntensity / 100; if (k) {
      const thr = ctx.p.threshold / 100; const br = new Uint8ClampedArray(out.length);
      for (let i = 0; i < out.length; i += 4) { const t = clamp((lum(out[i], out[i + 1], out[i + 2]) - thr) / Math.max(0.02, 1 - thr), 0, 1); br[i] = out[i] * t; br[i + 1] = out[i + 1] * t; br[i + 2] = out[i + 2] * t; br[i + 3] = 255; }
      screenAdd(out, blur({ w, h, data: br }, Math.max(1, Math.round(0.03 * Math.min(w, h)))).data, k * 1.5);
    }
    return { w, h, data: out };
  },
};

export const LIGHT_EFFECTS: EffectDef[] = [anaglyph, prism, dreamdust, lightwind, starburst, warpbloom];
