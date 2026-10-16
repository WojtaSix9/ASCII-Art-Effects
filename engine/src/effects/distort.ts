// Zniekształcenia (plik 02, sekcja 5): Pinch, Spherize, Twirl, ZigZag, Ripple, Polar, Shear. Opcje i zakresy: docs (plik 02);
// wzory: proj (oryginał ich nie opisuje). Wspólna zasada: odwzorowanie odwrotne (dla każdego piksela wyniku liczymy punkt źródła)
// i próbkowanie dwuliniowe z `prep`; poza obrazem brzeg jest powielany (Shear zawija w poziomie).
// ZigZag i Ripple: nazwy po zachowaniu (plik 02: w oryginale klucze są zamienione).
import type { EffectDef, Img, RenderCtx } from '../core/types.ts';
import { common, motionCommon, range, select } from '../core/params.ts';
import { clamp } from '../core/util.ts';

const px1 = () => [...common('brightness', 'contrast')];
const CENTER = () => [range('centerX', 'Center X', 50, 0, 100, { unit: '%', level: 'advanced' }), range('centerY', 'Center Y', 50, 0, 100, { unit: '%', level: 'advanced' })];
/** Promień w % połowy krótszego boku (proj), więc skaluje się z obrazem. */
const RADIUS = (def = 100, min = 10, max = 150) => range('radius', 'Radius', def, min, max, { unit: '%' });

/** Odwzorowanie odwrotne: map(x, y, out) wpisuje do out punkt źródła dla środka piksela (x+0,5, y+0,5); false = bez zmiany. */
function warp(ctx: RenderCtx, map: (x: number, y: number, o: Float64Array) => boolean, wrapX = false): Img {
  const s = ctx.prep; const { w, h } = s; const d = s.data; const out = new Uint8ClampedArray(d.length); const o = new Float64Array(2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (!map(x + 0.5, y + 0.5, o)) { out[i] = d[i]; out[i + 1] = d[i + 1]; out[i + 2] = d[i + 2]; out[i + 3] = d[i + 3]; continue; }
    let sx = o[0] - 0.5, sy = clamp(o[1] - 0.5, 0, h - 1);
    if (wrapX) sx = ((sx % w) + w) % w; else sx = clamp(sx, 0, w - 1);
    const x0 = Math.floor(sx), y0 = Math.floor(sy), tx = sx - x0, ty = sy - y0;
    const x1 = wrapX ? (x0 + 1) % w : Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, e = (y1 * w + x1) * 4;
    for (let k = 0; k < 4; k++) { const top = d[a + k] + (d[b + k] - d[a + k]) * tx, bot = d[c + k] + (d[e + k] - d[c + k]) * tx; out[i + k] = top + (bot - top) * ty; }
  }
  return { w, h, data: out };
}
/** Środek i promień w px renderu. */
const geom = (ctx: RenderCtx) => { const { w, h } = ctx.prep; return { cx: (ctx.p.centerX / 100) * w, cy: (ctx.p.centerY / 100) * h, R: Math.max(1e-6, (ctx.p.radius / 100) * Math.min(w, h) / 2) }; };
/** Odwzorowanie promieniowe wewnątrz koła: t = r/R (0–1) -> t' (źródło); kierunek bez zmian. */
function radial(ctx: RenderCtx, f: (t: number) => number): Img {
  const { cx, cy, R } = geom(ctx);
  return warp(ctx, (x, y, o) => { const dx = x - cx, dy = y - cy; const r = Math.hypot(dx, dy); if (r >= R || r === 0) return false; const k = (f(r / R) * R) / r; o[0] = cx + dx * k; o[1] = cy + dy * k; return true; });
}

const pinch: EffectDef = {
  id: 'pinch', name: 'Pinch', category: 'Distort', engine: 'SHADER', phase: 2,
  description: 'Pulls the image towards a point (positive) or pushes it out (negative).',
  params: [range('amount', 'Amount', 100, -150, 150), RADIUS(), ...CENTER(), ...px1()],
  // t' = t^(2^(−k)): k > 0 bierze piksele z dalszej odległości, więc treść ściąga się do środka; na brzegu koła t' = t.
  render(ctx) { const e = Math.pow(2, -ctx.p.amount / 100); return ctx.p.amount ? radial(ctx, (t) => Math.pow(t, e)) : warp(ctx, () => false); },
};
const spherize: EffectDef = {
  id: 'spherize', name: 'Spherize', category: 'Distort', engine: 'SHADER', phase: 2,
  description: 'Wraps the image around a sphere: convex (positive) or concave (negative).',
  params: [range('amount', 'Amount', 80, -150, 150), RADIUS(), ...CENTER(), ...px1()],
  // t' = t·(1 − k/2·(1 − t²)): k > 0 powiększa środek (wypukłość), k < 0 go zmniejsza; ciągłe na brzegu koła.
  render(ctx) { const k = ctx.p.amount / 100; return k ? radial(ctx, (t) => t * (1 - (k / 2) * (1 - t * t))) : warp(ctx, () => false); },
};
const twirl: EffectDef = {
  id: 'twirl', name: 'Twirl', category: 'Distort', engine: 'SHADER', phase: 2,
  description: 'Twists the image around a centre; the twist fades out towards the radius.',
  params: [range('amount', 'Amount', 120, -300, 300), RADIUS(), ...CENTER(), ...px1()],
  // etap 2, ruch „oscillate” (plik 09: oscylacja amount; proj): amount × (1 − intensity·(1 − cos 2π·speed·φ)); przy 100% skręt
  // przechodzi do −amount i wraca
  motions: [{ id: 'oscillate', name: 'Oscillate', params: motionCommon(100) }],
  // kąt obrotu = amount/100 · π · (1 − t)²; odległość od środka bez zmian
  render(ctx) {
    const { cx, cy, R } = geom(ctx); const m = ctx.motion; const k = (ctx.p.amount / 100) * Math.PI * (m ? 1 - (m.p.intensity / 100) * (1 - Math.cos(2 * Math.PI * m.p.speed * m.phase)) : 1); if (!k) return warp(ctx, () => false);
    return warp(ctx, (x, y, o) => { const dx = x - cx, dy = y - cy; const r = Math.hypot(dx, dy); if (r >= R) return false; const a = k * (1 - r / R) ** 2; const c = Math.cos(a), s = Math.sin(a); o[0] = cx + dx * c - dy * s; o[1] = cy + dx * s + dy * c; return true; });
  },
};
const zigzag: EffectDef = {
  id: 'zigzag', name: 'ZigZag', category: 'Distort', engine: 'SHADER', phase: 2,
  description: 'Shifts rows sideways in a zigzag (triangle wave).',
  params: [range('amount', 'Amount', 40, 0, 100, { unit: '%' }), range('wavelength', 'Wavelength', 30, 5, 100, { unit: 'px', px: true }), ...px1()],
  // etap 2, ruch „flow” (plik 09: przesuwanie fazy fali; proj): fala przesuwa się w pionie o speed długości fali na pętlę
  motions: [{ id: 'flow', name: 'Flow', params: [range('speed', 'Speed (cycles per loop)', 1, 1, 8)] }],
  // przesunięcie = amount · λ/2 · fala trójkątna(y/λ); λ w px skaluje się z eksportem
  render(ctx) {
    const L = Math.max(1, ctx.p.wavelength * ctx.scale); const A = (ctx.p.amount / 100) * L / 2; if (!A) return warp(ctx, () => false);
    const sh = ctx.motion ? ctx.motion.p.speed * ctx.motion.phase : 0;
    return warp(ctx, (x, y, o) => { const v = y / L + sh; const f = v - Math.floor(v); o[0] = x + A * (4 * Math.abs(f - 0.5) - 1); o[1] = y; return true; });
  },
};
const ripple: EffectDef = {
  id: 'ripple', name: 'Ripple', category: 'Distort', engine: 'SHADER', phase: 2,
  description: 'Concentric waves spreading from a centre, like a stone dropped in water.',
  params: [range('amount', 'Amount', 70, 0, 100, { unit: '%' }), range('ridges', 'Ridges', 6, 1, 20), RADIUS(100, 10, 200), ...CENTER(), ...px1()],
  // etap 2, ruch „spread” (plik 09: fala koncentryczna od środka; proj): faza sinusa −2π·speed·φ, fale biegną na zewnątrz
  motions: [{ id: 'spread', name: 'Spread', params: [range('speed', 'Speed (cycles per loop)', 1, 1, 8)] }],
  // r' = r + A·sin(2π·ridges·t)·(1 − t), A = amount · R/(2·ridges); kierunek bez zmian, więc wzór zależny tylko od kąta zostaje
  render(ctx) { const n = ctx.p.ridges, A = (ctx.p.amount / 100) / (2 * n); const ph = ctx.motion ? 2 * Math.PI * ctx.motion.p.speed * ctx.motion.phase : 0; return A ? radial(ctx, (t) => t + A * Math.sin(2 * Math.PI * n * t - ph) * (1 - t)) : warp(ctx, () => false); },
};
const polar: EffectDef = {
  id: 'polar', name: 'Polar', category: 'Distort', engine: 'SHADER', phase: 2,
  description: 'Rectangular to polar coordinates (the image wrapped into a circle) or back.',
  params: [select('mode', 'Mode', 'toPolar', [['toPolar', 'Rectangular → polar'], ['toRect', 'Polar → rectangular']]), range('rotation', 'Rotation', 0, 0, 100, { unit: '%' }), ...px1()],
  // toPolar: kąt wokół środka -> x źródła, odległość od środka (do połowy krótszego boku) -> y źródła; toRect: odwrotnie
  render(ctx) {
    const { w, h } = ctx.prep; const cx = w / 2, cy = h / 2, rm = Math.min(w, h) / 2; const rot = ctx.p.rotation / 100; const TAU = 2 * Math.PI;
    if (ctx.p.mode === 'toPolar') return warp(ctx, (x, y, o) => { const dx = x - cx, dy = y - cy; let u = Math.atan2(dy, dx) / TAU + 0.25 + rot; u -= Math.floor(u); o[0] = u * w; o[1] = Math.min(1, Math.hypot(dx, dy) / rm) * h; return true; }, true);
    return warp(ctx, (x, y, o) => { const a = (x / w - 0.25 - rot) * TAU, r = (y / h) * rm; o[0] = cx + r * Math.cos(a); o[1] = cy + r * Math.sin(a); return true; });
  },
};
const shear: EffectDef = {
  id: 'shear', name: 'Shear', category: 'Distort', engine: 'SHADER', phase: 2,
  description: 'Bends the image sideways along a smooth wave; rows wrap around the edge.',
  params: [range('amount', 'Amount', 40, -100, 100), range('period', 'Period', 150, 25, 300, { unit: 'px', px: true }), ...px1()],
  // przesunięcie wiersza = amount · 0,2 · szerokość · sin(2π·y/okres); zawijanie w poziomie jak w Photoshopowym Shear
  render(ctx) {
    const { w } = ctx.prep; const P = Math.max(1, ctx.p.period * ctx.scale); const A = (ctx.p.amount / 100) * 0.2 * w; if (!A) return warp(ctx, () => false);
    return warp(ctx, (x, y, o) => { o[0] = x + A * Math.sin((2 * Math.PI * y) / P); o[1] = y; return true; }, true);
  },
};
export const DISTORT_EFFECTS: EffectDef[] = [pinch, spherize, twirl, zigzag, ripple, polar, shear];
