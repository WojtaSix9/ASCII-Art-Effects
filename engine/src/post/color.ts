// Modul Color (plik 01, sekcja 7): presety, tint z blendem, saturation, vibrance, hue, grayscale, invert. Definicje presetow: proj.
import type { Img, ParamDef } from '../core/types.ts';
import { color, range, select, toggle } from '../core/params.ts';
import { clamp, lerp, lum, parseColor } from '../core/util.ts';
import { CURVES_IDENTITY, PHOTO_FILTERS, curveIsIdentity, curveLut, levelsLut, levelsNeutral, photoFilterFn, type Curves, type LevelsP } from './grade.ts';
import { GRADIENT_PRESETS, gradientLut } from '../effects/pixel.ts';

export const COLOR_PARAMS: ParamDef[] = [
  select('preset', 'Preset', 'none', [['none', 'None'], ['bw', 'B&W'], ['sepia', 'Sepia'], ['warm', 'Warm'], ['cool', 'Cool'], ['vintage', 'Vintage'], ['fade', 'Fade'], ['cyber', 'Cyber']]),
  color('tint', 'Tint', '#ff8a3d'), range('tintOpacity', 'Tint opacity', 0, 0, 100, { unit: '%' }), select('blend', 'Blend', 'multiply', [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay']]),
  range('saturation', 'Saturation', 100, 0, 200, { unit: '%' }), range('vibrance', 'Vibrance', 0, -100, 100), range('hue', 'Hue', 0, -180, 180, { unit: '°' }), range('grayscale', 'Grayscale', 0, 0, 100, { unit: '%' }), toggle('invertImage', 'Invert image', false),
  // Krok 7 (proj, plik 01: zawartość listy filtrów nieznana): Photo Filter i Gradient Map w zakładce Color
  select('photoFilter', 'Photo filter', 'none', [['none', 'None'], ...Object.entries(PHOTO_FILTERS).map(([k, f]) => [k, f.name] as [string, string])]),
  range('photoDensity', 'Filter density', 25, 0, 100, { unit: '%' }), toggle('photoPreserve', 'Preserve luminosity', true),
  select('gradientMap', 'Gradient map', 'none', [['none', 'None'], ['heat', 'Heat'], ['ocean', 'Ocean'], ['sunset', 'Sunset'], ['mono', 'Mono']]), range('gradientAmount', 'Gradient amount', 100, 0, 100, { unit: '%' }),
  // Levels i Curves (plik 01, sekcja 8: per kanał lub composite; krzywa na kanał + composite na końcu)
  select('levelsChannel', 'Levels channel', 'rgb', [['rgb', 'RGB'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']]),
  range('levelsInBlack', 'Input black', 0, 0, 254), range('levelsInWhite', 'Input white', 255, 1, 255), range('levelsGamma', 'Gamma', 1, 0.1, 9.99, { step: 0.01 }),
  range('levelsOutBlack', 'Output black', 0, 0, 255), range('levelsOutWhite', 'Output white', 255, 0, 255),
  { id: 'curves', label: 'Curves', kind: 'curves', default: CURVES_IDENTITY, level: 'main' },
];
const levelsOf = (p: Record<string, any>): LevelsP => ({ channel: p.levelsChannel ?? 'rgb', inBlack: p.levelsInBlack ?? 0, inWhite: p.levelsInWhite ?? 255, gamma: p.levelsGamma ?? 1, outBlack: p.levelsOutBlack ?? 0, outWhite: p.levelsOutWhite ?? 255 });
const curvesOf = (p: Record<string, any>): Curves => p.curves ?? CURVES_IDENTITY;
const curvesNeutral = (c: Curves) => (['rgb', 'r', 'g', 'b'] as const).every((k) => curveIsIdentity(c[k]));
const blendCh = (mode: string, a: number, b: number) => { a /= 255; b /= 255; const v = mode === 'multiply' ? a * b : mode === 'screen' ? 1 - (1 - a) * (1 - b) : mode === 'overlay' ? (a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b)) : b; return v * 255; };
export function isNeutral(p: Record<string, any>) {
  return p.preset === 'none' && p.tintOpacity === 0 && p.saturation === 100 && p.vibrance === 0 && p.hue === 0 && p.grayscale === 0 && !p.invertImage
    && (p.photoFilter ?? 'none') === 'none' && (p.gradientMap ?? 'none') === 'none' && levelsNeutral(levelsOf(p)) && curvesNeutral(curvesOf(p));
}
export function applyColor(img: Img, p: Record<string, any>): Img {
  if (isNeutral(p)) return img; const d = img.data; const tint = parseColor(p.tint); const ta = p.tintOpacity / 100; const sat = p.saturation / 100, vib = p.vibrance / 100, gs = p.grayscale / 100;
  const hr = (p.hue * Math.PI) / 180, ch = Math.cos(hr), sh = Math.sin(hr);
  const pf = photoFilterFn(p.photoFilter ?? 'none', (p.photoDensity ?? 25) / 100, p.photoPreserve ?? true);
  const gm = (p.gradientMap ?? 'none') !== 'none' && (p.gradientAmount ?? 100) > 0 ? gradientLut(GRADIENT_PRESETS[p.gradientMap]) : null; const ga = (p.gradientAmount ?? 100) / 100;
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
    if (pf) [r, g, b] = pf(r, g, b);
    if (p.hue) { const l = 0.299 * r + 0.587 * g + 0.114 * b; const nr = r * (0.299 + 0.701 * ch + 0.168 * sh) + g * (0.587 - 0.587 * ch + 0.330 * sh) + b * (0.114 - 0.114 * ch - 0.497 * sh), ng = r * (0.299 - 0.299 * ch - 0.328 * sh) + g * (0.587 + 0.413 * ch + 0.035 * sh) + b * (0.114 - 0.114 * ch + 0.292 * sh), nb = r * (0.299 - 0.3 * ch + 1.25 * sh) + g * (0.587 - 0.588 * ch - 1.05 * sh) + b * (0.114 + 0.886 * ch - 0.203 * sh); void l; r = nr; g = ng; b = nb; }
    if (sat !== 1 || vib) { const l = lum(r, g, b) * 255; const s = (Math.max(r, g, b) - Math.min(r, g, b)) / 255; const k = sat * (1 + vib * (1 - s)); r = l + (r - l) * k; g = l + (g - l) * k; b = l + (b - l) * k; }
    if (gm) { const j = Math.round(clamp(lum(r, g, b), 0, 1) * 255) * 3; r = lerp(r, gm[j], ga); g = lerp(g, gm[j + 1], ga); b = lerp(b, gm[j + 2], ga); }
    if (gs) { const l = lum(r, g, b) * 255; r = lerp(r, l, gs); g = lerp(g, l, gs); b = lerp(b, l, gs); }
    if (ta) { r = lerp(r, blendCh(p.blend, r, tint[0]), ta); g = lerp(g, blendCh(p.blend, g, tint[1]), ta); b = lerp(b, blendCh(p.blend, b, tint[2]), ta); }
    if (p.invertImage) { r = 255 - r; g = 255 - g; b = 255 - b; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  applyLevelsCurves(img, levelsOf(p), curvesOf(p));
  return img;
}

/** Levels, potem Curves (kanały, na końcu composite) na gotowej klatce (plik 01, sekcja 8.9). */
function applyLevelsCurves(img: Img, l: LevelsP, c: Curves) {
  const d = img.data;
  if (!levelsNeutral(l)) {
    const lut = levelsLut(l); const chs = l.channel === 'rgb' ? [0, 1, 2] : [{ r: 0, g: 1, b: 2 }[l.channel]];
    for (let i = 0; i < d.length; i += 4) for (const k of chs) d[i + k] = lut[d[i + k]];
  }
  const luts = (['r', 'g', 'b'] as const).map((k) => (curveIsIdentity(c[k]) ? null : curveLut(c[k])));
  for (let k = 0; k < 3; k++) { const lut = luts[k]; if (lut) for (let i = k; i < d.length; i += 4) d[i] = lut[d[i]]; }
  if (!curveIsIdentity(c.rgb)) { const lut = curveLut(c.rgb); for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; } }
}
