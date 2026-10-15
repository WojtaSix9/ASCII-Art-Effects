// Lights (projekt: docs/07-lights-projekt.md; decyzje użytkownika 15 X 2026: wpływ na strukturę, kolorowe i białe, Ambient).
// Światło oświetla obraz źródłowy PRZED stylem, więc efekt reaguje strukturą (gęstsze znaki, większe kropki).
// Pozycja i zasięg są względne (0–1, % przekątnej), więc wynik nie zależy od skali eksportu.
import type { Img, ParamDef } from '../core/types.ts';
import { color, range } from '../core/params.ts';
import { clamp, parseColor } from '../core/util.ts';

export type Light = { x: number; y: number; radius: number; intensity: number; color: string };
export type LightsState = { lights: Light[]; ambient?: number };
export const MAX_LIGHTS = 4;

/** Parametry jednego światła (panel) i parametr wspólny. Wartości domyślne z pliku 01: Radius 30, Intensity 80. */
export const LIGHT_PARAMS: ParamDef[] = [range('radius', 'Radius', 30, 1, 100, { unit: '%' }), range('intensity', 'Intensity', 80, 0, 100, { unit: '%' }), color('color', 'Colour', '#ffffff')];
export const AMBIENT_PARAM: ParamDef = range('ambient', 'Ambient', 100, 0, 100, { unit: '%' });

/** Sprawdza i normalizuje stan świateł (rzuca błąd jak resolveParams). */
export function resolveLights(s: LightsState): { lights: Light[]; ambient: number } {
  if (!Array.isArray(s.lights)) throw new Error('lights must be an array');
  if (s.lights.length > MAX_LIGHTS) throw new Error(`at most ${MAX_LIGHTS} lights`);
  const num = (v: unknown, lo: number, hi: number, name: string) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error(`light ${name} is not a finite number`); return clamp(n, lo, hi); };
  const lights = s.lights.map((l) => { parseColor(l.color); return { x: num(l.x, 0, 1, 'x'), y: num(l.y, 0, 1, 'y'), radius: num(l.radius, 1, 100, 'radius'), intensity: num(l.intensity, 0, 100, 'intensity'), color: String(l.color) }; });
  return { lights, ambient: num(s.ambient ?? 100, 0, 100, 'ambient') };
}

/** Czy światła cokolwiek zmieniają (brak świateł / zerowa intensywność przy Ambient 100 = bez zmian, ten sam obraz). */
export const lightsActive = (r: { lights: Light[]; ambient: number }) => r.ambient < 100 || r.lights.some((l) => l.intensity > 0);

/**
 * Oświetla obraz. Dla piksela: siła światła L_i = intensity · (1 − d²)² dla d = odległość / zasięg < 1 (gładki zanik do 0),
 * suma L = min(1, Σ L_i), kolor = średnia kolorów świateł ważona L_i.
 * Ambient a: piksel × (a + (1 − a)·L) – poza światłami ciemniej (a < 1). Potem światło jak „screen”: 1 − (1 − p)(1 − L·kolor),
 * więc białe tylko rozjaśnia, kolorowe rozjaśnia swoje kanały i nigdy nie przyciemnia.
 */
export function applyLights(img: Img, state: LightsState): Img {
  const r = resolveLights(state); if (!lightsActive(r)) return img;
  const { w, h } = img; const diag = Math.hypot(w, h); const amb = r.ambient / 100;
  const L = r.lights.map((l) => { const [cr, cg, cb] = parseColor(l.color); return { cx: l.x * w, cy: l.y * h, rad: Math.max(1e-6, (l.radius / 100) * diag), k: l.intensity / 100, cr: cr / 255, cg: cg / 255, cb: cb / 255 }; });
  // Akumulatory na piksel; każde światło przechodzi tylko po swoim prostokącie (poza zasięgiem f = 0), bez pierwiastka.
  const n = w * h; const sum = new Float32Array(n), ar = new Float32Array(n), ag = new Float32Array(n), ab = new Float32Array(n);
  for (const l of L) {
    if (!l.k) continue; const inv = 1 / (l.rad * l.rad);
    const x0 = Math.max(0, Math.floor(l.cx - l.rad)), x1 = Math.min(w - 1, Math.ceil(l.cx + l.rad)), y0 = Math.max(0, Math.floor(l.cy - l.rad)), y1 = Math.min(h - 1, Math.ceil(l.cy + l.rad));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - l.cy, dy2 = dy * dy * inv; if (dy2 >= 1) continue;
      for (let x = x0, o = y * w + x0; x <= x1; x++, o++) {
        const dx = x + 0.5 - l.cx; const d2 = dx * dx * inv + dy2; if (d2 >= 1) continue;
        const q = 1 - d2; const f = l.k * q * q; sum[o] += f; ar[o] += f * l.cr; ag[o] += f * l.cg; ab[o] += f * l.cb;
      }
    }
  }
  const out = new Uint8ClampedArray(img.data.length); const s = img.data;
  for (let o = 0, i = 0; o < n; o++, i += 4) {
    const sm = sum[o]; const Lt = sm < 1 ? sm : 1; const m = amb + (1 - amb) * Lt;
    const k = sm ? Lt / sm : 0; const lr = ar[o] * k, lg = ag[o] * k, lb = ab[o] * k;
    out[i] = 255 - (255 - s[i] * m) * (1 - lr);
    out[i + 1] = 255 - (255 - s[i + 1] * m) * (1 - lg);
    out[i + 2] = 255 - (255 - s[i + 2] * m) * (1 - lb);
    out[i + 3] = s[i + 3];
  }
  return { w, h, data: out };
}
