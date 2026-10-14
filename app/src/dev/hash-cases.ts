import type { RenderState } from '../../../engine/src/index.ts';

// Przypadki porównania Node ↔ przeglądarka (wspólne dla generatora i strony /dev/engine).
// Pomijamy Characters: jego piksele zależą od czcionki i rasteryzera.
export const HASH_CASES = (effectIds: string[], postFxIds: string[]): { name: string; state: RenderState }[] => [
  ...effectIds.filter((id) => id !== 'characters').map((id) => ({ name: `style:${id}`, state: { style: { id } } })),
  ...postFxIds.map((fx) => ({ name: `postfx:${fx}`, state: { style: { id: 'pixel' }, postFx: { [fx]: true } } })),
  { name: 'color:sepia', state: { style: { id: 'dots' }, color: { preset: 'sepia' } } },
  { name: 'dither:floyd+pico8', state: { style: { id: 'dither', params: { algorithm: 'floyd', palette: 'pico8' } } } },
];
