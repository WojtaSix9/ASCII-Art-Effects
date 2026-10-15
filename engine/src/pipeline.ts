// Potok (plik 01, sekcja 1): zrodlo -> styl -> post FX (stala kolejnosc) -> Color. Eksport = ten sam render w wiekszej skali.
import type { EffectInfo, GlyphProvider, Img, RenderCtx } from './core/types.ts';
import { cloneImg } from './core/types.ts';
import { adjust } from './core/compose.ts';
import { resolveParams } from './core/params.ts';
import { resize } from './core/util.ts';
import { getEffect } from './registry.ts';
import { POSTFX } from './post/postfx.ts';
import { COLOR_PARAMS, applyColor } from './post/color.ts';
import { applyLights, type LightsState } from './post/lights.ts';
import { GLYPH_STYLES, type GlyphFx } from './post/glyphfx.ts';
import { cropRect, type Crop } from './core/crop.ts';
export { cropRect, type Crop };

export type RenderState = { style: { id: string; params?: Record<string, any> }; postFx?: Record<string, Record<string, any> | true | false>; color?: Record<string, any>;
  /** Światła (plik 07): oświetlają źródło przed stylem. Dither ich nie używa (jak w oryginale, plik 01). */
  lights?: LightsState;
  /** Kadr (krok 7.3, proj): prostokąt w ułamkach źródła 0–1. Stosowany pierwszy, przed skalą, światłami i stylem,
   *  więc pozycje świateł i siatka znaków liczą się względem kadru. Brak = całe zdjęcie. */
  crop?: Crop };
function cropImg(src: Img, c: Crop | undefined): Img {
  if (!c) return src; const r = cropRect(src.w, src.h, c); if (r.sx === 0 && r.sy === 0 && r.sw === src.w && r.sh === src.h) return src;
  const out = new Uint8ClampedArray(r.sw * r.sh * 4);
  for (let y = 0; y < r.sh; y++) out.set(src.data.subarray(((r.sy + y) * src.w + r.sx) * 4, ((r.sy + y) * src.w + r.sx + r.sw) * 4), y * r.sw * 4);
  return { w: r.sw, h: r.sh, data: out };
}
/** Efekty bez świateł (plik 01, sekcja 1: Dither nie ma zakładki Lights). */
export const NO_LIGHTS = new Set(['dither']);
export { GLYPH_STYLES };
export type RenderOpts = { scale?: number; glyphs?: GlyphProvider | null; strict?: boolean };
export type RenderResult = { img: Img; info: EffectInfo };

/** Krok 6: pamięć ostatniego przeskalowanego (i oświetlonego) źródła. Przy przesuwaniu suwaka stylu źródło i skala są te
 *  same, więc nie liczymy ich od nowa. Klucz: tożsamość obiektu źródła, skala i stan świateł. Obraz w pamięci jest tylko
 *  czytany (render() kopiuje wynik, jeśli efekt zwróciłby go bez zmian). */
let lastScaled: { src: Img; scale: number; lights: string; img: Img } | null = null;
function scaledSource(src: Img, scale: number, lights: RenderState['lights'], crop: Crop | undefined): Img {
  const key = (lights ? JSON.stringify(lights) : '') + (crop ? `|${crop.x},${crop.y},${crop.w},${crop.h}` : '');
  if (lastScaled && lastScaled.src === src && lastScaled.scale === scale && lastScaled.lights === key) return lastScaled.img;
  const cut = cropImg(src, crop);
  let img = scale === 1 ? cut : resize(cut, cut.w * scale, cut.h * scale);
  if (lights) img = applyLights(img, lights);
  lastScaled = { src, scale, lights: key, img }; return img;
}
/** charBloom i charChroma rysuje styl glifowy (plik 01, sekcja 8: „per glif”); w innych stylach nic nie robią. */
function glyphFxOf(styleId: string, state: RenderState, opts: RenderOpts): GlyphFx | null {
  if (!GLYPH_STYLES.has(styleId)) return null; const on = (id: string) => { const c = state.postFx?.[id]; return c ? resolveParams(POSTFX.find((f) => f.id === id)!.params, c === true ? {} : c, opts.strict ?? true) : null; };
  const b = on('charBloom'), c = on('charChroma'); const fx = { bloom: b ? b.intensity : 0, chroma: c ? c.offset : 0 };
  return fx.bloom > 0 || fx.chroma > 0 ? fx : null;
}
function makeCtx(src: Img, state: RenderState, opts: RenderOpts): { ctx: RenderCtx; effect: ReturnType<typeof getEffect> } {
  const scale = opts.scale ?? 1; if (!(scale >= 0.1 && scale <= 8)) throw new Error('scale must be within 0.1..8');
  const effect = getEffect(state.style.id); const p = resolveParams(effect.params, state.style.params ?? {}, opts.strict ?? true);
  const info: EffectInfo = {};
  const scaled = scaledSource(src, scale, state.lights && !NO_LIGHTS.has(effect.id) ? state.lights : undefined, state.crop);
  const prep = adjust(scaled, p.brightness ?? 0, p.contrast ?? 0);
  return { effect, ctx: { src: scaled, prep, p, scale, glyphs: opts.glyphs ?? null, info, glyphFx: glyphFxOf(effect.id, state, opts), px: (v: number) => Math.max(1, Math.round(v * scale)) } };
}
export function render(src: Img, state: RenderState, opts: RenderOpts = {}): RenderResult {
  const { ctx, effect } = makeCtx(src, state, opts);
  for (const k of Object.keys(state.postFx ?? {})) if (!POSTFX.some((f) => f.id === k)) throw new Error(`unknown post FX "${k}"`);
  let img = effect.render(ctx);
  if (img.data === ctx.src.data || img.data === ctx.prep.data || img.data === src.data) img = cloneImg(img);   // post FX i Color zmieniają obraz w miejscu
  for (const fx of POSTFX) { const cfg = state.postFx?.[fx.id]; if (!cfg) continue; img = fx.apply(img, resolveParams(fx.params, cfg === true ? {} : cfg, opts.strict ?? true), ctx.scale, 1); }
  if (state.color) img = applyColor(img, resolveParams(COLOR_PARAMS, state.color, opts.strict ?? true));
  return { img, info: ctx.info };
}
/** Eksport tekstowy (Characters, Block, Braille). Zwraca null, gdy efekt nie ma wersji tekstowej. */
export function renderText(src: Img, state: RenderState, opts: RenderOpts = {}): string | null { const { ctx, effect } = makeCtx(src, state, opts); return effect.text ? effect.text(ctx) : null; }
