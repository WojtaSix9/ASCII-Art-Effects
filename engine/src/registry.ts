import type { EffectDef } from './core/types.ts';
import { GRID_EFFECTS } from './effects/grid.ts';
import { TILE_EFFECTS } from './effects/tile.ts';
import { PIXEL_EFFECTS } from './effects/pixel.ts';
import { DITHER_EFFECTS } from './effects/dither.ts';
export const EFFECTS: EffectDef[] = [...GRID_EFFECTS, ...TILE_EFFECTS, ...PIXEL_EFFECTS, ...DITHER_EFFECTS];
const byId = new Map(EFFECTS.map((e) => [e.id, e]));
if (byId.size !== EFFECTS.length) throw new Error('duplicate effect id in registry');
export const getEffect = (id: string): EffectDef => { const e = byId.get(id); if (!e) throw new Error(`unknown effect "${id}"`); return e; };
