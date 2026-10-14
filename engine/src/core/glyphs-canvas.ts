// Dostawca masek znakow oparty o dowolna kanwe 2D (OffscreenCanvas w przegladarce, @napi-rs/canvas w Node). proj.
// Czcionka: w przegladarce webfont zaladowany przez strone (decyzja: webfont z npm); w Node czcionka systemowa.
import type { GlyphProvider } from './types.ts';
import { drawnGlyphMask } from './glyphs-drawn.ts';
export type CanvasFactory = (w: number, h: number) => { getContext(t: '2d'): any };
export function canvasGlyphs(createCanvas: CanvasFactory, fontFamily: string): GlyphProvider {
  const cache = new Map<string, Uint8Array>();
  return {
    mask(ch, w, h, fontPx) {
      const key = `${ch}|${w}|${h}|${fontPx}`; const hit = cache.get(key); if (hit) return hit;
      const drawn = drawnGlyphMask(ch, w, h); if (drawn) { cache.set(key, drawn); return drawn; }   // Braille, Dots, Geometric: bez czcionki
      const c = createCanvas(w, h); const g = c.getContext('2d');
      g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `${fontPx}px ${fontFamily}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText(ch, w / 2, h * 0.8);
      const d = g.getImageData(0, 0, w, h).data; const m = new Uint8Array(w * h);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
      cache.set(key, m); return m;
    },
  };
}
