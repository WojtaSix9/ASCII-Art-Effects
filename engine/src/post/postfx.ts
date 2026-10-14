// Darmowe post FX (plik 01, sekcja 8): 13 z 16. Brakuje: charBloom i charChroma (dzialaja per glif w trybach znakowych, wymagaja integracji z rysowaniem siatki) oraz post-halftone.
// Kolejnosc stala, niezalezna od kolejnosci wlaczania (plik 01). Wartosci w px skaluja sie ze skala eksportu.
import type { Img, PostFxDef } from '../core/types.ts';
import { color, range, select, seedParam } from '../core/params.ts';
import { blur, clamp, hash01, lerp, lum, mulberry32, parseColor } from '../core/util.ts';

const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a || 1e-6), 0, 1); return t * t * (3 - 2 * t); };
const sample = (d: Uint8ClampedArray, w: number, h: number, x: number, y: number, c: number) => { x = clamp(x - 0.5, 0, w - 1); y = clamp(y - 0.5, 0, h - 1); const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = x - x0, ty = y - y0; return lerp(lerp(d[(y0 * w + x0) * 4 + c], d[(y0 * w + x1) * 4 + c], tx), lerp(d[(y1 * w + x0) * 4 + c], d[(y1 * w + x1) * 4 + c], tx), ty); };
const PX = { unit: 'px', px: true } as const;

export const POSTFX: PostFxDef[] = [
  { id: 'advBlur', name: 'Blur', params: [range('amount', 'Amount', 20, 0, 100, { unit: '%' })], apply: (img, p, s) => (p.amount ? blur(img, (p.amount / 100) * 20 * s) : img) },
  { id: 'vignette', name: 'Vignette', params: [range('intensity', 'Intensity', 50, 0, 100, { unit: '%' }), range('size', 'Size', 50, 0, 100), range('feather', 'Feather', 60, 0, 100), range('roundness', 'Roundness', 50, 0, 100), color('color', 'Colour', '#000000')],
    apply(img, p) { const { w, h, data: d } = img; const c = parseColor(p.color); const k = p.intensity / 100; const inner = 0.15 + (p.size / 100) * 1.1, fe = 0.05 + (p.feather / 100) * 0.9, rd = p.roundness / 100;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x + 0.5 - w / 2), dy = (y + 0.5 - h / 2); const e = Math.hypot(dx / (w / 2), dy / (h / 2)), r = Math.hypot(dx, dy) / (Math.min(w, h) / 2); const dist = lerp(e, r, rd) ; const a = smooth(inner, inner + fe, dist) * k; const i = (y * w + x) * 4; d[i] = lerp(d[i], c[0], a); d[i + 1] = lerp(d[i + 1], c[1], a); d[i + 2] = lerp(d[i + 2], c[2], a); }
      return img; } },
  { id: 'scanLines', name: 'Scan Lines', params: [range('intensity', 'Intensity', 40, 0, 100, { unit: '%' }), range('spacing', 'Spacing', 3, 1, 10, PX), range('thickness', 'Thickness', 1, 1, 6, PX), color('color', 'Colour', '#000000')],
    apply(img, p, s) { const sp = Math.max(1, Math.round(p.spacing * s)), th = Math.max(1, Math.round(p.thickness * s)); const c = parseColor(p.color); const k = p.intensity / 100; const { w, h, data: d } = img;
      for (let y = 0; y < h; y++) if (y % (sp + th) >= sp) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; d[i] = lerp(d[i], c[0], k); d[i + 1] = lerp(d[i + 1], c[1], k); d[i + 2] = lerp(d[i + 2], c[2], k); }
      return img; } },
  { id: 'bloom', name: 'Bloom', params: [range('threshold', 'Threshold', 60, 0, 100, { unit: '%' }), range('intensity', 'Intensity', 50, 0, 100, { unit: '%' }), range('blur', 'Blur', 30, 1, 100, { unit: '%' }), color('tint', 'Tint', '#ffffff'), range('tintAmount', 'Tint amount', 0, 0, 100, { unit: '%' })],
    apply(img, p, s) { const { w, h, data: d } = img; const bright = new Uint8ClampedArray(d.length); const thr = p.threshold / 100; const t = parseColor(p.tint); const ta = p.tintAmount / 100;
      for (let i = 0; i < d.length; i += 4) { const l = lum(d[i], d[i + 1], d[i + 2]); const k = clamp((l - thr) / Math.max(1e-3, 1 - thr), 0, 1); bright[i] = lerp(d[i], t[0], ta) * k; bright[i + 1] = lerp(d[i + 1], t[1], ta) * k; bright[i + 2] = lerp(d[i + 2], t[2], ta) * k; bright[i + 3] = 255; }
      const bl = blur({ w, h, data: bright }, (p.blur / 100) * 30 * s); const k = p.intensity / 100 * 1.5;
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = 255 - ((255 - d[i + c]) * (255 - bl.data[i + c] * k)) / 255; return img; } },
  { id: 'chromatic', name: 'Chromatic', params: [range('offset', 'Offset', 6, 1, 40, PX), range('angle', 'Angle', 0, 0, 360, { unit: '°' }), range('radial', 'Radial', 0, 0, 100, { unit: '%' })],
    apply(img, p, s) { const { w, h, data: d } = img; const src = new Uint8ClampedArray(d); const a = (p.angle * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), off = p.offset * s, rk = p.radial / 100;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = x + 0.5 - w / 2, dy = y + 0.5 - h / 2; const rr = Math.hypot(dx, dy) / Math.hypot(w / 2, h / 2); const k = off * (1 - rk + rk * rr * 2); const i = (y * w + x) * 4; const ox = rk > 0 && rr > 0 ? (dx / (rr * Math.hypot(w / 2, h / 2))) : ux, oy = rk > 0 && rr > 0 ? (dy / (rr * Math.hypot(w / 2, h / 2))) : uy;
        d[i] = sample(src, w, h, x + 0.5 + ox * k, y + 0.5 + oy * k, 0); d[i + 2] = sample(src, w, h, x + 0.5 - ox * k, y + 0.5 - oy * k, 2); } return img; } },
  { id: 'rgbSplit', name: 'RGB Split', params: [range('offset', 'Offset', 5, 1, 20, PX), range('angle', 'Angle', 0, 0, 360, { unit: '°', level: 'advanced' })],
    apply(img, p, s) { const { w, h, data: d } = img; const src = new Uint8ClampedArray(d); const a = (p.angle * Math.PI) / 180, k = p.offset * s; const ox = Math.cos(a) * k, oy = Math.sin(a) * k;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; d[i] = sample(src, w, h, x + 0.5 - ox, y + 0.5 - oy, 0); d[i + 2] = sample(src, w, h, x + 0.5 + ox, y + 0.5 + oy, 2); } return img; } },
  { id: 'crtCurve', name: 'CRT Curvature', params: [range('intensity', 'Intensity', 40, 0, 100, { unit: '%' })],
    apply(img, p) { const { w, h, data: d } = img; const src = new Uint8ClampedArray(d); const k = (p.intensity / 100) * 0.25;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const nx = ((x + 0.5) / w) * 2 - 1, ny = ((y + 0.5) / h) * 2 - 1; const r2 = nx * nx + ny * ny; const sx = nx * (1 + k * r2), sy = ny * (1 + k * r2); const i = (y * w + x) * 4;
        if (Math.abs(sx) > 1 || Math.abs(sy) > 1) { d[i] = d[i + 1] = d[i + 2] = 0; continue; } for (let c = 0; c < 3; c++) d[i + c] = sample(src, w, h, ((sx + 1) / 2) * w, ((sy + 1) / 2) * h, c); } return img; } },
  { id: 'glitch', name: 'Glitch', params: [range('intensity', 'Intensity', 50, 0, 100, { unit: '%' }), range('sliceMax', 'Max slice', 24, 2, 80, PX), range('rgb', 'RGB shift', 40, 0, 100, { unit: '%' }), seedParam()],
    apply(img, p, s) { const { w, h, data: d } = img; const src = new Uint8ClampedArray(d); const rnd = mulberry32(p.seed * 7919 + 1); const n = Math.round((p.intensity / 100) * 24); const maxH = Math.max(2, Math.round(p.sliceMax * s));
      for (let k = 0; k < n; k++) { const y0 = Math.floor(rnd() * h), sh = 1 + Math.floor(rnd() * maxH), dx = Math.round((rnd() - 0.5) * 2 * (p.intensity / 100) * w * 0.12), rs = Math.round((p.rgb / 100) * rnd() * 12 * s);
        for (let y = y0; y < Math.min(h, y0 + sh); y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const at = (xx: number, c: number) => src[(y * w + clamp(xx, 0, w - 1)) * 4 + c]; d[i] = at(x - dx + rs, 0); d[i + 1] = at(x - dx, 1); d[i + 2] = at(x - dx - rs, 2); } } return img; } },
  { id: 'filmGrain', name: 'Film Grain', params: [range('intensity', 'Intensity', 30, 0, 100, { unit: '%' }), range('colour', 'Colour', 0, 0, 100, { unit: '%' }), seedParam()],
    apply(img, p, s) { const { w, h, data: d } = img; const k = (p.intensity / 100) * 70, cl = p.colour / 100; const bs = Math.max(1, Math.round(s));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const gx = Math.floor(x / bs), gy = Math.floor(y / bs); const n = (hash01(gx, gy, p.seed) - 0.5) * k; const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) d[i + c] += lerp(n, (hash01(gx, gy, p.seed + 11 * (c + 1)) - 0.5) * k, cl); } return img; } },
  { id: 'pixelate', name: 'Pixelate', params: [range('size', 'Size', 8, 2, 30, PX)],
    apply(img, p, s) { const bs = Math.max(2, Math.round(p.size * s)); const { w, h, data: d } = img;
      for (let by = 0; by < h; by += bs) for (let bx = 0; bx < w; bx += bs) { let r = 0, g = 0, b = 0, n = 0; const x1 = Math.min(w, bx + bs), y1 = Math.min(h, by + bs); for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) { const i = (y * w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) { const i = (y * w + x) * 4; d[i] = r / n; d[i + 1] = g / n; d[i + 2] = b / n; } } return img; } },
  { id: 'filmDust', name: 'Film Dust', params: [range('density', 'Density', 30, 0, 100, { unit: '%' }), seedParam()],
    apply(img, p, s) { const { w, h, data: d } = img; const rnd = mulberry32(p.seed * 104729 + 3); const n = Math.ceil((p.density / 100) * (w * h) / 15000);
      for (let k = 0; k < n; k++) { const x = rnd() * w, y = rnd() * h, r = (0.6 + rnd() * 1.4) * s, len = rnd() < 0.3 ? (4 + rnd() * 10) * s : 0, a = rnd() * Math.PI, bright = rnd() < 0.7 ? 255 : 0, al = 0.4 + rnd() * 0.5;
        for (let y2 = Math.max(0, Math.floor(y - len - r - 1)); y2 < Math.min(h, y + len + r + 2); y2++) for (let x2 = Math.max(0, Math.floor(x - len - r - 1)); x2 < Math.min(w, x + len + r + 2); x2++) { const px = x2 + 0.5 - x, py = y2 + 0.5 - y; const t = len ? clamp(px * Math.cos(a) + py * Math.sin(a), -len / 2, len / 2) : 0; const dd = Math.hypot(px - t * Math.cos(a), py - t * Math.sin(a)); const c = clamp(0.5 - (dd - r), 0, 1) * al; if (c > 0) { const i = (y2 * w + x2) * 4; for (let q = 0; q < 3; q++) d[i + q] = lerp(d[i + q], bright, c); } } } return img; } },
  { id: 'sharpen', name: 'Sharpen', params: [range('amount', 'Amount', 40, 0, 100, { unit: '%' })],
    apply(img, p, s) { if (!p.amount) return img; const bl = blur(img, Math.max(1, Math.round(s)), 1); const k = (p.amount / 100) * 1.5; const d = img.data; for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] += (d[i + c] - bl.data[i + c]) * k; return img; } },
  { id: 'noise', name: 'Noise', params: [range('amount', 'Amount', 20, 0, 100, { unit: '%' }), range('size', 'Size', 1, 1, 10, PX), range('colour', 'Colour', 0, 0, 100, { unit: '%' }), seedParam(2)],
    apply(img, p, s) { const { w, h, data: d } = img; const bs = Math.max(1, Math.round(p.size * s)), k = (p.amount / 100) * 120, cl = p.colour / 100;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const gx = Math.floor(x / bs), gy = Math.floor(y / bs); const n = (hash01(gx, gy, p.seed + 101) - 0.5) * k; const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) d[i + c] += lerp(n, (hash01(gx, gy, p.seed + 31 * (c + 1)) - 0.5) * k, cl); } return img; } },
];
export const POSTFX_ORDER = POSTFX.map((p) => p.id); // = kolejnosc renderowania
