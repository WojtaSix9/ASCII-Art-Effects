// Strona /video (etap 2, prośba użytkownika po kroku 10, opcja 3): film do 8 s zamieniony na efekt z rodziny ASCII,
// podgląd pętli i eksport GIF albo MP4 (H.264, bez dźwięku). Decyzje użytkownika: osobna zakładka jak Logo; dłuższy film:
// pierwsze 8 s i komunikat; efekty tylko z rodziny ASCII; pod narzędziem przykłady (sceny ascii.rest jako ilustracja stylu).
// Układ edytora (prośba użytkownika: „wygląd edytora razem z funkcjonalnościami”, wzór: devault-ascii, kod własny): scena z podglądem
// na wysokość okna i paskiem sterowania (odtwórz/pauza, przewijanie, porównanie, pełny ekran), panel po prawej z siatką stylów
// i zwijanymi sekcjami, zapis przypięty na dole panelu.
// Dekodowanie, render i kodowanie działają w Workerze silnika (app/src/engine/video.ts, worker.ts); plik nie opuszcza przeglądarki.
import type { RenderState } from '../../../engine/src/index.ts';
import { sharedEngine } from '../engine/client.ts';
import { CANCELLED, LIMIT_ERROR, NO_CODEC, type EffectMeta, type ExportRes } from '../engine/protocol.ts';
import type { VideoInfo } from '../engine/video.ts';
import { ICON } from '../editor/icons.ts';
import { mountParamPanel, rangeFill, type Values } from '../ui/param-panel.ts';
import { colorHtml, mountColorPanel, mountPostFxPanel } from '../ui/post-panels.ts';
import { mountScenes, scenesHtml } from './scenes.ts';

/** Rodzina ASCII (decyzja użytkownika: „Characters, Block, Braille, Dots, Mixed i pokrewne”): kategoria ASCII & Text silnika
 *  i cztery efekty siatki znaków z kategorii Geometric (Cross, Diamond, Lines, Diagonal), które rysują glif w komórce. */
export const VIDEO_EFFECTS = ['characters', 'block-chars', 'braille', 'dots', 'mixed', 'asciiStudio', 'cross', 'diamond', 'lines', 'diagonal'];
/** Próbka znaków na kafelku stylu (proj): typowe glify efektu. */
const SAMPLE: Record<string, string> = { characters: '@%#*', 'block-chars': '█▓▒░', braille: '⣿⠿⠇⠃', dots: '●•∙·', mixed: 'A#•.', asciiStudio: '@#S0', cross: '+×+·', diamond: '◆◇◆·', lines: '|/—\\', diagonal: '╱╲╱╲' };
/** Klatki na sekundę (proj): 15 jak sceny ascii.rest; więcej podwaja pamięć klatek (8 s × 24 fps = 192 klatki). */
export const VIDEO_FPS = [12, 15];

const sec = (title: string, body: string, open = false, attrs = '') => `<details class="vpanel"${open ? ' open' : ''}${attrs}><summary>${title}</summary><div class="vpanel__body">${body}</div></details>`;

export const videoHtml = () => `
<p class="label">/video</p>
<h1 tabindex="-1">Wideo w ASCII</h1>
<p>Zamienia krótki film (do 8 s) na animację ze znaków w jednym z efektów ASCII i zapisuje ją jako GIF albo MP4. Plik nie opuszcza przeglądarki. Dźwięk nie jest zapisywany.</p>
<div class="vapp" data-app>
  <section class="vstage" data-stage aria-label="Podgląd">
    <div class="vstage__empty" data-prompt>
      <p>Przeciągnij tu film albo</p>
      <button type="button" class="ed-btn ed-btn--primary vbtn-ico" data-pick>${ICON.upload} Wybierz film</button>
      <p class="ed-hint">MP4, WebM, MOV; do 8 s (z dłuższego pierwsze 8 s)</p>
    </div>
    <p class="vchip" data-facts role="status" hidden></p>
    <div class="vcmp" data-cmp hidden>
      <canvas class="logo__canvas" data-canvas role="img" aria-label="Podgląd filmu w efekcie"></canvas>
      <span class="vcmp__tag" data-tag-out hidden>Wynik</span><span class="vcmp__tag vcmp__tag--r" data-tag-src hidden>Oryginał</span>
      <div class="vcmp__handle" data-handle role="slider" tabindex="0" aria-label="Podział: wynik po lewej, oryginał po prawej" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" hidden><span aria-hidden="true">‹›</span></div>
    </div>
    <div class="vdock" data-dock hidden>
      <button type="button" class="vdock__btn" data-play aria-label="Pauza">${ICON.pause}</button>
      <input type="range" class="vdock__seek" data-seek min="0" max="0" step="1" value="0" aria-label="Klatka filmu">
      <span class="vdock__time" data-time aria-live="off">0:00 / 0:00</span>
      <button type="button" class="vdock__btn vdock__btn--text" data-compare aria-pressed="false">${ICON.compare}<span>Porównaj</span></button>
      <button type="button" class="vdock__btn" data-full aria-label="Pełny ekran" aria-pressed="false">${ICON.expand}</button>
    </div>
    <input type="file" data-file accept="video/*,.mp4,.webm,.mov,.mkv,.m4v" hidden>
  </section>
  <aside class="vside" data-form aria-label="Ustawienia" hidden>
    <div class="vside__scroll">
      <div class="vside__top"><button type="button" class="ed-btn vbtn-ico" data-another>${ICON.upload} Inny film</button></div>
      ${sec('Styl', `<div class="vstyles" role="radiogroup" aria-label="Efekt" data-effect></div>`, true)}
      ${sec('Parametry', '<div data-params></div>', true)}
      ${sec('Color', colorHtml(), false, ' data-color-box')}
      ${sec('Post FX', '<div data-postfx></div>')}
      ${sec('Film', `<label class="vfield">Klatki na sekundę <select class="ed-btn" name="fps">${VIDEO_FPS.map((f) => `<option value="${f}"${f === 15 ? ' selected' : ''}>${f}</option>`).join('')}</select></label>`)}
    </div>
    <div class="vside__foot">
      <div class="vside__out">
        <label class="vfield">Format <select class="ed-btn" name="format" data-format><option value="mp4">MP4 (H.264)</option><option value="gif">GIF</option></select></label>
        <label class="vfield">Dłuższy bok <select class="ed-btn" name="side"><option value="480">480 px</option><option value="720" selected>720 px</option><option value="1080">1080 px</option></select></label>
      </div>
      <div class="vside__go"><button type="button" class="ed-btn ed-btn--primary vbtn-ico" data-download>${ICON.download} Pobierz</button><button type="button" class="ed-btn" data-cancel hidden>Przerwij</button></div>
      <div class="ed-anim__bar" data-bar hidden><span></span></div>
      <p class="ed-note" data-msg role="status"></p>
    </div>
  </aside>
</div>
${scenesHtml()}`;

const ERRORS: Record<string, string> = {
  NO_VIDEO: 'W tym pliku nie ma ścieżki wideo.',
  BAD_FILE: 'Nie umiem odczytać tego pliku. Spróbuj MP4 albo WebM.',
};
const explain = (m: string) => {
  if (m.startsWith('NO_DECODE')) return `Ta przeglądarka nie dekoduje tego filmu (kodek ${m.split(':')[1] || 'nieznany'}). Zapisz film w innym formacie (np. MP4 H.264 albo WebM VP9) albo użyj innej przeglądarki.`;
  if (m.startsWith(NO_CODEC)) return 'Ta przeglądarka nie koduje wideo H.264 (WebCodecs), więc MP4 nie powstanie. Wybierz GIF albo użyj Chrome, Edge lub Safari.';
  if (m.startsWith(LIMIT_ERROR)) return `Przeglądarka nie utworzy obrazu ${m.split(':')[1]} px. Wybierz mniejszy bok.`;
  return ERRORS[m] ?? `Błąd: ${m}`;
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function mountVideo(main: HTMLElement): () => void {
  const $ = <T extends Element = HTMLElement>(s: string) => main.querySelector<T>(s)!;
  const app = $('[data-app]'), stage = $('[data-stage]'), fileIn = $<HTMLInputElement>('[data-file]'), canvas = $<HTMLCanvasElement>('[data-canvas]'), form = $('[data-form]');
  const msg = $('[data-msg]'), facts = $('[data-facts]'), styles = $('[data-effect]'), bar = $('[data-bar]'), fill = bar.firstElementChild as HTMLElement;
  const dock = $('[data-dock]'), playBtn = $<HTMLButtonElement>('[data-play]'), seek = $<HTMLInputElement>('[data-seek]'), timeEl = $('[data-time]'), fullBtn = $<HTMLButtonElement>('[data-full]');
  const engine = sharedEngine(); const val = (n: string) => form.querySelector<HTMLSelectElement>(`[name="${n}"]`)!.value;
  let alive = true, defs: EffectMeta[] = [], effect = VIDEO_EFFECTS[0], params: Record<string, Values> = {}, color: Values = {}, postFx: Record<string, Values> = {}, file: File | null = null, info: VideoInfo | null = null;
  let frames: ImageBitmap[] = [], originals: ImageBitmap[] = [], cmpOn = false, split = 0.5, raf = 0, busy = false, stale = false, loadNote = '';
  let job: { cancel: () => void } | null = null, previewJob: { cancel: () => void } | null = null, previewN = 0;
  /* Color i Post FX jak w edytorze (te same panele, ten sam silnik); bez świateł, napisów i kadru */
  const state = (): RenderState => ({ style: { id: effect, params: params[effect] ?? {} },
    color: Object.keys(color).length ? color : undefined, postFx: Object.keys(postFx).length ? postFx : undefined });
  const setMsg = (t: string, kind = '') => { msg.textContent = t; if (kind) msg.dataset.kind = kind; else delete msg.dataset.kind; };
  const progress = (label: string) => (done: number, total: number) => { bar.hidden = false; fill.style.width = `${(100 * done) / total}%`; setMsg(`${label}: ${done} z ${total}…`); };

  /* Styl: kafelki efektów (radiogroup: strzałki zmieniają wybór, Tab wchodzi na zaznaczony) */
  const drawStyles = () => {
    styles.innerHTML = defs.map((e) => `<button type="button" class="vstyle" role="radio" aria-checked="${e.id === effect}" tabindex="${e.id === effect ? 0 : -1}" data-effect-id="${e.id}">
      <span class="vstyle__glyph" aria-hidden="true">${SAMPLE[e.id] ?? e.name.slice(0, 4)}</span><span class="vstyle__name">${e.name}</span></button>`).join('');
  };
  const buildParams = () => {
    const e = defs.find((d) => d.id === effect)!;
    params[e.id] = mountParamPanel($('[data-params]'), e.name, e.params, params[e.id] ?? {}, (v) => { params[e.id] = v; schedule(); })();
  };
  const selectEffect = (id: string, focus = false) => {
    if (!defs.some((d) => d.id === id)) return; effect = id;
    styles.querySelectorAll<HTMLButtonElement>('[data-effect-id]').forEach((b) => { const on = b.dataset.effectId === id; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    buildParams(); fxUi?.syncGlyph();
  };
  styles.addEventListener('click', (e) => { const b = (e.target as Element).closest<HTMLButtonElement>('[data-effect-id]'); if (b && b.dataset.effectId !== effect) { selectEffect(b.dataset.effectId!); schedule(); } });
  styles.addEventListener('keydown', (e) => {
    const i = defs.findIndex((d) => d.id === effect); const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return; e.preventDefault(); selectEffect(defs[(i + step + defs.length) % defs.length].id, true); schedule();
  });
  let fxUi: { syncGlyph: () => void } | null = null;
  Promise.all([engine.defs(), engine.postDefs()]).then(([d, post]) => {
    if (!alive) return; defs = VIDEO_EFFECTS.map((id) => d.find((x) => x.id === id)).filter((x): x is EffectMeta => !!x);
    drawStyles(); buildParams();
    mountColorPanel($('[data-color-box]'), post.color, { get: () => color, set: (v) => { color = v; }, change: schedule, commit: () => {} }).build();
    const fx = mountPostFxPanel($('[data-postfx]'), post, () => effect, { get: () => postFx, change: schedule, commit: () => {} }); fx.build(); fxUi = fx;
  });

  /** Wczytanie: Worker dekoduje pierwsze 8 s w fps klatek na sekundę (dłuższy bok 480 px). */
  /* nowy plik (albo inne fps) przerywa trwające wczytywanie; w czasie eksportu wczytywanie czeka na jego koniec */
  let loadN = 0, loadJob: { cancel: () => void } | null = null;
  const showEmpty = (on: boolean) => { $('[data-prompt]').hidden = !on; app.classList.toggle('vapp--loaded', !on); };
  const load = async (f: File) => {
    if (busy) { setMsg('Poczekaj na koniec zapisu albo go przerwij.'); return; }
    loadJob?.cancel(); previewJob?.cancel(); const mine = ++loadN; file = f; info = null; if (cmpOn) setCompare(false); else dropOriginals();
    form.hidden = false; showEmpty(false);
    const l = engine.callLong<VideoInfo>({ type: 'videoLoad', file: f, fps: Number(val('fps')) }, (d, t) => { if (mine === loadN) progress('Czytam klatki')(d, t); }); loadJob = l;
    try {
      const r = await l.promise; if (!alive || mine !== loadN) return; info = r; loadJob = null;
      loadNote = r.truncated ? `Film ma ${r.duration.toFixed(1)} s; używam pierwszych ${r.used.toFixed(0)} s.` : '';
      facts.textContent = `${f.name} · ${r.srcW}×${r.srcH} · ${r.used.toFixed(1)} s · ${r.n} klatek po ${r.fps}/s`; facts.hidden = false;
      seek.max = String(r.n - 1); setMsg(loadNote, r.truncated ? 'warn' : ''); bar.hidden = true; await preview();
      /* narzędzie w całości w oknie: jeśli wystaje, przewijamy do niego (bez animacji przy prefers-reduced-motion) */
      const rr = app.getBoundingClientRect(); if (alive && mine === loadN && (rr.top < 0 || rr.bottom > innerHeight)) app.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } catch (e) {
      if (mine !== loadN) return; loadJob = null; bar.hidden = true;
      const m = (e as Error).message; if (m !== CANCELLED) setMsg(explain(m), 'error');
      /* nieudane wczytanie: bez filmu, scena znów do wyboru pliku (komunikat zostaje w panelu) */
      cancelAnimationFrame(raf); frames.forEach((b) => b.close()); frames = []; file = null; facts.hidden = true;
      cmp.hidden = true; dock.hidden = true; showEmpty(true);
    }
  };

  /** Podgląd: wszystkie klatki w efekcie (skala 1), potem odtwarzanie; nowa zmiana przerywa poprzedni render. */
  const preview = async () => {
    if (!info) return; if (busy) { stale = true; return; }   // w czasie zapisu podgląd po jego końcu
    stale = false; previewJob?.cancel(); const mine = ++previewN;
    const p = engine.callLong<{ frames: ImageBitmap[]; ms: number }>({ type: 'videoPreview', state: state() }, (d, t) => { if (mine === previewN) { bar.hidden = false; fill.style.width = `${(100 * d) / t}%`; } });
    previewJob = p;
    try {
      const r = await p.promise;
      if (mine !== previewN || !alive) { r.frames.forEach((b) => b.close()); return; }
      const first = !frames.length; frames.forEach((b) => b.close()); frames = r.frames; bar.hidden = true; show(first);
      if (!loadNote && msg.dataset.kind !== 'error') setMsg('');
    } catch (e) { const m = (e as Error).message; if (m !== CANCELLED && mine === previewN) { setMsg(explain(m), 'error'); bar.hidden = true; } }
  };
  let tm: number | undefined;
  const schedule = () => { clearTimeout(tm); tm = window.setTimeout(preview, 200); };

  /* Odtwarzanie: klatka k = pozycja w pętli; pauza zatrzymuje na k, przewijanie ustawia k (i gra dalej od niej, jeśli gra).
     Przy porównaniu prawa część (od `split`) pokazuje klatkę źródłową, a linia podziału jest rysowana na kanwie. */
  const cmp = $('[data-cmp]'), handle = $('[data-handle]');
  let k = 0, playing = true, t0 = 0;
  const g = () => canvas.getContext('2d')!;
  const draw = (i: number) => {
    if (!frames[i]) return; const c = g(), w = canvas.width, h = canvas.height;
    c.drawImage(frames[i], 0, 0);
    if (cmpOn && originals[i]) { const x = Math.round(split * w); c.drawImage(originals[i], x, 0, w - x, h, x, 0, w - x, h); c.fillStyle = '#fff'; c.fillRect(x - 1, 0, 2, h); }
  };
  const showFrame = (i: number) => {
    if (!info) return; k = i; draw(i); seek.value = String(i); rangeFill(seek);
    timeEl.textContent = `${clock(i / info.fps)} / ${clock(info.n / info.fps)}`;
  };
  const tick = (now: number) => {
    if (!alive || !playing || !info) return;
    const i = Math.floor(((now - t0) / 1000) * info.fps) % frames.length; if (i !== k) showFrame(i);
    raf = requestAnimationFrame(tick);
  };
  const setPlaying = (on: boolean) => {
    playing = on; playBtn.innerHTML = on ? ICON.pause : ICON.play; playBtn.setAttribute('aria-label', on ? 'Pauza' : 'Odtwórz');
    cancelAnimationFrame(raf); if (on && info) { t0 = performance.now() - (k / info.fps) * 1000; raf = requestAnimationFrame(tick); }
  };
  /** Nowe klatki podglądu: rozmiar kanwy, proporcje dla CSS (podgląd mieści się w scenie); pierwszy raz od klatki 0 i z odtwarzaniem. */
  const show = (first: boolean) => {
    if (!frames.length || !info) return;
    canvas.width = frames[0].width; canvas.height = frames[0].height; cmp.hidden = false; dock.hidden = false;
    cmp.style.setProperty('--ar', String(frames[0].width / frames[0].height));
    if (first) { k = 0; setPlaying(true); }
    showFrame(Math.min(k, frames.length - 1)); if (playing) setPlaying(true);
  };
  playBtn.addEventListener('click', () => setPlaying(!playing));
  seek.addEventListener('input', () => { showFrame(Number(seek.value)); if (playing) setPlaying(true); });
  /* skrót na scenie: spacja odtwarza/pauzuje (poza polami, suwakami i przyciskami, które mają własną spację) */
  stage.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement; if (!info || t.matches('input, select, [role="slider"]')) return;
    if (e.key === ' ' && !t.matches('button')) { e.preventDefault(); setPlaying(!playing); }
  });

  /** Porównanie: klatki źródłowe pobierane z Workera przy włączeniu, zwalniane przy wyłączeniu i przy nowym filmie. */
  const dropOriginals = () => { originals.forEach((b) => b.close()); originals = []; };
  const setCompare = async (on: boolean) => {
    const btn = $<HTMLButtonElement>('[data-compare]');
    if (on && !originals.length) { btn.disabled = true; const at = loadN; try { const o = await engine.call<ImageBitmap[]>({ type: 'videoOriginals' }); if (at !== loadN || !alive) { o.forEach((x) => x.close()); return; } originals = o; } catch { on = false; } finally { btn.disabled = false; } }
    if (!alive) return; cmpOn = on; if (!on) dropOriginals();
    btn.setAttribute('aria-pressed', String(on)); cmp.classList.toggle('vcmp--on', on);
    handle.hidden = !on; $('[data-tag-out]').hidden = !on; $('[data-tag-src]').hidden = !on; setSplit(split);
  };
  const setSplit = (v: number) => {
    split = Math.min(1, Math.max(0, v)); const pct = Math.round(split * 100);
    handle.style.left = `${split * 100}%`; handle.setAttribute('aria-valuenow', String(pct)); handle.setAttribute('aria-valuetext', `${pct}% wyniku`); draw(k);
  };
  let dragging = false;
  const fromX = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width); };
  cmp.addEventListener('pointerdown', (e) => { if (!cmpOn) return; dragging = true; cmp.setPointerCapture(e.pointerId); fromX(e); handle.focus(); e.preventDefault(); });
  cmp.addEventListener('pointermove', (e) => { if (dragging) fromX(e); });
  cmp.addEventListener('pointerup', () => { dragging = false; });
  cmp.addEventListener('pointercancel', () => { dragging = false; });
  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 0.02; const key = e.key;
    const v = key === 'ArrowLeft' || key === 'ArrowDown' ? split - step : key === 'ArrowRight' || key === 'ArrowUp' ? split + step : key === 'Home' ? 0 : key === 'End' ? 1 : null;
    if (v !== null) { e.preventDefault(); setSplit(v); }
  });
  $('[data-compare]').addEventListener('click', () => setCompare(!cmpOn));

  /* pełny ekran sceny (tam, gdzie przeglądarka go ma; iPhone: brak, przycisk ukryty) */
  if (!document.fullscreenEnabled) fullBtn.hidden = true;
  fullBtn.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen().catch(() => {}); });
  const onFull = () => { const on = document.fullscreenElement === stage; fullBtn.setAttribute('aria-pressed', String(on)); fullBtn.setAttribute('aria-label', on ? 'Zamknij pełny ekran' : 'Pełny ekran'); };
  document.addEventListener('fullscreenchange', onFull);

  const save = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000); };
  const download = async () => {
    if (!info || busy) return; busy = true; const fmt = val('format') as 'gif' | 'mp4';
    const scale = Number(val('side')) / Math.max(info.w, info.h); const cancelBtn = $<HTMLButtonElement>('[data-cancel]'); cancelBtn.hidden = false;
    setMsg(`Koduję ${fmt.toUpperCase()}…`);   // od razu: stary komunikat „Gotowe” nie zostaje przy nowym zapisie
    const l = engine.callLong<ExportRes>({ type: 'videoExport', state: state(), scale, format: fmt, codec: (window as any).__videoCodec }, progress(`Koduję ${fmt.toUpperCase()}`)); job = l;
    try {
      const r = await l.promise; const base = (file?.name ?? 'film').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.-]+/g, '-').slice(0, 40) || 'film';
      const name = `${base}-${effect}.${fmt}`; save(r.blob, name);
      setMsg(`Gotowe: ${name}, ${r.w}×${r.h} px, ${info.n} klatek (${info.used.toFixed(1)} s × ${info.fps} fps), ${(r.blob.size / 1048576).toFixed(1)} MB.`);
    } catch (e) { const m = (e as Error).message; setMsg(m === CANCELLED ? 'Przerwano.' : explain(m), m === CANCELLED ? '' : 'error'); }
    finally { busy = false; job = null; bar.hidden = true; cancelBtn.hidden = true; if (stale) preview(); }
  };

  /* wczytywanie: przycisk, przeciągnięcie na scenę */
  $('[data-pick]').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', () => { const f = fileIn.files?.[0]; if (f) load(f); fileIn.value = ''; });
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('vstage--over'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('vstage--over'));
  stage.addEventListener('drop', (e) => { e.preventDefault(); stage.classList.remove('vstage--over'); const f = e.dataTransfer?.files[0]; if (f) load(f); });
  form.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    if (el.name === 'fps' && file) load(file);   // inna liczba klatek: dekodujemy od nowa
  });
  form.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('[data-download]')) download();
    if (t.closest('[data-cancel]')) job?.cancel();
    if (t.closest('[data-another]')) fileIn.click();
  });
  const stopScenes = mountScenes(main);

  (window as any).__videoTest = { load: (f: File) => load(f), info: () => info, frames: () => frames.length, idle: () => !busy && !job && !loadJob,
    /* zatrzymuje odtwarzanie na klatce k (kod odtwarzania); zwraca, czy pas kanwy x ∈ [a, b) równa się klatce wyniku albo oryginału */
    still: (i: number, a: number, b: number) => { setPlaying(false); showFrame(i); const band = (src: CanvasImageSource | null) => { const c = new OffscreenCanvas(canvas.width, canvas.height); const x = c.getContext('2d')!; if (src) x.drawImage(src, 0, 0); else x.drawImage(canvas, 0, 0);
      const x0 = Math.round(a * canvas.width), x1 = Math.round(b * canvas.width); return [...x.getImageData(x0, 0, x1 - x0, canvas.height).data]; }; const eq = (p: number[], q: number[]) => p.length === q.length && p.every((v, j) => v === q[j]);
      const cv = band(null); return { sameAsOut: eq(cv, band(frames[i])), sameAsSrc: originals[i] ? eq(cv, band(originals[i])) : false }; },
    resume: () => setPlaying(true), frame: () => k, playing: () => playing,
    compare: (on: boolean, at = 0.5) => { setSplit(at); return setCompare(on); }, originals: () => originals.length,
    /* średnia jasność klatki podglądu i (0–255) i jej rozmiar, do testów zgodności podglądu z filmem */
    luma: (i: number) => { const b = frames[i]; if (!b) return null; const c = new OffscreenCanvas(b.width, b.height); const x = c.getContext('2d')!; x.drawImage(b, 0, 0); const d = x.getImageData(0, 0, b.width, b.height).data; let s = 0; for (let j = 0; j < d.length; j += 4) s += 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]; return { mean: s / (d.length / 4), w: b.width, h: b.height }; },
    setEffect: (id: string) => { selectEffect(id); return preview(); } };
  return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(tm); job?.cancel(); loadJob?.cancel(); previewJob?.cancel(); frames.forEach((b) => b.close()); frames = []; dropOriginals(); stopScenes(); document.removeEventListener('fullscreenchange', onFull); if (document.fullscreenElement === stage) document.exitFullscreen().catch(() => {}); delete (window as any).__videoTest; };
}
