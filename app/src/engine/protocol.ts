// Komunikaty między stroną a Workerem silnika. Obrazy przechodzą jako ArrayBuffer (transfer, bez kopii).
import type { RenderState, EffectInfo, ParamDef } from '../../../engine/src/index.ts';

export type WireImg = { w: number; h: number; buffer: ArrayBuffer };

export type Req =
  | { type: 'init' }
  | { type: 'defs' }                                                 // definicje efektów (parametry do budowy panelu)
  | { type: 'postDefs' }                                             // definicje Post FX i Color
  | { type: 'export'; state: RenderState; scale: number; format: 'png' | 'jpeg'; quality?: number }
  | { type: 'setSource'; img: WireImg }
  | { type: 'render'; state: RenderState; scale?: number }
  | { type: 'testImage'; w: number; h: number }                       // dev: syntetyczny obraz testowy jako źródło
  | { type: 'coverage' }                                              // dev: pokrycie znaków presetów
  | { type: 'hashes' }                                                // dev: SHA-1 renderów (porównanie z Node)
  | { type: 'bench'; w: number; h: number; runs: number }             // dev: czasy efektów i post FX
  | { type: 'gc' };                                                   // dev: wymuszenie GC (tylko z --js-flags=--expose-gc)

export type InitRes = { fonts: { family: string; faces: number; loaded: number }[]; fontMs: number; workerFonts: boolean; offscreen: boolean };
export type EffectMeta = { id: string; name: string; category: string; params: ParamDef[] };
export type PostDefs = { postFx: { id: string; name: string; params: ParamDef[] }[]; color: ParamDef[] };
export type ExportRes = { blob: Blob; w: number; h: number; ms: number };
/** Błąd eksportu, gdy przeglądarka nie utworzy kanwy tej wielkości (limit pamięci/kanwy, np. Safari na iOS). */
export const LIMIT_ERROR = 'CANVAS_LIMIT';
export type RenderRes = { img: WireImg; info: EffectInfo; ms: number };
/** Źródło znaku: rysowany kodem, jedna z czcionek (kolejność stosu), czcionka zastępcza urządzenia albo nic (tofu). */
export type GlyphSource = 'drawn' | 'Geist Mono' | 'Noto Sans Mono' | 'Noto Sans JP' | 'fallback' | 'missing';
export type CoverageRow = { preset: string; chars: Record<string, GlyphSource> };
export type CoverageRes = { rows: CoverageRow[]; controls: { latinA: GlyphSource; privateUse: GlyphSource } };
export type BenchRes = { w: number; h: number; runs: number; rows: { name: string; ms: number }[] };
export type HeapRes = { usedJSHeapSize: number | null };

export type Msg = { id: number } & Req;
export type Reply = { id: number; ok: true; data: unknown } | { id: number; ok: false; error: string };
