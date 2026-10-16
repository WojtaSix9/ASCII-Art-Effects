import type { RenderState } from '../../../engine/src/index.ts';

// Przypadki porównania Node ↔ przeglądarka (wspólne dla generatora i strony /dev/engine).
// Pomijamy Characters: jego piksele zależą od czcionki i rasteryzera.
// Post FX per glif (charBloom, charChroma) działają tylko w stylach glifowych: sprawdzamy je na Braille (kropki rysowane kodem, bez czcionki).
export const HASH_CASES = (effectIds: string[], postFx: { id: string; glyphOnly?: boolean }[], motions: { effect: string; id: string }[] = []): { name: string; state: RenderState; phase?: number }[] => [
  ...effectIds.filter((id) => !['characters', 'mixed', 'specimen'].includes(id))   /* rysują znaki czcionką: zależą od rasteryzera */
    .map((id) => ({ name: `style:${id}`, state: { style: { id } } })),
  ...postFx.map((fx) => ({ name: `postfx:${fx.id}`, state: { style: { id: fx.glyphOnly ? 'braille' : 'pixel' }, postFx: { [fx.id]: true } } })),
  { name: 'color:sepia', state: { style: { id: 'dots' }, color: { preset: 'sepia' } } },
  { name: 'dither:floyd+pico8', state: { style: { id: 'dither', params: { algorithm: 'floyd', palette: 'pico8' } } } },
  /* etap 2: klatki animacji (faza φ) przez Worker → kanwa, ta sama ścieżka co podgląd */
  ...[0, 0.1, 0.25, 0.5].map((phase) => ({ name: `motion:rgbsplit.pulse@${phase}`, state: { style: { id: 'rgbsplit' }, motion: { id: 'pulse' } } as RenderState, phase })),
  /* Tier A i kolejne: każdy ruch z rejestru w fazie 0,3 (lista ruchów przekazywana przez wywołującego) */
  ...motions.filter((m) => m.effect !== 'rgbsplit' && m.id !== 'glint' && m.id !== 'scan')   /* glint/scan rysują znaki czcionką: zależą od rasteryzera */
    .map((m) => ({ name: `motion:${m.effect}.${m.id}@0.3`, state: { style: { id: m.effect }, motion: { id: m.id } } as RenderState, phase: 0.3 })),
];
