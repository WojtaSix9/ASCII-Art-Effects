// Zakładka Animation (plik 09, sekcja 4, punkt 3; krok 3 etapu 2). Aktywna tylko dla efektów z ruchem (EffectMeta.motions).
// Podgląd (decyzja użytkownika): najpierw cała pętla jest liczona w Workerze w obniżonej rozdzielczości, potem gotowe klatki
// odtwarzają się w nieskończoność (requestAnimationFrame, czas rzeczywisty). Każda zmiana ustawień w trakcie odtwarzania
// zatrzymuje pętlę, pokazuje zwykły podgląd i po chwili liczy pętlę od nowa.
import type { ParamDef } from '../../../engine/src/index.ts';
import type { EffectMeta, RenderRes } from '../engine/protocol.ts';
import type { EngineClient } from '../engine/client.ts';
import { paint } from '../engine/preview.ts';
import { mountParamPanel } from '../ui/param-panel.ts';
import { toRenderState, type EditorState } from './state.ts';
import { ICON } from './icons.ts';

/** Ustawienia pętli podglądu (proj). Długość i fps przydadzą się też eksportowi (krok 4). */
export const LOOP_PARAMS: ParamDef[] = [
  { id: 'loopSeconds', label: 'Loop length', kind: 'range', default: 4, min: 1, max: 10, step: 0.5, unit: 's', level: 'main' },
  { id: 'fps', label: 'Preview fps', kind: 'select', default: '24', options: [{ value: '12', label: '12' }, { value: '24', label: '24' }, { value: '30', label: '30' }], level: 'main' },
];
/** Limity klatek podglądu (proj): dłuższy bok ≤ 720 px i nie więcej niż podgląd, cała pętla ≤ 96 MB pikseli RGBA. */
export const PREVIEW_MAX_SIDE = 720, PREVIEW_MAX_BYTES = 96 * 1024 * 1024;

export const animHtml = () => `
  <div class="pp-sec"><label class="pp-title" for="ed-motion">/ Animation</label><select id="ed-motion" data-motion></select></div>
  <form class="pp" data-motion-params onsubmit="return false"></form>
  <form class="pp" data-loop-params onsubmit="return false"></form>
  <div class="pp-sec">
    <button type="button" class="ed-btn ed-btn--primary" data-play aria-pressed="false"><span data-play-icon>${ICON.play}</span><span data-play-label>Odtwórz</span></button>
    <div class="ed-anim__bar" data-anim-bar hidden><span></span></div>
    <p class="ed-hint" data-anim-status role="status"></p>
  </div>`;

type Host = {
  get: () => EditorState; engine: EngineClient; canvas: HTMLCanvasElement;
  /** Skala podglądu i wymiary widocznej części źródła (po kadrze). */
  view: () => { scale: number; sw: number; sh: number };
  commit: () => void; staticRender: () => void;
};
export type AnimStatus = { phase: 'idle' | 'preparing' | 'playing'; frames: number; total: number; scale: number; w: number; h: number; shown: number };

export function mountAnim(root: HTMLElement, defs: () => EffectMeta[], host: Host) {
  const sel = root.querySelector<HTMLSelectElement>('[data-motion]')!, playBtn = root.querySelector<HTMLButtonElement>('[data-play]')!;
  const bar = root.querySelector<HTMLElement>('[data-anim-bar]')!, status = root.querySelector<HTMLElement>('[data-anim-status]')!;
  let gen = 0, want = false, raf = 0, restartT: number | undefined, frames: ImageData[] = [];
  const st: AnimStatus = { phase: 'idle', frames: 0, total: 0, scale: 0, w: 0, h: 0, shown: 0 };
  const effect = () => defs().find((d) => d.id === host.get().style);
  const motions = () => effect()?.motions ?? [];

  /** Ustawienia ruchu bieżącego stylu (zapamiętane osobno dla każdego stylu, jak parametry). */
  const cur = () => {
    const s = host.get(); const m = motions(); if (!m.length) return null;
    let a = s.anim.byStyle[s.style]; if (!a || !m.some((x) => x.id === a!.id)) a = s.anim.byStyle[s.style] = { id: m[0].id, params: {} };
    return a;
  };
  const build = () => {
    const m = motions(); const a = cur();
    sel.innerHTML = m.map((x) => `<option value="${x.id}">${x.name}</option>`).join(''); if (a) sel.value = a.id;
    const def = m.find((x) => x.id === a?.id);
    const box = root.querySelector<HTMLElement>('[data-motion-params]')!;
    if (def && a) a.params = mountParamPanel(box, 'Motion', def.params, a.params, (v) => { a.params = v; changed(); }, (v) => { a.params = v; host.commit(); }, { sections: false })();
    else box.innerHTML = '';
    const s = host.get();
    mountParamPanel(root.querySelector<HTMLElement>('[data-loop-params]')!, 'Loop', LOOP_PARAMS, { loopSeconds: s.anim.loopSeconds, fps: String(s.anim.fps) },
      (v) => { s.anim.loopSeconds = Number(v.loopSeconds); s.anim.fps = Number(v.fps); changed(); }, () => host.commit(), { sections: false });
  };
  sel.addEventListener('change', () => { const s = host.get(); s.anim.byStyle[s.style] = { id: sel.value, params: {} }; build(); host.commit(); changed(); });

  const setPhase = (p: AnimStatus['phase']) => {
    st.phase = p; playBtn.setAttribute('aria-pressed', String(want));
    root.querySelector('[data-play-label]')!.textContent = want ? 'Pauza' : 'Odtwórz'; root.querySelector('[data-play-icon]')!.innerHTML = want ? ICON.pause : ICON.play;
    bar.hidden = p !== 'preparing';
  };
  const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };

  /** Liczy całą pętlę (N = długość × fps klatek, faza i/N), potem odtwarza. Nowe wywołanie unieważnia poprzednie (gen). */
  const prepare = async () => {
    const my = ++gen; stopLoop(); frames = [];
    const s = host.get(); const a = cur(); if (!a) { want = false; setPhase('idle'); return; }
    const N = Math.max(2, Math.round(s.anim.loopSeconds * s.anim.fps)); const v = host.view();
    const side = Math.max(v.sw, v.sh);
    let scale = Math.min(v.scale, PREVIEW_MAX_SIDE / side);
    const bytes = (k: number) => Math.round(v.sw * k) * Math.round(v.sh * k) * 4 * N;
    if (bytes(scale) > PREVIEW_MAX_BYTES) scale *= Math.sqrt(PREVIEW_MAX_BYTES / bytes(scale));
    Object.assign(st, { frames: 0, total: N, scale, w: Math.round(v.sw * scale), h: Math.round(v.sh * scale), shown: 0 });
    setPhase('preparing'); const fill = bar.firstElementChild as HTMLElement; const t0 = performance.now();
    const state = toRenderState(s, true);
    for (let i = 0; i < N; i++) {
      let r: RenderRes;
      try { r = await host.engine.call<RenderRes>({ type: 'render', state, scale, phase: i / N }); }
      catch (e) { if (my !== gen) return; want = false; setPhase('idle'); status.textContent = `Błąd animacji: ${(e as Error).message}`; return; }
      if (my !== gen) return;
      frames.push(new ImageData(new Uint8ClampedArray(r.img.buffer), r.img.w, r.img.h)); st.frames = frames.length;
      fill.style.width = `${(100 * (i + 1)) / N}%`; status.textContent = `Liczę pętlę: klatka ${i + 1} z ${N}`;
    }
    const secs = (performance.now() - t0) / 1000;
    status.textContent = `Pętla ${s.anim.loopSeconds} s, ${N} klatek ${st.w}×${st.h} px (policzone w ${secs.toFixed(1)} s). Podgląd w obniżonej rozdzielczości.`;
    play(my, s.anim.loopSeconds);
  };
  const play = (my: number, loop: number) => {
    setPhase('playing'); const t0 = performance.now(); let last = -1;
    const tick = (now: number) => {
      if (my !== gen || !want) return;
      const i = Math.floor(((((now - t0) / 1000) % loop) / loop) * frames.length) % frames.length;
      if (i !== last) { paint(host.canvas, frames[i]); last = i; st.shown++; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  /** Zatrzymanie: kasuje klatki i przywraca zwykły podgląd w pełnej rozdzielczości. */
  const stop = (redraw = true) => { gen++; want = false; stopLoop(); clearTimeout(restartT); frames = []; setPhase('idle'); status.textContent = ''; if (redraw) host.staticRender(); };
  playBtn.addEventListener('click', () => { if (want) stop(); else { want = true; prepare(); } });

  /** Zmiana ustawień (ruchu, stylu, koloru…): przy odtwarzaniu pokazujemy zwykły podgląd i liczymy pętlę od nowa po 400 ms. */
  const changed = () => {
    if (!want) return;
    gen++; stopLoop(); frames = []; setPhase('idle'); status.textContent = 'Zmiana ustawień: przeliczę pętlę…'; host.staticRender();
    clearTimeout(restartT); restartT = window.setTimeout(() => { if (want) prepare(); }, 400);
  };
  return { build, changed, stop, get playing() { return want; }, status: () => ({ ...st }), dispose: () => stop(false) };
}
