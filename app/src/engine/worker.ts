/// <reference lib="webworker" />
// Silnik efektów w Web Workerze. Glify: OffscreenCanvas + Geist Mono załadowany w Workerze przed pierwszym renderem
// (inaczej cache masek w canvasGlyphs zapamiętałby znaki z czcionki zastępczej).
import { render, renderCells, animatedSvg, EFFECTS, POSTFX, COLOR_PARAMS, CHARSETS, canvasGlyphs, getEffect, isDrawnGlyph, LIGHT_PARAMS, AMBIENT_PARAM, MAX_LIGHTS, NO_LIGHTS, GLYPH_STYLES, cropRect, canvasText, TEXT_PARAMS, TEXT_FONTS, MAX_TEXTS } from '../../../engine/src/index.ts';
import type { GlyphProvider, Img, RenderState, TextRenderer } from '../../../engine/src/index.ts';
import { testImage } from '../../../engine/scripts/make-test-image.ts';
import { HASH_CASES } from '../dev/hash-cases.ts';
import { loadGlyphFonts, ensureGlyphs, GLYPH_FONTS, GLYPH_STACK, registerTextFonts, ensureText, TEXT_STACKS, svgFontFor } from './fonts.ts';
import { LIMIT_ERROR } from './protocol.ts';
import type { Msg, Reply, Req, WireImg, InitRes, CoverageRes, BenchRes, HeapRes, GlyphSource, EffectMeta, PostDefs, ExportRes, Progress, WebCodecsRow } from './protocol.ts';
import { CANCELLED, NO_CODEC } from './protocol.ts';
import { encodeGif } from './gif.ts';
/* MP4 (Mediabunny, ok. 190 kB) ładowany dopiero przy eksporcie lub sprawdzeniu kodeka */
const mp4 = () => import('./mp4.ts');

const scope = self as unknown as DedicatedWorkerGlobalScope & { fonts?: FontFaceSet; gc?: () => void };
let glyphs: GlyphProvider | null = null;
let textR: TextRenderer | null = null;
let source: Img | null = null;
let ready: Promise<InitRes> | null = null;

const toImg = (w: WireImg): Img => ({ w: w.w, h: w.h, data: new Uint8ClampedArray(w.buffer) });
const toWire = (i: Img): WireImg => ({ w: i.w, h: i.h, buffer: i.data.buffer as ArrayBuffer });

function init(): Promise<InitRes> {
  return (ready ??= (async () => {
    const workerFonts = !!scope.fonts;
    const f = workerFonts ? await loadGlyphFonts(scope.fonts!) : { fonts: [], ms: 0 };
    glyphs = canvasGlyphs((w, h) => new OffscreenCanvas(w, h), GLYPH_STACK);
    if (workerFonts) registerTextFonts(scope.fonts!);
    textR = canvasText((w, h) => new OffscreenCanvas(w, h), TEXT_STACKS);
    return { fonts: f.fonts, fontMs: f.ms, workerFonts, offscreen: typeof OffscreenCanvas === 'function' };
  })());
}

// Znaki rampy Characters (i efektów z glyphText) dla danego stanu (do pobrania potrzebnych podzbiorów czcionek przed renderem).
const CHAR_DEFAULTS = Object.fromEntries(getEffect('characters').params.map((p) => [p.id, p.default]));
const STUDIO_DEFAULTS = Object.fromEntries(getEffect('asciiStudio').params.map((p) => [p.id, p.default]));
function rampText(state: RenderState) {
  if (state.style.id === 'asciiStudio') { const p = { ...STUDIO_DEFAULTS, ...state.style.params }; return p.glyph === 'characters' ? CHARSETS[p.charSet]?.ramp ?? '' : ''; }   // ASCII Studio w trybie znaków
  const def = getEffect(state.style.id); if (def.glyphText) return def.glyphText({ ...Object.fromEntries(def.params.map((q) => [q.id, q.default])), ...state.style.params });   // Mixed, Specimen
  if (state.style.id !== 'characters') return '';
  const p = { ...CHAR_DEFAULTS, ...state.style.params };
  return p.charSet === 'custom' ? String(p.chars) : CHARSETS[p.charSet]?.ramp ?? '';
}
const ensure = (text: string) => (scope.fonts ? ensureGlyphs(scope.fonts, text) : Promise.resolve());
const ensureTexts = (state: RenderState) => (scope.fonts ? ensureText(scope.fonts, state.text) : Promise.resolve());

// Klasyfikacja znaku: rysowany kodem, która czcionka ze stosu go ma, czcionka zastępcza urządzenia albo nic (tofu / pusto).
// Porównanie masek: dana rodzina vs nieistniejąca rodzina (obie bez rodziny ogólnej, więc mają tę samą ścieżkę zastępczą).
// Jeśli maski są identyczne, rodzina znaku nie ma. Tofu: maska równa masce znaku z obszaru prywatnego U+10FFFD.
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
function classify(ch: string): GlyphSource {
  if (isDrawnGlyph(ch)) return 'drawn';
  const absent = '"__no_such_font__"';
  const fb = mask(ch, absent);
  for (const f of GLYPH_FONTS) if (!same(mask(ch, `"${f.family}"`), fb)) return f.family;
  return empty(fb) || same(fb, mask('\u{10FFFD}', absent)) ? 'missing' : 'fallback';
}

/** Czy przeglądarka utworzy kanwę w×h (limity różnią się między przeglądarkami; Safari na iOS ma najniższe). */
function canvasFits(w: number, h: number) {
  try {
    const c = new OffscreenCanvas(w, h); const g = c.getContext('2d'); if (!g) return false;
    g.fillStyle = '#fff'; g.fillRect(w - 1, h - 1, 1, 1); return g.getImageData(w - 1, h - 1, 1, 1).data[3] === 255;
  } catch { return false; }
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

const cancelled = new Set<number>();   // id zleceń exportAnim do przerwania
async function handle(req: Req, id = 0): Promise<{ data: unknown; transfer?: Transferable[] }> {
  if (req.type === 'init') return { data: await init() };
  await init();
  switch (req.type) {
    case 'defs': return { data: EFFECTS.map((e) => ({ id: e.id, name: e.name, category: e.category, params: e.params, motions: e.motions, cells: !!e.cells })) satisfies EffectMeta[] };
    case 'postDefs': return { data: { postFx: POSTFX.map((f) => ({ id: f.id, name: f.name, params: f.params, glyphOnly: f.glyphOnly })), glyphStyles: [...GLYPH_STYLES], color: COLOR_PARAMS, lights: { params: LIGHT_PARAMS, ambient: AMBIENT_PARAM, max: MAX_LIGHTS, skip: [...NO_LIGHTS] }, text: { params: TEXT_PARAMS, fonts: TEXT_FONTS, max: MAX_TEXTS } } satisfies PostDefs };
    case 'export': {
      if (!source) throw new Error('no source image');
      const r0 = req.state.crop ? cropRect(source.w, source.h, req.state.crop) : { sw: source.w, sh: source.h };   // kadr zmienia wymiary eksportu
      const w = Math.round(r0.sw * req.scale), h = Math.round(r0.sh * req.scale);
      if (!canvasFits(w, h)) throw new Error(`${LIMIT_ERROR}:${w}x${h}`);
      await ensure(rampText(req.state)); await ensureTexts(req.state);
      const t = performance.now(); const r = render(source, req.state, { scale: req.scale, glyphs, text: textR });
      const c = new OffscreenCanvas(r.img.w, r.img.h); const g = c.getContext('2d')!;
      g.putImageData(new ImageData(new Uint8ClampedArray(r.img.data), r.img.w, r.img.h), 0, 0);
      if (req.format === 'jpeg') { g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#000'; g.fillRect(0, 0, r.img.w, r.img.h); }  // JPG bez alfy: tło czarne
      const blob = await c.convertToBlob({ type: `image/${req.format}`, quality: req.quality ?? 0.92 });
      return { data: { blob, w: r.img.w, h: r.img.h, ms: performance.now() - t } satisfies ExportRes };
    }
    case 'exportAnim': {
      if (!source) throw new Error('no source image');
      const r0 = req.state.crop ? cropRect(source.w, source.h, req.state.crop) : { sw: source.w, sh: source.h };
      const w = Math.round(r0.sw * req.scale), h = Math.round(r0.sh * req.scale);
      await ensure(rampText(req.state)); await ensureTexts(req.state);
      const t = performance.now(); const src = source;
      /* przerwanie: między klatkami oddajemy sterowanie pętli zdarzeń, żeby dotarła wiadomość cancel */
      const frame = async (i: number) => { await new Promise((r) => setTimeout(r, 0)); if (cancelled.has(id)) throw new Error(CANCELLED); return new Uint8ClampedArray(render(src, req.state, { scale: req.scale, glyphs, text: textR, phase: i / req.frames }).img.data); };
      const prog = (done: number, total: number) => scope.postMessage({ id, progress: { done, total } } satisfies Progress);
      try {
        if (req.format === 'svg') {   // krok 6B: siatka znaków efektu w skali 1 (gęstość siatki nie zależy od skali), bez Post FX, Color i napisów
          const frames = []; for (let i = 0; i < req.frames; i++) { await new Promise((r) => setTimeout(r, 0)); if (cancelled.has(id)) throw new Error(CANCELLED);
            const c = renderCells(src, req.state, { glyphs, phase: i / req.frames }); if (!c) throw new Error(`effect "${req.state.style.id}" has no text version`); frames.push(c); prog(i + 1, req.frames); }
          const font = req.embedFont ? await svgFontFor(frames.map((f) => f.text.join('')).join('')) : null;
          const svg = animatedSvg(frames, { fps: req.fps, font, title: `ASCII Art Effects: ${getEffect(req.state.style.id).name}` }); const f0 = frames[0];
          return { data: { blob: new Blob([svg], { type: 'image/svg+xml' }), w: f0.cols * 10, h: Math.round(f0.rows * 10 * f0.ch / f0.cw), ms: performance.now() - t, cols: f0.cols, rows: f0.rows, fontMissing: font?.missing } satisfies ExportRes };
        }
        if (req.format === 'mp4') {
          const { encodeMp4, evenDims, mp4Supported } = await mp4(); const e = evenDims(w, h); const codec = req.codec ?? 'avc';
          if (!(await mp4Supported(codec, e.w, e.h))) throw new Error(`${NO_CODEC}:${codec}`);
          const bytes = await encodeMp4(frame, req.frames, w, e.w, e.h, req.fps, codec, prog, () => cancelled.has(id));
          return { data: { blob: new Blob([bytes as BlobPart], { type: 'video/mp4' }), w: e.w, h: e.h, ms: performance.now() - t } satisfies ExportRes };
        }
        const bytes = await encodeGif(frame, req.frames, w, h, req.fps, prog, () => cancelled.has(id), !!req.dither);
        return { data: { blob: new Blob([bytes as BlobPart], { type: 'image/gif' }), w, h, ms: performance.now() - t } satisfies ExportRes };
      } finally { cancelled.delete(id); }
    }
    case 'svgInfo': { if (!source) throw new Error('no source image'); await ensure(rampText(req.state)); const c = renderCells(source, { ...req.state, motion: undefined }, { glyphs }); return { data: c ? { cols: c.cols, rows: c.rows } : null }; }
    case 'cancel': cancelled.add(req.target); return { data: true };
    case 'mp4Support': { const { evenDims, mp4Supported } = await mp4(); const e = evenDims(req.w, req.h); return { data: { avc: await mp4Supported('avc', e.w, e.h), vp9: await mp4Supported('vp9', e.w, e.h), w: e.w, h: e.h } }; }
    case 'webcodecs': {
      const rows: WebCodecsRow[] = []; const VE = (self as any).VideoEncoder;
      for (const [codec, label] of [['avc1.640028', 'H.264 High 4.0'], ['avc1.4d0028', 'H.264 Main 4.0'], ['avc1.42001f', 'H.264 Baseline 3.1'], ['vp09.00.10.08', 'VP9'], ['av01.0.08M.08', 'AV1']]) for (const [w, h] of [[1080, 720], [720, 480], [480, 320]])
        rows.push({ codec, label, w, h, supported: VE ? (await VE.isConfigSupported({ codec, width: w, height: h, bitrate: 8e6, framerate: 24 })).supported : null });
      return { data: rows };
    }
    case 'setSource': source = toImg(req.img); return { data: { w: source.w, h: source.h } };
    case 'testImage': source = testImage(req.w, req.h); return { data: { w: source.w, h: source.h } };
    case 'render': {
      if (!source) throw new Error('no source image');
      await ensure(rampText(req.state)); await ensureTexts(req.state);
      const t = performance.now(); const r = render(source, req.state, { scale: req.scale ?? 1, glyphs, text: textR, phase: req.phase });
      const ms = performance.now() - t;
      const img = r.img.data.buffer === source.data.buffer ? { ...r.img, data: new Uint8ClampedArray(r.img.data) } : r.img;
      return { data: { img: toWire(img), info: r.info, ms, textBoxes: r.textBoxes }, transfer: [img.data.buffer as ArrayBuffer] };
    }
    case 'coverage': {
      await ensure(Object.values(CHARSETS).map((c) => c.ramp).join(''));
      const rows = Object.entries(CHARSETS).map(([preset, cs]) => ({
        preset, chars: Object.fromEntries([...new Set(cs.ramp)].filter((ch) => ch !== ' ').map((ch) => [ch, classify(ch)])),
      }));
      return { data: { rows, controls: { latinA: classify('A'), privateUse: classify('\u{10FFFD}') } } satisfies CoverageRes };
    }
    case 'hashes': {
      const src = testImage(300, 200); const out: Record<string, string> = {};
      for (const c of HASH_CASES(EFFECTS.map((e) => e.id), POSTFX, EFFECTS.flatMap((e) => (e.motions ?? []).map((m) => ({ effect: e.id, id: m.id }))))) out[c.name] = await sha1(render(src, c.state, { phase: c.phase }).img.data);
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
    const { data, transfer } = await handle(e.data, id);
    scope.postMessage({ id, ok: true, data } satisfies Reply, transfer ?? []);
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies Reply);
  }
};
