import type { RenderState } from '../../../engine/src/index.ts';

// Przypadki porównania Node ↔ przeglądarka (wspólne dla generatora i strony /dev/engine).
// Pomijamy Characters: jego piksele zależą od czcionki i rasteryzera.
// Post FX per glif (charBloom, charChroma) działają tylko w stylach glifowych: sprawdzamy je na Braille (kropki rysowane kodem, bez czcionki).
export const HASH_CASES = (effectIds: string[], postFx: { id: string; glyphOnly?: boolean }[]): { name: string; state: RenderState }[] => [
  ...effectIds.filter((id) => id !== 'characters').map((id) => ({ name: `style:${id}`, state: { style: { id } } })),
  ...postFx.map((fx) => ({ name: `postfx:${fx.id}`, state: { style: { id: fx.glyphOnly ? 'braille' : 'pixel' }, postFx: { [fx.id]: true } } })),
  { name: 'color:sepia', state: { style: { id: 'dots' }, color: { preset: 'sepia' } } },
  { name: 'dither:floyd+pico8', state: { style: { id: 'dither', params: { algorithm: 'floyd', palette: 'pico8' } } } },
];
