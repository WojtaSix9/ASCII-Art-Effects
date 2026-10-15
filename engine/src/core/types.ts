// Rdzen silnika (proj). Obraz = bufor RGBA 8 bit, bez DOM: dziala w Node i w przegladarce (Web Worker).
export type Img = { w: number; h: number; data: Uint8ClampedArray };

export type ParamKind = 'range' | 'select' | 'toggle' | 'color' | 'text' | 'seed' | 'gradient' | 'curves';
export type ParamDef = {
  id: string; label: string; kind: ParamKind; default: any;
  min?: number; max?: number; step?: number;
  options?: { value: string; label: string }[];
  level?: 'main' | 'advanced';          // 3 poziomy opcji (plik 02): glowne, zaawansowane; seed ma kind 'seed'
  unit?: string;
  px?: boolean;                         // wartosc w px przy skali 1x: mnozona przez skale eksportu
};

export type EffectInfo = Record<string, number | string>;
export type RenderCtx = {
  src: Img;                              // zrodlo juz po przeskalowaniu do skali renderu
  prep: Img;                             // zrodlo po brightness/contrast (dla efektow uzywajacych parametrow wspolnych)
  p: Record<string, any>;                // wartosci parametrow (domyslne uzupelnione, zakresy obciete)
  scale: number;                         // skala eksportu (1 = podglad)
  glyphs: GlyphProvider | null;          // maski znakow (tylko efekty tekstowe)
  info: EffectInfo;                      // efekt wpisuje tu np. liczbe komorek (do testow)
  glyphFx?: { bloom: number; chroma: number } | null;   // charBloom/charChroma (src/post/glyphfx.ts); null = wyłączone
  px: (v: number) => number;             // v px przy skali 1x -> px przy biezacej skali (min 1)
};
export interface GlyphProvider {
  /** Alfa-maska znaku w prostokacie w x h (Uint8Array w*h), znak wysrodkowany; font px = fontPx. */
  mask(ch: string, w: number, h: number, fontPx: number): Uint8Array;
}
export type EffectDef = {
  id: string; name: string; category: string; engine: 'GRID' | 'TILE' | 'SHADER' | 'GEOM' | 'STATE' | '3D';
  phase: 1 | 2 | 3; description: string;
  params: ParamDef[];
  needsGlyphs?: boolean;
  render: (ctx: RenderCtx) => Img;
  text?: (ctx: RenderCtx) => string;     // eksport tekstowy (Characters, Block, Braille)
};
export type PostFxDef = {
  id: string; name: string; params: ParamDef[]; glyphOnly?: boolean;
  apply: (img: Img, p: Record<string, any>, scale: number, seed: number) => Img;
};
export const newImg = (w: number, h: number, fill: [number, number, number, number] = [0, 0, 0, 255]): Img => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = fill[3]; }
  return { w, h, data };
};
export const cloneImg = (a: Img): Img => ({ w: a.w, h: a.h, data: new Uint8ClampedArray(a.data) });
