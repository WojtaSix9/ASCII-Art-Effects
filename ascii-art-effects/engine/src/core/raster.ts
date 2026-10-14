import type { Img } from './types.ts';
import { clamp, over } from './util.ts';

/** Rysuje ksztalt zadany polem odleglosci ze znakiem (sd < 0 wewnatrz) z antyaliasingiem 1 px, w prostokacie [x0,x1) x [y0,y1). */
export function paintSDF(img: Img, x0: number, y0: number, x1: number, y1: number, sd: (px: number, py: number) => number, r: number, g: number, b: number, alpha = 1) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(img.w, x1); y1 = Math.min(img.h, y1);
  const d = img.data;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const a = clamp(0.5 - sd(x + 0.5, y + 0.5), 0, 1) * alpha;
    if (a > 0) over(d, (y * img.w + x) * 4, r, g, b, a);
  }
}
export function fillRect(img: Img, x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, alpha = 1) {
  x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0)); x1 = Math.min(img.w, Math.round(x1)); y1 = Math.min(img.h, Math.round(y1));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) over(img.data, (y * img.w + x) * 4, r, g, b, alpha);
}
export const sdBox = (px: number, py: number, hx: number, hy: number) => { const dx = Math.abs(px) - hx, dy = Math.abs(py) - hy; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); };
export const rot = (x: number, y: number, a: number): [number, number] => { const c = Math.cos(a), s = Math.sin(a); return [x * c + y * s, -x * s + y * c]; };
