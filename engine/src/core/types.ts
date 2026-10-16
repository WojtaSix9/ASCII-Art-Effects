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
  /** Etap 2 (plik 09, sekcja 3): wybrany ruch, faza pętli φ (0 = klatka statyczna) i jego parametry. null = obraz statyczny. */
  motion?: { id: string; phase: number; p: Record<string, any> } | null;
};
/** Ruch efektu (plik 09, sekcja 3). Ruch musi być okresowy w φ z okresem 1 i przy φ = 0 dawać obraz statyczny bit w bit. */
/** onlyIf: ruch działa tylko przy tych wartościach parametru stylu (inaczej klatki są statyczne, a UI pokazuje `note`). */
export type MotionDef = { id: string; name: string; params: ParamDef[]; onlyIf?: { param: string; values: string[]; note: string } };
/** Siatka znaków efektu tekstowego: `rows` wierszy po `cols` znaków, kolor RGB każdej komórki (po ruchu: glint rozjaśnia),
 *  tło (kolor `bgColor`: SVG i TS nie mają rozmytego zdjęcia pod znakami) i wymiary komórki w px renderu. */
/** Siatka znaków z kolorami (eksport SVG/TS). tone: ton komórki użyty przez glint/scan (−1 = pusta); w×h: obraz w px (geometria ruchu). */
export type CellGrid = { cols: number; rows: number; cw: number; ch: number; text: string[]; rgb: Uint8Array; ground: [number, number, number]; tone: Float64Array; w: number; h: number };
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
  text?: (ctx: RenderCtx, tone?: (x: number, y: number, t: number) => void) => string;     // eksport tekstowy (Characters, Block, Braille)
  motions?: MotionDef[];                 // etap 2: ruchy animacji (puste/brak = efekt statyczny)
  cells?: (ctx: RenderCtx) => CellGrid;  // etap 2: siatka znaków z kolorami (eksport SVG i TS); tylko efekty z tekstem
  glyphText?: (p: Record<string, any>) => string;   // znaki, których maski efekt pobierze (aplikacja ładuje dla nich czcionki przed renderem)
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
