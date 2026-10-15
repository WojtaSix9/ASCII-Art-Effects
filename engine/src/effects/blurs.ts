// Rozmycie i ostrość (plik 02, sekcja 6): Gaussian Blur, Motion Blur, Radial Blur, Tilt-Shift. Opcje: plik 02 (tam `proj`);
// zakresy, domyślne wartości i wzory: proj. Długości w px skalują się z eksportem; Radial i Tilt-Shift liczą się względem obrazu.
import type { EffectDef, Img, RenderCtx } from '../core/types.ts';
import { common, range, select } from '../core/params.ts';
import { blur, clamp, lerp } from '../core/util.ts';

const px1 = () => [...common('brightness', 'contrast')];
const copy = (s: Img): Img => ({ w: s.w, h: s.h, data: new Uint8ClampedArray(s.data) });
/** Promień pudełka dla trzech przebiegów dającego rozkład o odchyleniu ≈ sigma: sqrt(r(r+1)) ≈ sigma. */
export const boxForSigma = (sigma: number) => Math.round((-1 + Math.sqrt(1 + 4 * sigma * sigma)) / 2);

/** Rozmycie wzdłuż śladu w kilku przebiegach po N = 8 próbek (krok 9, wydajność): przebieg p ma odstęp próbek d·8^p, więc
 *  P przebiegów składa się w równomierny rozkład 8^P punktów (przesunięcia i kąty się dodają; przy zoomie skale się mnożą,
 *  więc rozkład jest równomierny w logarytmie skali). Liczba przebiegów: tyle, żeby odstęp końcowy był ≤ ok. 1 px.
 *  kind: 'line' (stały wektor ux, uy na jednostkę), 'zoom' (log-skala wokół środka), 'spin' (kąt wokół środka). */
function trail(s: Img, kind: 'line' | 'zoom' | 'spin', total: number, trailPx: number, ux = 0, uy = 0, cx = 0, cy = 0, single = 0): Img {
  const N = single || 8;   // single > 0: jeden przebieg z tyloma próbkami, rozstawionymi na całej długości
  const { w, h } = s; const n = w * h; let a = new Float32Array(s.data), b = new Float32Array(a.length);
  const passes = single ? 1 : Math.max(1, Math.min(4, Math.ceil(Math.log(Math.max(2, trailPx)) / Math.log(N))));
  const step = single ? total / (N - 1) : total / Math.pow(N, passes);   // odstęp końcowy (w jednostkach śladu)
  for (let p = 0; p < passes; p++) {
    const d = step * Math.pow(N, p); const off = new Float64Array(N); for (let j = 0; j < N; j++) off[j] = (j - (N - 1) / 2) * d;
    const cs = kind === 'spin' ? off.map(Math.cos) : null, sn = kind === 'spin' ? off.map(Math.sin) : null, sc = kind === 'zoom' ? off.map((u) => Math.exp(-u)) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, bl = 0, al = 0; const px = x + 0.5, py = y + 0.5;
      for (let j = 0; j < N; j++) {
        let sx: number, sy: number;
        if (kind === 'line') { sx = px + ux * off[j]; sy = py + uy * off[j]; }
        else if (kind === 'zoom') { sx = cx + (px - cx) * sc![j]; sy = cy + (py - cy) * sc![j]; }
        else { const dx = px - cx, dy = py - cy; sx = cx + dx * cs![j] - dy * sn![j]; sy = cy + dx * sn![j] + dy * cs![j]; }
        sx -= 0.5; sy -= 0.5; if (sx < 0) sx = 0; else if (sx > w - 1) sx = w - 1; if (sy < 0) sy = 0; else if (sy > h - 1) sy = h - 1;
        const x0 = sx | 0, y0 = sy | 0, tx = sx - x0, ty = sy - y0, x1 = x0 < w - 1 ? x0 + 1 : x0, y1 = y0 < h - 1 ? y0 + 1 : y0;
        const i00 = (y0 * w + x0) * 4, i01 = (y0 * w + x1) * 4, i10 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
        const w00 = (1 - tx) * (1 - ty), w01 = tx * (1 - ty), w10 = (1 - tx) * ty, w11 = tx * ty;
        r += a[i00] * w00 + a[i01] * w01 + a[i10] * w10 + a[i11] * w11; g += a[i00 + 1] * w00 + a[i01 + 1] * w01 + a[i10 + 1] * w10 + a[i11 + 1] * w11;
        bl += a[i00 + 2] * w00 + a[i01 + 2] * w01 + a[i10 + 2] * w10 + a[i11 + 2] * w11; al += a[i00 + 3] * w00 + a[i01 + 3] * w01 + a[i10 + 3] * w10 + a[i11 + 3] * w11;
      }
      const o = (y * w + x) * 4; b[o] = r / N; b[o + 1] = g / N; b[o + 2] = bl / N; b[o + 3] = al / N;
    }
    const t = a; a = b; b = t;
  }
  void n; return { w, h, data: new Uint8ClampedArray(a) };
}

const gaussianblur: EffectDef = {
  id: 'gaussianblur', name: 'Gaussian Blur', category: 'Blur & Focus', engine: 'SHADER', phase: 2,
  description: 'Classic soft blur; the radius is roughly the Gaussian sigma in pixels.',
  params: [range('radius', 'Radius', 8, 0, 100, { unit: 'px', px: true }), ...px1()],
  render(ctx) { const r = boxForSigma(ctx.p.radius * ctx.scale); return r < 1 ? copy(ctx.prep) : blur(ctx.prep, r); },
};
const motionblur: EffectDef = {
  id: 'motionblur', name: 'Motion Blur', category: 'Blur & Focus', engine: 'SHADER', phase: 2,
  description: 'Blur along one direction, as if the camera moved during the shot.',
  params: [range('angle', 'Angle', 0, 0, 360, { unit: '°' }), range('length', 'Length', 30, 0, 200, { unit: 'px', px: true }), range('samples', 'Samples (64 = smooth)', 64, 4, 64, { level: 'advanced' }), ...px1()],
  // średnia równomierna na odcinku długości L wyśrodkowanym na pikselu. Samples 64 (domyślnie) = gładko, przebiegi po 8 próbek;
  // 4–63 przy dłuższym śladzie: jeden przebieg z tyloma kopiami (widoczne „schodki”), koszt rośnie z liczbą próbek.
  render(ctx) {
    const L = ctx.p.length * ctx.scale; if (L < 0.5) return copy(ctx.prep); const a = (ctx.p.angle * Math.PI) / 180; const n = Math.round(ctx.p.samples);
    return trail(ctx.prep, 'line', L, L, Math.cos(a), Math.sin(a), 0, 0, n < 64 && n < L ? n : 0);
  },
};
const radialblur: EffectDef = {
  id: 'radialblur', name: 'Radial Blur', category: 'Blur & Focus', engine: 'SHADER', phase: 2,
  description: 'Blur radiating from a centre: zoom (along rays) or spin (around the centre).',
  params: [select('type', 'Type', 'zoom', [['zoom', 'Zoom'], ['spin', 'Spin']]), range('amount', 'Amount', 40, 0, 100, { unit: '%' }),
    range('centerX', 'Center X', 50, 0, 100, { unit: '%', level: 'advanced' }), range('centerY', 'Center Y', 50, 0, 100, { unit: '%', level: 'advanced' }), ...px1()],
  // zoom: skala od 1 do (1 − 0,35·amount) odległości od środka (równomiernie w logarytmie); spin: łuk ±30°·amount wokół środka
  // (±10° okazało się w teście ledwo widoczne). Przebiegi po 8 próbek, ich liczba z długości śladu najdalszego piksela.
  render(ctx) {
    const k = ctx.p.amount / 100; if (!k) return copy(ctx.prep); const { w, h } = ctx.prep; const cx = (ctx.p.centerX / 100) * w, cy = (ctx.p.centerY / 100) * h;
    const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    if (ctx.p.type === 'spin') { const A = k * (30 * Math.PI) / 180; return trail(ctx.prep, 'spin', 2 * A, far * 2 * A, 0, 0, cx, cy); }
    const U = -Math.log(1 - 0.35 * k); return trail(ctx.prep, 'zoom', U, far * 0.35 * k, 0, 0, cx, cy);
  },
};
const tiltshift: EffectDef = {
  id: 'tiltshift', name: 'Tilt-Shift', category: 'Blur & Focus', engine: 'SHADER', phase: 2,
  description: 'Miniature look: a sharp band, increasingly blurred outside it, with a saturation boost.',
  params: [range('focusPosition', 'Focus position', 55, 0, 100, { unit: '%' }), range('focusWidth', 'Focus width', 20, 0, 100, { unit: '%' }), range('blurAmount', 'Blur', 60, 0, 100, { unit: '%' }),
    range('angle', 'Angle', 0, 0, 180, { unit: '°', level: 'advanced' }), range('saturationBoost', 'Saturation boost', 30, 0, 100, { unit: '%' }), ...px1()],
  // Odległość od linii ostrości (przez punkt na wysokości focusPosition, pod kątem angle) w ułamkach krótszego boku.
  // Ostry pas ±focusWidth/2; dalej przejście (0,25 krótszego boku) przez dwa poziomy rozmycia: R/3, potem R, R = 3% krótszego boku × blur.
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const m = Math.min(w, h); const R = (ctx.p.blurAmount / 100) * 0.03 * m;
    const b1 = R >= 1 ? blur(s, boxForSigma(R / 3)) : copy(s), b2 = R >= 1 ? blur(s, boxForSigma(R)) : copy(s);
    const a = (ctx.p.angle * Math.PI) / 180; const nx = -Math.sin(a), ny = Math.cos(a); const px = w / 2, py = (ctx.p.focusPosition / 100) * h;
    const half = (ctx.p.focusWidth / 100) * 0.5 * h / m, tr = 0.25; const sat = 1 + ctx.p.saturationBoost / 100; const d = s.data, out = new Uint8ClampedArray(d.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const dist = Math.abs((x + 0.5 - px) * nx + (y + 0.5 - py) * ny) / m;
      const t = clamp((dist - half) / tr, 0, 1); const q = t * t * (3 - 2 * t);
      for (let c = 0; c < 3; c++) out[i + c] = q <= 0.5 ? lerp(d[i + c], b1.data[i + c], q * 2) : lerp(b1.data[i + c], b2.data[i + c], q * 2 - 1);
      out[i + 3] = d[i + 3];
      if (sat !== 1) { const L = 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2]; for (let c = 0; c < 3; c++) out[i + c] = L + (out[i + c] - L) * sat; }
    }
    return { w, h, data: out };
  },
};
export const BLUR_EFFECTS: EffectDef[] = [motionblur, tiltshift, gaussianblur, radialblur];
