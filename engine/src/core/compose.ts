import type { Img, RenderCtx } from './types.ts';
import { blur, clamp, parseColor, resize } from './util.ts';
import { newImg } from './types.ts';

/** Jasnosc/kontrast na zrodle przed mapowaniem tonu (plik 01, sekcja 3). Kontrast wokol 128; neutralny = 0. */
export function adjust(src: Img, brightness: number, contrast: number): Img {
  if (!brightness && !contrast) return src;
  const f = contrast >= 0 ? 1 + contrast / 50 : 1 + contrast / 100; const add = brightness * 2.55;
  const out = new Uint8ClampedArray(src.data.length); const s = src.data;
  for (let i = 0; i < s.length; i += 4) { out[i] = (s[i] - 128) * f + 128 + add; out[i + 1] = (s[i + 1] - 128) * f + 128 + add; out[i + 2] = (s[i + 2] - 128) * f + 128 + add; out[i + 3] = s[i + 3]; }
  return { w: src.w, h: src.h, data: out };
}

/** Rozmycie tla: dla duzych promieni liczone w mniejszej rozdzielczosci (f = promien / 2, max 4) i powiekszane; PSNR vs pelne rozmycie sprawdza test. */
export function fastBlur(src: Img, radius: number): Img {
  const f = Math.min(4, Math.floor(radius / 2)); if (f < 2) return blur(src, radius);
  const small = resize(src, Math.ceil(src.w / f), Math.ceil(src.h / f)); return resize(blur(small, Math.max(1, Math.round(radius / f))), src.w, src.h);
}
/** Tlo za glifami (plik 01: bgMode blur / solid / original / none; UI oryginalu ma tez Opacity tla). */
export function backdrop(ctx: RenderCtx): Img {
  const { w, h } = ctx.src; const mode = ctx.p.bgMode; const [cr, cg, cb] = parseColor(ctx.p.bgColor);
  if (mode === 'solid') return newImg(w, h, [cr, cg, cb, 255]);
  if (mode === 'none') return newImg(w, h, [0, 0, 0, 0]);
  const base = mode === 'original' ? { w, h, data: new Uint8ClampedArray(ctx.src.data) } : fastBlur(ctx.src, Math.round(ctx.p.bgBlur * ctx.scale));
  const k = (ctx.p.bgOpacity ?? 100) / 100; if (k < 1) { const d = base.data; for (let i = 0; i < d.length; i += 4) { d[i] = cr + (d[i] - cr) * k; d[i + 1] = cg + (d[i + 1] - cg) * k; d[i + 2] = cb + (d[i + 2] - cb) * k; } }
  return base;
}
/** Czy komorka ma byc narysowana: deterministyczny hasz, ten sam wynik w kazdej klatce i skali. */
export const cellVisible = (hash: number, coverage: number) => hash < clamp(coverage, 0, 100) / 100;
