// Potok (plik 01, sekcja 1): zrodlo -> styl -> post FX (stala kolejnosc) -> Color. Eksport = ten sam render w wiekszej skali.
import type { EffectInfo, GlyphProvider, Img, RenderCtx } from './core/types.ts';
import { adjust } from './core/compose.ts';
import { resolveParams } from './core/params.ts';
import { resize } from './core/util.ts';
import { getEffect } from './registry.ts';
import { POSTFX } from './post/postfx.ts';
import { COLOR_PARAMS, applyColor } from './post/color.ts';

export type RenderState = { style: { id: string; params?: Record<string, any> }; postFx?: Record<string, Record<string, any> | true | false>; color?: Record<string, any> };
export type RenderOpts = { scale?: number; glyphs?: GlyphProvider | null; strict?: boolean };
export type RenderResult = { img: Img; info: EffectInfo };

function makeCtx(src: Img, state: RenderState, opts: RenderOpts): { ctx: RenderCtx; effect: ReturnType<typeof getEffect> } {
  const scale = opts.scale ?? 1; if (!(scale >= 0.1 && scale <= 8)) throw new Error('scale must be within 0.1..8');
  const effect = getEffect(state.style.id); const p = resolveParams(effect.params, state.style.params ?? {}, opts.strict ?? true);
  const scaled = scale === 1 ? src : resize(src, src.w * scale, src.h * scale); const info: EffectInfo = {};
  const prep = adjust(scaled, p.brightness ?? 0, p.contrast ?? 0);
  return { effect, ctx: { src: scaled, prep, p, scale, glyphs: opts.glyphs ?? null, info, px: (v: number) => Math.max(1, Math.round(v * scale)) } };
}
export function render(src: Img, state: RenderState, opts: RenderOpts = {}): RenderResult {
  const { ctx, effect } = makeCtx(src, state, opts);
  for (const k of Object.keys(state.postFx ?? {})) if (!POSTFX.some((f) => f.id === k)) throw new Error(`unknown post FX "${k}"`);
  let img = effect.render(ctx);
  for (const fx of POSTFX) { const cfg = state.postFx?.[fx.id]; if (!cfg) continue; img = fx.apply(img, resolveParams(fx.params, cfg === true ? {} : cfg, opts.strict ?? true), ctx.scale, 1); }
  if (state.color) img = applyColor(img, resolveParams(COLOR_PARAMS, state.color, opts.strict ?? true));
  return { img, info: ctx.info };
}
/** Eksport tekstowy (Characters, Block, Braille). Zwraca null, gdy efekt nie ma wersji tekstowej. */
export function renderText(src: Img, state: RenderState, opts: RenderOpts = {}): string | null { const { ctx, effect } = makeCtx(src, state, opts); return effect.text ? effect.text(ctx) : null; }
