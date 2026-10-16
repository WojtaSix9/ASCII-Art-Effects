// Eksport TS w formacie biblioteki ascii.rest („piece”, src/types.ts @ 8fd792e; krok 6C etapu 2). Czysta funkcja: siatka bazowa
// efektu (CellGrid w fazie 0) + ruch → kod modułu TypeScript. Plik jest samowystarczalny (tylko `import type`), a jego funkcja klatki
// liczy glint/scan tym samym wzorem co silnik (effects/grid.ts), więc tekst każdej klatki = tekst silnika w fazie t / loop.
// Kolory (decyzja użytkownika, wariant 1): najwyżej 10 kolorów obrazu × 6 odcieni (bazowy, +35%, +70%; druga trójka dla ciemnej
// strony, u nas taka sama, bo tło jest stałe: meta.ground) = do 60 z 64 kolorów formatu.
import type { CellGrid, Img } from '../core/types.ts';
import { renderCells, type RenderState, type RenderOpts } from '../pipeline.ts';
import { getEffect } from '../registry.ts';
import { medianCut } from './svg.ts';
import { NOISE, LEAN, HEAD, TRAIL, TICKS, SOLID_T, INK_T } from '../effects/grid.ts';

/** Znaki dozwolone przez checker biblioteki poza kategorią scenes (scripts/check.ts @ 8fd792e). */
export const PIECE_CHARSET = /^[\x20-\x7E·°─-▟]*$/;
/** Limit siatki biblioteki dla kategorii innych niż scenes (scripts/check.ts). */
export const PIECE_MAX = { cols: 80, rows: 32 };
/** Opóźnienie pierwszego przejścia w pliku (s), jak START w logo-file.ts ascii.rest: klatka w chwili t = faza (t − START) / loop. */
export const PIECE_START = 0.5;
/** Chwile, w których checker biblioteki próbkuje klatki; chce ≥ 3 różnych przy fps > 0 (scripts/check.ts). */
export const PIECE_SAMPLE_AT = [0, 1, 2, 3, 4, 6];
export type PieceMotion = { id: 'glint' | 'scan'; p: Record<string, number> };
export type PieceOptions = { name: string; note: string; motion: PieceMotion; loop: number; fps: number; maxColors?: number; from?: string };

/** Znaki siatki spoza zestawu biblioteki (puste = można eksportować). */
export const pieceBadChars = (g: CellGrid) => [...new Set([...g.text.join('')])].filter((c) => !PIECE_CHARSET.test(c)).join('');
export const pieceSlug = (name: string) => { const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'picture'; return /^[a-z]/.test(s) ? s : `picture-${s}`; };
const hex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const tintC = (v: number, k: number) => v + (255 - v) * k;   // jak w effects/grid.ts

/** Kod pliku piece. base: siatka efektu w fazie 0 (bez ruchu), najwyżej 80×32 (PIECE_MAX). */
export function pieceSource(base: CellGrid, o: PieceOptions): { code: string; slug: string; colors: number } {
  const { cols, rows } = base; if (cols > PIECE_MAX.cols || rows > PIECE_MAX.rows) throw new Error(`grid ${cols}x${rows} exceeds ${PIECE_MAX.cols}x${PIECE_MAX.rows}`);
  const bad = pieceBadChars(base); if (bad) throw new Error(`characters outside the ascii.rest set: ${bad}`);
  /* kolory komórek z tuszem → ≤ maxColors (median cut); komórki puste nie liczą się do palety */
  const inked: number[] = []; for (let i = 0; i < cols * rows; i++) if (base.text[Math.floor(i / cols)][i % cols] !== ' ') inked.push(i);
  const rgb = new Uint8Array(Math.max(1, inked.length) * 3); inked.forEach((c, k) => rgb.set(base.rgb.subarray(c * 3, c * 3 + 3), k * 3));
  const { palette: pal, index } = medianCut(rgb, Math.min(10, o.maxColors ?? 10)); const n = pal.length;
  const ink = Array.from({ length: rows }, () => Array(cols).fill(' ')); inked.forEach((c, k) => { ink[Math.floor(c / cols)][c % cols] = index[k].toString(36); });
  /* klasa tonu: ' ' ruch nie zmienia znaku, '.' tusz poniżej INK_T, ':' scan może zamienić, '#' glint i scan mogą zamienić */
  const cls = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => { const t = base.tone[y * cols + x]; return base.text[y][x] === ' ' || t < 0 ? ' ' : t >= SOLID_T ? '#' : t >= INK_T ? ':' : '.'; }).join(''));
  const tiers = [0, 0.35, 0.7].flatMap((k) => pal.map((c) => hex(c.map((v) => Math.round(tintC(v, k))))));
  const palette = [...tiers, ...tiers];
  const slug = pieceSlug(o.name); const id = slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()); const Type = id[0].toUpperCase() + id.slice(1);
  const glint = o.motion.id === 'glint'; const opts = glint ? { speed: o.motion.p.speed, pass: o.motion.p.pass, width: o.motion.p.width } : { speed: o.motion.p.speed, pass: o.motion.p.pass };
  const arr = (lines: string[]) => '[\n' + lines.map((l) => `  ${JSON.stringify(l)},`).join('\n') + '\n]';
  const rowsOf = (list: string[]) => { const out: string[] = []; for (let k = 0; k < list.length; k += 6) out.push('    ' + list.slice(k, k + 6).map((h) => JSON.stringify(h)).join(', ') + ','); return out.join('\n'); };
  const name = o.name.toLowerCase().replace(/[^a-z0-9 .+#!_'-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32) || 'picture';
  const motionCode = glint ? `
      if (u < P) {
        const half = width * CW; const at = -half + (W + LEAN * H + 2 * half) * f;
        const d = Math.abs((x + 0.5) * CW + LEAN * (y + 0.5) * CH - at);
        if (d < half) {
          let k = 1 - d / half; k = k * k * (3 - 2 * k);
          level = k > 0.6 ? 2 : k > 0.25 ? 1 : 0;
          if (k > 0.55 && c === "#") ch = "/";
        }
      }` : `
      if (u < P) {
        const d = -HEAD + (rows + HEAD + TRAIL) * f - y; // rows since the line reached this one
        if (d >= 0 && d < HEAD) {
          level = 2;
          if ((c === ":" || c === "#") && hash01(x, y, 977 + tick * 131) < 0.75) ch = NOISE[Math.floor(hash01(y, x, 31 + tick) * NOISE.length)];
        } else if (d >= HEAD && d < HEAD + TRAIL) level = 1;
      }`;
  const code = `/*
 * ${name}: ${o.note}
 *
 * Made with ASCII Art Effects from ${o.from ? o.from.replace(/\*\//g, '') : 'a picture'}. The ${glint ? 'glint' : 'scan line'} follows the logo pieces of ascii.rest
 * (github.com/bas3line/ascii, MIT, Copyright (c) 2026 bas3line), written anew so that the picture repeats exactly every
 * meta.loop seconds. Colours: the picture's ${n} colour${n === 1 ? '' : 's'}, each as is and lightened 35% and 70% for the ${glint ? 'glint' : 'scan'};
 * the second half of the palette repeats the first, as the piece always draws on meta.ground.
 */
import type { Frame, Meta } from "../types.ts";

export interface ${Type}Options {
  [key: string]: unknown;
  /** Passes a loop. */
  speed: number;
  /** Share of each cycle a pass takes, in percent; the rest is still. */
  pass: number;${glint ? `
  /** Half the glint's width, in cells. */
  width: number;` : ''}
}

export const meta = {
  name: ${JSON.stringify(name)},
  category: "effects",
  note: ${JSON.stringify(o.note)},
  cols: ${cols},
  rows: ${rows},
  fps: ${o.fps},
  options: ${JSON.stringify(opts).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ')},
  palette: [
${rowsOf(palette)}
  ],
  ground: ${JSON.stringify(hex(base.ground))},
  loop: ${o.loop},
  still: 0,
} satisfies Meta<${Type}Options>;

// The picture, row by row.
const ART = ${arr(base.text)};
// Each cell's colour: an index into the picture's colours, base 36; a space where the picture is blank.
const INK = ${arr(ink.map((r) => r.join('')))};
// How dark a cell is to the motion: "#" solid, ":" inked, "." faint, a space untouched.
const TONE = ${arr(cls)};

const START = ${PIECE_START}; // seconds before the first pass, as in ascii.rest's logos
const NOISE = ${JSON.stringify(NOISE)}; // what the scan scrambles the picture into
const LEAN = ${LEAN}; // pixels the glint shifts right per pixel down
const HEAD = ${HEAD}; // rows the scan line scrambles
const TRAIL = ${TRAIL}; // rows of afterglow behind it
const TICKS = ${TICKS}; // times the noise changes a pass
const CW = ${base.cw}, CH = ${base.ch}; // a cell in pixels of the picture it was drawn from
const W = ${base.w}, H = ${base.h}; // that picture in pixels

function hash01(x${': number'}, y${': number'}, seed${': number'}) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export default function ${id}({ speed = meta.options.speed, pass = meta.options.pass${glint ? ', width = meta.options.width' : ''} }: Partial<${Type}Options> = {}): Frame {
  const { cols, rows, loop } = meta;
  const n = meta.palette.length / 6;
  return (t, { color } = {}) => {
    // Where in the loop, START seconds late: rounded to 2^-20 of it, as the editor does, so that frames match it exactly.
    const ph = Math.round(((((t - START) / loop) % 1) + 1) % 1 * 1048576) / 1048576;
    const v = speed * ph; const u = v - Math.floor(v); const P = pass / 100; const f = u / P; const tick = Math.floor(u * TICKS);
    const out${': string[]'} = [];
    for (let y = 0; y < rows; y++) {
      let line = "";
      for (let x = 0; x < cols; x++) {
        let ch = ART[y][x]; const c = TONE[y][x]; let level = 0;
        if (c !== " ") {${motionCode.replace(/\n/g, '\n  ')}
        }
        if (color) color[y * cols + x] = 3 * n + level * n + (INK[y][x] === " " ? 0 : parseInt(INK[y][x], 36));
        line += ch;
      }
      out.push(line);
    }
    return out.join("\\n");
  };
}
`;
  return { code, slug, colors: n };
}

/** Siatka do piece: gdy przekracza 80×32, zwiększamy Cell size (gęstość siatki nie zależy od skali), aż się zmieści.
 *  Zwraca stan z nowym cellSize, siatkę bazową (faza 0) i wymiary przed zmianą. */
export function pieceGrid(src: Img, state: RenderState, opts: RenderOpts = {}) {
  const cellsAt = (s: RenderState) => { const c = renderCells(src, { ...s, motion: undefined }, { ...opts, phase: 0 }); if (!c) throw new Error(`effect "${s.style.id}" has no text version`); return c; };
  const p0 = Number(state.style.params?.cellSize ?? getEffect(state.style.id).params.find((q) => q.id === 'cellSize')?.default); let s = state, c = cellsAt(s); const from = { cols: c.cols, rows: c.rows, cellSize: p0 };
  if (c.cols > PIECE_MAX.cols || c.rows > PIECE_MAX.rows) {
    if (!Number.isFinite(p0)) throw new Error(`effect "${state.style.id}" has no cell size to fit ${PIECE_MAX.cols}x${PIECE_MAX.rows}`);
    let cs = Math.max(p0 + 1, Math.ceil(p0 * Math.max(c.cols / PIECE_MAX.cols, c.rows / PIECE_MAX.rows)));
    for (;; cs++) { s = { ...state, style: { ...state.style, params: { ...state.style.params, cellSize: cs } } }; c = cellsAt(s); if (c.cols <= PIECE_MAX.cols && c.rows <= PIECE_MAX.rows) break; if (cs >= 400) throw new Error('cannot fit the grid'); }
  }
  return { state: s, base: c, from, cellSize: Number(s.style.params?.cellSize ?? p0) };
}
