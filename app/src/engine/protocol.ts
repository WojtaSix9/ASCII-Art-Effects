// Komunikaty między stroną a Workerem silnika. Obrazy przechodzą jako ArrayBuffer (transfer, bez kopii).
import type { RenderState, EffectInfo, ParamDef, TextBox } from '../../../engine/src/index.ts';

export type WireImg = { w: number; h: number; buffer: ArrayBuffer };

export type Req =
  | { type: 'init' }
  | { type: 'defs' }                                                 // definicje efektów (parametry do budowy panelu)
  | { type: 'postDefs' }                                             // definicje Post FX i Color
  | { type: 'export'; state: RenderState; scale: number; format: 'png' | 'jpeg'; quality?: number }
  /** Etap 2: animacja (stan z ruchem), n klatek faz i/n, fps; postęp przychodzi wiadomościami Progress. */
  | { type: 'exportAnim'; state: RenderState; scale: number; frames: number; fps: number; format: 'gif' | 'mp4' | 'svg'; codec?: 'avc' | 'vp9'; dither?: boolean; embedFont?: boolean }
  | { type: 'svgInfo'; state: RenderState }
  /** Etap 2, krok 6C: plik TS (piece ascii.rest). dryRun: tylko opis (siatka po dopasowaniu do 80×32, znaki spoza zestawu), bez kodu. */
  | { type: 'piece'; state: RenderState; loop: number; fps: number; dryRun?: boolean }                          // siatka znaków efektu (kolumny × wiersze) dla okna eksportu SVG
  | { type: 'mp4Support'; w: number; h: number }                     // czy Worker zakoduje H.264 (i VP9, testy) w tych wymiarach
  | { type: 'webcodecs' }                                              // dev: tabela VideoEncoder.isConfigSupported
  | { type: 'cancel'; target: number }                                  // przerywa zlecenie `target` (exportAnim) przy najbliższej klatce
  | { type: 'setSource'; img: WireImg }
  | { type: 'render'; state: RenderState; scale?: number; phase?: number }   // phase: faza pętli animacji (etap 2)
  | { type: 'testImage'; w: number; h: number }                       // dev: syntetyczny obraz testowy jako źródło
  | { type: 'coverage' }                                              // dev: pokrycie znaków presetów
  | { type: 'hashes' }                                                // dev: SHA-1 renderów (porównanie z Node)
  | { type: 'bench'; w: number; h: number; runs: number }             // dev: czasy efektów i post FX
  | { type: 'gc' };                                                   // dev: wymuszenie GC (tylko z --js-flags=--expose-gc)

export type InitRes = { fonts: { family: string; faces: number; loaded: number }[]; fontMs: number; workerFonts: boolean; offscreen: boolean };
export type EffectMeta = { id: string; name: string; category: string; params: ParamDef[]; motions?: { id: string; name: string; params: ParamDef[] }[]; cells?: boolean };
export type PostDefs = { postFx: { id: string; name: string; params: ParamDef[]; glyphOnly?: boolean }[]; glyphStyles: string[]; color: ParamDef[]; lights: { params: ParamDef[]; ambient: ParamDef; max: number; skip: string[] };
  text: { params: ParamDef[]; fonts: { id: string; name: string; weights: number[] }[]; max: number } };
export type ExportRes = { blob: Blob; w: number; h: number; ms: number; cols?: number; rows?: number; fontMissing?: string };
export type PieceRes = { from: { cols: number; rows: number; cellSize: number }; cols: number; rows: number; cellSize: number; bad: string; distinct: number; code?: string; slug?: string; colors?: number };
export type WebCodecsRow = { codec: string; label: string; w: number; h: number; supported: boolean | null };
/** Błąd zlecenia przerwanego przez cancel. */
export const CANCELLED = 'CANCELLED';
/** Błąd eksportu MP4, gdy przeglądarka nie koduje wybranego kodeka (NO_CODEC:avc). */
export const NO_CODEC = 'NO_CODEC';
/** Błąd eksportu, gdy przeglądarka nie utworzy kanwy tej wielkości (limit pamięci/kanwy, np. Safari na iOS). */
export const LIMIT_ERROR = 'CANVAS_LIMIT';
export type RenderRes = { img: WireImg; info: EffectInfo; ms: number; textBoxes?: (TextBox | null)[] };
/** Źródło znaku: rysowany kodem, jedna z czcionek (kolejność stosu), czcionka zastępcza urządzenia albo nic (tofu). */
export type GlyphSource = 'drawn' | 'Geist Mono' | 'Noto Sans Mono' | 'Noto Sans JP' | 'fallback' | 'missing';
export type CoverageRow = { preset: string; chars: Record<string, GlyphSource> };
export type CoverageRes = { rows: CoverageRow[]; controls: { latinA: GlyphSource; privateUse: GlyphSource } };
export type BenchRes = { w: number; h: number; runs: number; rows: { name: string; ms: number }[] };
export type HeapRes = { usedJSHeapSize: number | null };

export type Msg = { id: number } & Req;
export type Reply = { id: number; ok: true; data: unknown } | { id: number; ok: false; error: string };
/** Postęp długiego zlecenia (exportAnim); nie kończy wywołania. */
export type Progress = { id: number; progress: { done: number; total: number } };
