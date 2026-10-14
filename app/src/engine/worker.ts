/// <reference lib="webworker" />
// Silnik efektów w Web Workerze. Glify: OffscreenCanvas + Geist Mono załadowany w Workerze przed pierwszym renderem
// (inaczej cache masek w canvasGlyphs zapamiętałby znaki z czcionki zastępczej).
import { render, EFFECTS, POSTFX, CHARSETS, canvasGlyphs } from '../../../engine/src/index.ts';
import type { GlyphProvider, Img } from '../../../engine/src/index.ts';
import { testImage } from '../../../engine/scripts/make-test-image.ts';
import { HASH_CASES } from '../dev/hash-cases.ts';
import { loadGlyphFont, GLYPH_STACK } from './fonts.ts';
import type { Msg, Reply, Req, WireImg, InitRes, CoverageRes, BenchRes, HeapRes } from './protocol.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope & { fonts?: FontFaceSet; gc?: () => void };
let glyphs: GlyphProvider | null = null;
let source: Img | null = null;
let ready: Promise<InitRes> | null = null;

const toImg = (w: WireImg): Img => ({ w: w.w, h: w.h, data: new Uint8ClampedArray(w.buffer) });
const toWire = (i: Img): WireImg => ({ w: i.w, h: i.h, buffer: i.data.buffer as ArrayBuffer });

function init(): Promise<InitRes> {
  return (ready ??= (async () => {
    const workerFonts = !!scope.fonts;
    const fonts = workerFonts ? await loadGlyphFont(scope.fonts!) : { family: 'Geist Mono', faces: 0, loaded: 0, ms: 0 };
    glyphs = canvasGlyphs((w, h) => new OffscreenCanvas(w, h), GLYPH_STACK);
    return { fonts, workerFonts, offscreen: typeof OffscreenCanvas === 'function' };
  })());
}

// Klasyfikacja znaku: czy rysuje go Geist Mono, czcionka zastępcza urządzenia, czy nic (tofu / pusto).
// Porównanie masek: "Geist Mono" vs nieistniejąca rodzina (obie bez rodziny ogólnej, więc mają tę samą ścieżkę zastępczą).
// Jeśli maski są identyczne, Geist Mono znaku nie ma. Tofu: maska równa masce znaku z obszaru prywatnego U+10FFFD.
const S = 64;
const ctx = new OffscreenCanvas(S, S).getContext('2d', { willReadFrequently: true })!;
function mask(ch: string, family: string) {
  ctx.clearRect(0, 0, S, S); ctx.font = `48px ${family}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
  ctx.fillText(ch, S / 2, S * 0.8);
  const d = ctx.getImageData(0, 0, S, S).data; const m = new Uint8Array(S * S);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
  return m;
}
const same = (a: Uint8Array, b: Uint8Array) => a.every((v, i) => v === b[i]);
const empty = (a: Uint8Array) => a.every((v) => v === 0);
function classify(ch: string): 'geist' | 'fallback' | 'missing' {
  const absent = '"__no_such_font__"';
  const fb = mask(ch, absent);
  if (!same(mask(ch, '"Geist Mono"'), fb)) return 'geist';
  return empty(fb) || same(fb, mask('\u{10FFFD}', absent)) ? 'missing' : 'fallback';
}

async function sha1(data: Uint8ClampedArray) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', data as unknown as ArrayBuffer));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function median(f: () => void, runs: number) {
  f(); const t: number[] = [];
  for (let i = 0; i < runs; i++) { const s = performance.now(); f(); t.push(performance.now() - s); }
  return t.sort((a, b) => a - b)[Math.floor(runs / 2)];
}

async function handle(req: Req): Promise<{ data: unknown; transfer?: Transferable[] }> {
  if (req.type === 'init') return { data: await init() };
  await init();
  switch (req.type) {
    case 'setSource': source = toImg(req.img); return { data: { w: source.w, h: source.h } };
    case 'testImage': source = testImage(req.w, req.h); return { data: { w: source.w, h: source.h } };
    case 'render': {
      if (!source) throw new Error('no source image');
      const t = performance.now(); const r = render(source, req.state, { scale: req.scale ?? 1, glyphs });
      const ms = performance.now() - t;
      const img = r.img.data.buffer === source.data.buffer ? { ...r.img, data: new Uint8ClampedArray(r.img.data) } : r.img;
      return { data: { img: toWire(img), info: r.info, ms }, transfer: [img.data.buffer as ArrayBuffer] };
    }
    case 'coverage': {
      const rows = Object.entries(CHARSETS).map(([preset, cs]) => {
        const r = { preset, geist: '', fallback: '', missing: '' };
        for (const ch of new Set(cs.ramp)) if (ch !== ' ') r[classify(ch)] += ch;
        return r;
      });
      return { data: { rows, controls: { latinA: classify('A'), privateUse: classify('\u{10FFFD}') } } satisfies CoverageRes };
    }
    case 'hashes': {
      const src = testImage(300, 200); const out: Record<string, string> = {};
      for (const c of HASH_CASES(EFFECTS.map((e) => e.id), POSTFX.map((f) => f.id))) out[c.name] = await sha1(render(src, c.state).img.data);
      return { data: out };
    }
    case 'bench': {
      const src = testImage(req.w, req.h); const rows: BenchRes['rows'] = [];
      for (const e of EFFECTS) rows.push({ name: e.id, ms: median(() => render(src, { style: { id: e.id } }, { glyphs }), req.runs) });
      for (const f of POSTFX) rows.push({ name: `pixel + ${f.id}`, ms: median(() => render(src, { style: { id: 'pixel' }, postFx: { [f.id]: true } }, { glyphs }), req.runs) });
      return { data: { w: src.w, h: src.h, runs: req.runs, rows } satisfies BenchRes };
    }
    case 'gc': {
      scope.gc?.();
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      return { data: { usedJSHeapSize: mem ? mem.usedJSHeapSize : null } satisfies HeapRes };
    }
  }
}

scope.onmessage = async (e: MessageEvent<Msg>) => {
  const { id } = e.data;
  try {
    const { data, transfer } = await handle(e.data);
    scope.postMessage({ id, ok: true, data } satisfies Reply, transfer ?? []);
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies Reply);
  }
};
