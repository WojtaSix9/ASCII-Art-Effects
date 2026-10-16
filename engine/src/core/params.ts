import type { ParamDef } from './types.ts';
import { clamp, parseColor } from './util.ts';
import { validateCurves } from '../post/grade.ts';

export const range = (id: string, label: string, def: number, min: number, max: number, o: Partial<ParamDef> = {}): ParamDef => ({ id, label, kind: 'range', default: def, min, max, step: 1, level: 'main', ...o });
export const select = (id: string, label: string, def: string, options: [string, string][], o: Partial<ParamDef> = {}): ParamDef => ({ id, label, kind: 'select', default: def, options: options.map(([value, label]) => ({ value, label })), level: 'main', ...o });
export const toggle = (id: string, label: string, def: boolean, o: Partial<ParamDef> = {}): ParamDef => ({ id, label, kind: 'toggle', default: def, level: 'main', ...o });
export const color = (id: string, label: string, def: string, o: Partial<ParamDef> = {}): ParamDef => ({ id, label, kind: 'color', default: def, level: 'main', ...o });
export const seedParam = (def = 1): ParamDef => ({ id: 'seed', label: 'Seed', kind: 'seed', default: def, min: 0, max: 99999, step: 1, level: 'advanced' });

/** Parametry wspolne efektow siatkowych/kafelkowych (plik 01, sekcja 3). Kontrast: nasza definicja, neutralny = 0 (docs maja sprzecznosc, plik 01 sekcja 10). */
export const COMMON: Record<string, ParamDef> = {
  coverage: range('coverage', 'Coverage', 100, 0, 100, { unit: '%' }),
  brightness: range('brightness', 'Brightness', 0, -100, 100, { level: 'advanced' }),
  contrast: range('contrast', 'Contrast', 0, -100, 100, { level: 'advanced' }),
  invert: toggle('invert', 'Invert mapping', false, { level: 'advanced' }),
  bgMode: select('bgMode', 'Backdrop', 'blur', [['blur', 'Blurred image'], ['solid', 'Solid colour'], ['original', 'Original image'], ['none', 'None (transparent)']]),
  bgOpacity: range('bgOpacity', 'Backdrop opacity', 100, 0, 100, { unit: '%', level: 'advanced' }),
  bgBlur: range('bgBlur', 'Softness', 8, 0, 60, { unit: 'px', px: true, level: 'advanced' }),
  bgColor: color('bgColor', 'Backdrop colour', '#000000', { level: 'advanced' }),
};
export const common = (...ids: string[]) => ids.map((i) => COMMON[i]);

/** Uzupelnia domyslne, obcina zakresy, sprawdza typy. Nieznane klucze: blad (strict) albo pominiecie. */
export function resolveParams(defs: ParamDef[], input: Record<string, any> = {}, strict = true): Record<string, any> {
  const out: Record<string, any> = {}; const known = new Set(defs.map((d) => d.id));
  if (strict) for (const k of Object.keys(input)) if (!known.has(k)) throw new Error(`unknown parameter "${k}"`);
  for (const d of defs) {
    let v = input[d.id] === undefined ? d.default : input[d.id];
    switch (d.kind) {
      case 'range': case 'seed': v = Number(v); if (!Number.isFinite(v)) throw new Error(`parameter "${d.id}" is not a finite number`); v = clamp(v, d.min ?? -Infinity, d.max ?? Infinity); if (d.kind === 'seed') v = Math.round(v); break;
      case 'select': if (!d.options!.some((o) => o.value === v)) throw new Error(`parameter "${d.id}": "${v}" is not one of ${d.options!.map((o) => o.value).join(', ')}`); break;
      case 'toggle': v = !!v; break;
      case 'color': parseColor(v); v = String(v); break;
      case 'text': v = String(v); break;
      case 'curves': v = validateCurves(v); break;
      case 'gradient': if (!Array.isArray(v) || v.length < 2) throw new Error(`parameter "${d.id}": gradient needs >= 2 stops`); v.forEach((s: any) => { parseColor(s.color); if (!(s.pos >= 0 && s.pos <= 1)) throw new Error('gradient stop pos must be 0..1'); }); break;
    }
    out[d.id] = v;
  }
  return out;
}

/** Wspólne parametry ruchu (plik 09, sekcja 3; proj): `speed` = całkowita liczba cykli na pętlę (pętla domyka się z konstrukcji),
 *  `intensity` = siła ruchu. Długość pętli w sekundach i fps należą do eksportu, nie do silnika. */
export const motionCommon = (intensity = 50): ParamDef[] => [range('speed', 'Speed (cycles per loop)', 1, 1, 8), range('intensity', 'Intensity', intensity, 0, 100, { unit: '%' })];
