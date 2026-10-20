// Strona /video (etap 2, prośba użytkownika po kroku 10, opcja 3): film do 8 s zamieniony na efekt z rodziny ASCII,
// podgląd pętli i eksport GIF albo MP4 (H.264, bez dźwięku). Decyzje użytkownika: osobna zakładka jak Logo; dłuższy film:
// pierwsze 8 s i komunikat; efekty tylko z rodziny ASCII; pod narzędziem przykłady (sceny ascii.rest jako ilustracja stylu).
// Dekodowanie, render i kodowanie działają w Workerze silnika (app/src/engine/video.ts, worker.ts); plik nie opuszcza przeglądarki.
import type { RenderState } from '../../../engine/src/index.ts';
import { sharedEngine } from '../engine/client.ts';
import { CANCELLED, LIMIT_ERROR, NO_CODEC, type EffectMeta, type ExportRes } from '../engine/protocol.ts';
import type { VideoInfo } from '../engine/video.ts';
import { mountParamPanel, type Values } from '../ui/param-panel.ts';
import { mountScenes, scenesHtml } from './scenes.ts';

/** Rodzina ASCII (decyzja użytkownika: „Characters, Block, Braille, Dots, Mixed i pokrewne”): kategoria ASCII & Text silnika
 *  i cztery efekty siatki znaków z kategorii Geometric (Cross, Diamond, Lines, Diagonal), które rysują glif w komórce. */
export const VIDEO_EFFECTS = ['characters', 'block-chars', 'braille', 'dots', 'mixed', 'asciiStudio', 'cross', 'diamond', 'lines', 'diagonal'];
/** Klatki na sekundę (proj): 15 jak sceny ascii.rest; więcej podwaja pamięć klatek (8 s × 24 fps = 192 klatki). */
export const VIDEO_FPS = [12, 15];

export const videoHtml = () => `
<p class="label">/video</p>
<h1 tabindex="-1">Wideo w ASCII</h1>
<p>Zamienia krótki film (do 8 s) na animację ze znaków w jednym z efektów ASCII i zapisuje ją jako GIF albo MP4. Plik nie opuszcza przeglądarki. Dźwięk nie jest zapisywany.</p>
<div class="logo">
  <div class="logo__drop" data-drop role="button" tabindex="0" aria-label="Wczytaj film: przeciągnij albo wybierz">
    <canvas class="logo__canvas" data-canvas role="img" aria-label="Podgląd filmu w efekcie" hidden></canvas>
    <p class="logo__prompt" data-prompt>Przeciągnij tu film albo <u>wybierz go</u>.<br><span class="ed-hint">MP4, WebM, MOV; do 8 s (z dłuższego pierwsze 8 s)</span></p>
    <input type="file" data-file accept="video/*,.mp4,.webm,.mov,.mkv,.m4v" hidden>
  </div>
  <form class="logo__panel" data-form onsubmit="return false" hidden>
    <label>Efekt <select class="ed-btn" name="effect" data-effect></select></label>
    <div data-params></div>
    <label>Klatki na sekundę <select class="ed-btn" name="fps">${VIDEO_FPS.map((f) => `<option value="${f}"${f === 15 ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
    <p class="ed-hint" data-facts role="status"></p>
    <div class="logo__out">
      <label>Format <select class="ed-btn" name="format" data-format><option value="mp4">MP4 (wideo H.264)</option><option value="gif">GIF</option></select></label>
      <label>Dłuższy bok <select class="ed-btn" name="side"><option value="480">480 px</option><option value="720" selected>720 px</option><option value="1080">1080 px</option></select></label>
      <button type="button" class="ed-btn ed-btn--primary" data-download>Pobierz</button>
      <button type="button" class="ed-btn" data-cancel hidden>Przerwij</button>
    </div>
    <div class="ed-anim__bar" data-bar hidden><span></span></div>
    <p class="ed-note" data-msg role="status"></p>
    <button type="button" class="ed-btn" data-another>Inny film</button>
  </form>
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

export function mountVideo(main: HTMLElement): () => void {
  const $ = <T extends Element = HTMLElement>(s: string) => main.querySelector<T>(s)!;
  const drop = $('[data-drop]'), fileIn = $<HTMLInputElement>('[data-file]'), canvas = $<HTMLCanvasElement>('[data-canvas]'), form = $<HTMLFormElement>('[data-form]');
  const msg = $('[data-msg]'), facts = $('[data-facts]'), effSel = $<HTMLSelectElement>('[data-effect]'), bar = $('[data-bar]'), fill = bar.firstElementChild as HTMLElement;
  const engine = sharedEngine(); const val = (n: string) => (form.elements.namedItem(n) as HTMLSelectElement).value;
  let alive = true, defs: EffectMeta[] = [], params: Record<string, Values> = {}, file: File | null = null, info: VideoInfo | null = null;
  let frames: ImageBitmap[] = [], raf = 0, busy = false, stale = false, loadNote = '';
  let job: { cancel: () => void } | null = null, previewJob: { cancel: () => void } | null = null, previewN = 0;
  const state = (): RenderState => ({ style: { id: effSel.value, params: params[effSel.value] ?? {} } });
  const setMsg = (t: string, kind = '') => { msg.textContent = t; if (kind) msg.dataset.kind = kind; else delete msg.dataset.kind; };
  const progress = (label: string) => (done: number, total: number) => { bar.hidden = false; fill.style.width = `${(100 * done) / total}%`; setMsg(`${label}: ${done} z ${total}…`); };

  const buildParams = () => {
    const e = defs.find((d) => d.id === effSel.value)!;
    params[e.id] = mountParamPanel($('[data-params]'), e.name, e.params, params[e.id] ?? {}, (v) => { params[e.id] = v; schedule(); })();
  };
  engine.defs().then((d) => {
    if (!alive) return; defs = VIDEO_EFFECTS.map((id) => d.find((x) => x.id === id)).filter((x): x is EffectMeta => !!x);
    effSel.innerHTML = defs.map((e) => `<option value="${e.id}">${e.name}</option>`).join(''); buildParams();
  });

  /** Wczytanie: Worker dekoduje pierwsze 8 s w fps klatek na sekundę (dłuższy bok 480 px). */
  /* nowy plik (albo inne fps) przerywa trwające wczytywanie; w czasie eksportu wczytywanie czeka na jego koniec */
  let loadN = 0, loadJob: { cancel: () => void } | null = null;
  const load = async (f: File) => {
    if (busy) { setMsg('Poczekaj na koniec zapisu albo go przerwij.'); return; }
    loadJob?.cancel(); previewJob?.cancel(); const mine = ++loadN; file = f; info = null;
    form.hidden = false; $('[data-prompt]').hidden = true; drop.classList.add('logo__drop--full');
    const l = engine.callLong<VideoInfo>({ type: 'videoLoad', file: f, fps: Number(val('fps')) }, (d, t) => { if (mine === loadN) progress('Czytam klatki')(d, t); }); loadJob = l;
    try {
      const r = await l.promise; if (!alive || mine !== loadN) return; info = r; loadJob = null;
      loadNote = r.truncated ? `Film ma ${r.duration.toFixed(1)} s; używam pierwszych ${r.used.toFixed(0)} s.` : '';
      facts.textContent = `${f.name}: ${r.srcW}×${r.srcH} px, ${r.used.toFixed(1)} s, ${r.n} klatek po ${r.fps} na s.`;
      setMsg(loadNote, r.truncated ? 'warn' : ''); bar.hidden = true; await preview();
    } catch (e) {
      if (mine !== loadN) return; loadJob = null; bar.hidden = true;
      const m = (e as Error).message; if (m !== CANCELLED) setMsg(explain(m), 'error');
      /* nieudane wczytanie: bez filmu, pole znów do wyboru pliku */
      cancelAnimationFrame(raf); frames.forEach((b) => b.close()); frames = []; file = null; facts.textContent = '';
      canvas.hidden = true; $('[data-prompt]').hidden = false; drop.classList.remove('logo__drop--full');
    }
  };

  /** Podgląd: wszystkie klatki w efekcie (skala 1), potem pętla w czasie rzeczywistym; nowa zmiana przerywa poprzedni render. */
  const preview = async () => {
    if (!info) return; if (busy) { stale = true; return; }   // w czasie zapisu podgląd po jego końcu
    stale = false; previewJob?.cancel(); const mine = ++previewN;
    const p = engine.callLong<{ frames: ImageBitmap[]; ms: number }>({ type: 'videoPreview', state: state() }, (d, t) => { if (mine === previewN) { bar.hidden = false; fill.style.width = `${(100 * d) / t}%`; } });
    previewJob = p;
    try {
      const r = await p.promise;
      if (mine !== previewN || !alive) { r.frames.forEach((b) => b.close()); return; }
      frames.forEach((b) => b.close()); frames = r.frames; bar.hidden = true; play();
      if (!loadNote && msg.dataset.kind !== 'error') setMsg('');
    } catch (e) { const m = (e as Error).message; if (m !== CANCELLED && mine === previewN) { setMsg(explain(m), 'error'); bar.hidden = true; } }
  };
  let tm: number | undefined;
  const schedule = () => { clearTimeout(tm); tm = window.setTimeout(preview, 200); };

  const play = () => {
    cancelAnimationFrame(raf); if (!frames.length || !info) return;
    canvas.width = frames[0].width; canvas.height = frames[0].height; canvas.hidden = false;
    const g = canvas.getContext('2d')!; const fps = info.fps, n = frames.length; const t0 = performance.now(); let last = -1;
    const tick = (now: number) => { if (!alive) return; const k = Math.floor(((now - t0) / 1000) * fps) % n; if (k !== last && frames[k]) { g.drawImage(frames[k], 0, 0); last = k; } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  };

  const save = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000); };
  const download = async () => {
    if (!info || busy) return; busy = true; const fmt = val('format') as 'gif' | 'mp4';
    const scale = Number(val('side')) / Math.max(info.w, info.h); const cancelBtn = $<HTMLButtonElement>('[data-cancel]'); cancelBtn.hidden = false;
    const l = engine.callLong<ExportRes>({ type: 'videoExport', state: state(), scale, format: fmt, codec: (window as any).__videoCodec }, progress(`Koduję ${fmt.toUpperCase()}`)); job = l;
    try {
      const r = await l.promise; const base = (file?.name ?? 'film').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.-]+/g, '-').slice(0, 40) || 'film';
      const name = `${base}-${effSel.value}.${fmt}`; save(r.blob, name);
      setMsg(`Gotowe: ${name}, ${r.w}×${r.h} px, ${info.n} klatek (${info.used.toFixed(1)} s × ${info.fps} fps), ${(r.blob.size / 1048576).toFixed(1)} MB.`);
    } catch (e) { const m = (e as Error).message; setMsg(m === CANCELLED ? 'Przerwano.' : explain(m), m === CANCELLED ? '' : 'error'); }
    finally { busy = false; job = null; bar.hidden = true; cancelBtn.hidden = true; if (stale) preview(); }
  };

  drop.addEventListener('click', (e) => { if (!file && !(e.target as Element).closest('form')) fileIn.click(); });
  drop.addEventListener('keydown', (e) => { if (!file && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileIn.click(); } });
  fileIn.addEventListener('change', () => { const f = fileIn.files?.[0]; if (f) load(f); fileIn.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('logo__drop--over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('logo__drop--over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('logo__drop--over'); const f = e.dataTransfer?.files[0]; if (f) load(f); });
  form.addEventListener('change', (e) => {
    const el = e.target as HTMLElement;
    if (el === effSel) { buildParams(); schedule(); }
    else if ((el as HTMLSelectElement).name === 'fps' && file) load(file);   // inna liczba klatek: dekodujemy od nowa
  });
  form.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('[data-download]')) download();
    if (t.closest('[data-cancel]')) job?.cancel();
    if (t.closest('[data-another]')) fileIn.click();
  });
  const stopScenes = mountScenes(main);

  (window as any).__videoTest = { load: (f: File) => load(f), info: () => info, frames: () => frames.length, idle: () => !busy && !job && !loadJob,
    /* średnia jasność klatki podglądu i (0–255) i jej rozmiar, do testów zgodności podglądu z filmem */
    luma: (i: number) => { const b = frames[i]; if (!b) return null; const c = new OffscreenCanvas(b.width, b.height); const g = c.getContext('2d')!; g.drawImage(b, 0, 0); const d = g.getImageData(0, 0, b.width, b.height).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; return { mean: s / (d.length / 4), w: b.width, h: b.height }; },
    setEffect: (id: string) => { effSel.value = id; buildParams(); return preview(); } };
  return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(tm); job?.cancel(); loadJob?.cancel(); previewJob?.cancel(); frames.forEach((b) => b.close()); frames = []; stopScenes(); delete (window as any).__videoTest; };
}
