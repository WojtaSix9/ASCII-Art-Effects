// Modul Color (plik 01, sekcja 7): presety, tint z blendem, saturation, vibrance, hue, grayscale, invert. Definicje presetow: proj.
import type { Img, ParamDef } from '../core/types.ts';
import { color, range, select, toggle } from '../core/params.ts';
import { clamp, lerp, lum, parseColor } from '../core/util.ts';

export const COLOR_PARAMS: ParamDef[] = [
  select('preset', 'Preset', 'none', [['none', 'None'], ['bw', 'B&W'], ['sepia', 'Sepia'], ['warm', 'Warm'], ['cool', 'Cool'], ['vintage', 'Vintage'], ['fade', 'Fade'], ['cyber', 'Cyber']]),
  color('tint', 'Tint', '#ff8a3d'), range('tintOpacity', 'Tint opacity', 0, 0, 100, { unit: '%' }), select('blend', 'Blend', 'multiply', [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay']]),
  range('saturation', 'Saturation', 100, 0, 200, { unit: '%' }), range('vibrance', 'Vibrance', 0, -100, 100), range('hue', 'Hue', 0, -180, 180, { unit: '°' }), range('grayscale', 'Grayscale', 0, 0, 100, { unit: '%' }), toggle('invertImage', 'Invert image', false),
];
const blendCh = (mode: string, a: number, b: number) => { a /= 255; b /= 255; const v = mode === 'multiply' ? a * b : mode === 'screen' ? 1 - (1 - a) * (1 - b) : mode === 'overlay' ? (a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b)) : b; return v * 255; };
export function isNeutral(p: Record<string, any>) { return p.preset === 'none' && p.tintOpacity === 0 && p.saturation === 100 && p.vibrance === 0 && p.hue === 0 && p.grayscale === 0 && !p.invertImage; }
export function applyColor(img: Img, p: Record<string, any>): Img {
  if (isNeutral(p)) return img; const d = img.data; const tint = parseColor(p.tint); const ta = p.tintOpacity / 100; const sat = p.saturation / 100, vib = p.vibrance / 100, gs = p.grayscale / 100;
  const hr = (p.hue * Math.PI) / 180, ch = Math.cos(hr), sh = Math.sin(hr);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    switch (p.preset) {
      case 'bw': { const l = lum(r, g, b) * 255; r = g = b = l; break; }
      case 'sepia': { const nr = 0.393 * r + 0.769 * g + 0.189 * b, ng = 0.349 * r + 0.686 * g + 0.168 * b, nb = 0.272 * r + 0.534 * g + 0.131 * b; r = nr; g = ng; b = nb; break; }
      case 'warm': r *= 1.08; b *= 0.9; break; case 'cool': r *= 0.9; b *= 1.08; break;
      case 'fade': r = r * 0.82 + 30; g = g * 0.82 + 30; b = b * 0.82 + 34; break;
      case 'vintage': { const nr = 0.393 * r + 0.769 * g + 0.189 * b, ng = 0.349 * r + 0.686 * g + 0.168 * b, nb = 0.272 * r + 0.534 * g + 0.131 * b; r = lerp(r, nr, 0.5) * 0.88 + 26; g = lerp(g, ng, 0.5) * 0.88 + 24; b = lerp(b, nb, 0.5) * 0.88 + 22; break; }
      case 'cyber': { const l = lum(r, g, b); r = r * (0.8 + 0.5 * l) + 20 * l; g = g * 0.85; b = b * (1.25 - 0.4 * l) + 20 * (1 - l); break; }
    }
    if (p.hue) { const l = 0.299 * r + 0.587 * g + 0.114 * b; const nr = r * (0.299 + 0.701 * ch + 0.168 * sh) + g * (0.587 - 0.587 * ch + 0.330 * sh) + b * (0.114 - 0.114 * ch - 0.497 * sh), ng = r * (0.299 - 0.299 * ch - 0.328 * sh) + g * (0.587 + 0.413 * ch + 0.035 * sh) + b * (0.114 - 0.114 * ch + 0.292 * sh), nb = r * (0.299 - 0.3 * ch + 1.25 * sh) + g * (0.587 - 0.588 * ch - 1.05 * sh) + b * (0.114 + 0.886 * ch - 0.203 * sh); void l; r = nr; g = ng; b = nb; }
    if (sat !== 1 || vib) { const l = lum(r, g, b) * 255; const s = (Math.max(r, g, b) - Math.min(r, g, b)) / 255; const k = sat * (1 + vib * (1 - s)); r = l + (r - l) * k; g = l + (g - l) * k; b = l + (b - l) * k; }
    if (gs) { const l = lum(r, g, b) * 255; r = lerp(r, l, gs); g = lerp(g, l, gs); b = lerp(b, l, gs); }
    if (ta) { r = lerp(r, blendCh(p.blend, r, tint[0]), ta); g = lerp(g, blendCh(p.blend, g, tint[1]), ta); b = lerp(b, blendCh(p.blend, b, tint[2]), ta); }
    if (p.invertImage) { r = 255 - r; g = 255 - g; b = 255 - b; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  return img;
}
