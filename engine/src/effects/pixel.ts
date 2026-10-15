// Efekty punktowe/polowtonowe: Halftone, Posterize, Duotone, Gradient Map (plik 02, sekcje 3, 4, 8). proj.
import type { EffectDef, Img, RenderCtx } from '../core/types.ts';
import { color, common, range, select, seedParam, toggle } from '../core/params.ts';
import { blur, clamp, lerp, lum, parseColor } from '../core/util.ts';

const px1 = () => [...common('brightness', 'contrast')];
const mapPixels = (ctx: RenderCtx, f: (r: number, g: number, b: number, a: number) => [number, number, number]): Img => {
  const s = ctx.prep; const out = new Uint8ClampedArray(s.data.length);
  for (let i = 0; i < s.data.length; i += 4) { const c = f(s.data[i], s.data[i + 1], s.data[i + 2], s.data[i + 3]); out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = s.data[i + 3]; }
  return { w: s.w, h: s.h, data: out };
};
const halftone: EffectDef = {
  id: 'halftone', name: 'Halftone', category: 'Print & Paper', engine: 'SHADER', phase: 1,
  description: 'Classic halftone: dots, lines or squares on a rotated grid, sized by tone.',
  params: [range('cellSize', 'Cell size', 9, 3, 60, { unit: 'px', px: true }), range('angle', 'Angle', 45, 0, 90, { unit: '°' }), select('shape', 'Shape', 'dot', [['dot', 'Dot'], ['line', 'Line'], ['square', 'Square']]), select('colorMode', 'Colour', 'mono', [['mono', 'Single colour'], ['image', 'From image']]),
    color('inkColor', 'Ink', '#111111'), color('paperColor', 'Paper', '#f4f1ea'), toggle('invert', 'Invert', false, { level: 'advanced' }), ...px1()],
  render(ctx) {
    const { w, h } = ctx.prep; const cs = ctx.px(ctx.p.cellSize); const ang = (ctx.p.angle * Math.PI) / 180; const ca = Math.cos(ang), sa = Math.sin(ang);
    const sm = blur(ctx.prep, Math.max(1, Math.round(cs * 0.5))); const ink = parseColor(ctx.p.inkColor), paper = parseColor(ctx.p.paperColor); const out = new Uint8ClampedArray(w * h * 4); const hw = w / 2, hh = h / 2;
    const inv = ctx.p.invert, shape = ctx.p.shape, fromImg = ctx.p.colorMode === 'image';   // krok 6: odczyt parametrów raz
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - hw, dy = y + 0.5 - hh; const u = dx * ca + dy * sa, v = -dx * sa + dy * ca; const i = Math.floor(u / cs), j = Math.floor(v / cs); const cu = (i + 0.5) * cs, cv = (j + 0.5) * cs;
      const sx = clamp(Math.round(cu * ca - cv * sa + hw), 0, w - 1), sy = clamp(Math.round(cu * sa + cv * ca + hh), 0, h - 1); const si = (sy * w + sx) * 4; const t = lum(sm.data[si], sm.data[si + 1], sm.data[si + 2]);
      const a = inv ? t : 1 - t; let sd: number; // a = ilosc tuszu
      if (shape === 'dot') sd = Math.hypot(u - cu, v - cv) - cs * 0.5 * Math.sqrt(a) * 1.12; else if (shape === 'line') sd = Math.abs(v - cv) - (cs * a) / 2; else sd = Math.max(Math.abs(u - cu), Math.abs(v - cv)) - (cs * Math.sqrt(a)) / 2;
      const k = clamp(0.5 - sd, 0, 1); const o = (y * w + x) * 4;
      const c0 = fromImg ? sm.data[si] : ink[0], c1 = fromImg ? sm.data[si + 1] : ink[1], c2 = fromImg ? sm.data[si + 2] : ink[2];
      out[o] = lerp(paper[0], c0, k); out[o + 1] = lerp(paper[1], c1, k); out[o + 2] = lerp(paper[2], c2, k); out[o + 3] = 255;
    }
    return { w, h, data: out };
  },
};
const posterize: EffectDef = {
  id: 'posterize', name: 'Posterize', category: 'Print & Paper', engine: 'SHADER', phase: 1,
  description: 'Reduces every channel to N levels, giving flat colour patches.',
  params: [range('levels', 'Levels', 4, 2, 32), range('smoothing', 'Smoothing', 0, 0, 100, { unit: '%', level: 'advanced' }), ...px1()],
  render(ctx) { const n = ctx.p.levels, k = ctx.p.smoothing / 100; return mapPixels(ctx, (r, g, b) => { const q = (v: number) => lerp(Math.round((v / 255) * (n - 1)) * (255 / (n - 1)), v, k); return [q(r), q(g), q(b)]; }); },
};
const duotone: EffectDef = {
  id: 'duotone', name: 'Duotone', category: 'Light & Colour', engine: 'SHADER', phase: 1,
  description: 'Two colours: one for shadows, one for highlights.',
  params: [color('shadowColor', 'Shadows', '#14142b'), color('highlightColor', 'Highlights', '#ffd6a5'), range('blend', 'Blend', 100, 0, 100, { unit: '%', level: 'advanced' }), ...px1()],
  render(ctx) { const a = parseColor(ctx.p.shadowColor), b = parseColor(ctx.p.highlightColor), k = ctx.p.blend / 100; return mapPixels(ctx, (r, g, bl) => { const t = lum(r, g, bl); return [lerp(r, lerp(a[0], b[0], t), k), lerp(g, lerp(a[1], b[1], t), k), lerp(bl, lerp(a[2], b[2], t), k)]; }); },
};
export const GRADIENT_PRESETS: Record<string, { color: string; pos: number }[]> = {
  heat: [{ pos: 0, color: '#000004' }, { pos: 0.3, color: '#7b1e7a' }, { pos: 0.6, color: '#f1605d' }, { pos: 0.85, color: '#fec287' }, { pos: 1, color: '#fcfdbf' }],
  ocean: [{ pos: 0, color: '#03071e' }, { pos: 0.5, color: '#1d5fa8' }, { pos: 1, color: '#d8f3ff' }],
  sunset: [{ pos: 0, color: '#1b0a2e' }, { pos: 0.45, color: '#c2306b' }, { pos: 0.75, color: '#ff8a3d' }, { pos: 1, color: '#ffe9b0' }],
  mono: [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }],
};
export function gradientLut(stops: { color: string; pos: number }[]): Uint8ClampedArray {
  const s = [...stops].sort((a, b) => a.pos - b.pos).map((x) => ({ pos: x.pos, c: parseColor(x.color) })); const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) { const t = i / 255; let k = 0; while (k < s.length - 2 && t > s[k + 1].pos) k++; const a = s[k], b = s[k + 1]; const u = clamp((t - a.pos) / Math.max(1e-9, b.pos - a.pos), 0, 1); for (let c = 0; c < 3; c++) lut[i * 3 + c] = lerp(a.c[c], b.c[c], u); }
  return lut;
}
const gradientmap: EffectDef = {
  id: 'gradientmap', name: 'Gradient Map', category: 'Light & Colour', engine: 'SHADER', phase: 1,
  description: 'Maps brightness onto a multi-stop colour gradient.',
  params: [select('preset', 'Preset', 'heat', [['custom', 'Custom'], ['heat', 'Heat'], ['ocean', 'Ocean'], ['sunset', 'Sunset'], ['mono', 'Mono']]), { id: 'stops', label: 'Stops', kind: 'gradient', default: GRADIENT_PRESETS.heat, level: 'advanced' }, range('blend', 'Blend', 100, 0, 100, { unit: '%', level: 'advanced' }), ...px1()],
  render(ctx) { const lut = gradientLut(ctx.p.preset === 'custom' ? ctx.p.stops : GRADIENT_PRESETS[ctx.p.preset]); const k = ctx.p.blend / 100; return mapPixels(ctx, (r, g, b) => { const i = Math.round(lum(r, g, b) * 255) * 3; return [lerp(r, lut[i], k), lerp(g, lut[i + 1], k), lerp(b, lut[i + 2], k)]; }); },
};
export const PIXEL_EFFECTS: EffectDef[] = [halftone, posterize, duotone, gradientmap];
