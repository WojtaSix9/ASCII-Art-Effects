// Strona /logo (etap 2, krok 8; plik 09, sekcja 7; decyzja użytkownika: osobna strona). Narzędzie „image to ascii” z ascii.rest/make:
// wejścia (SVG, PNG, JPG, WebP, GIF: przeciągnięcie, wybór, wklejenie), style logo i shade, ruch glint lub scan co `every` s,
// wyjścia TS (plik biblioteki), SVG (ciemne i jasne tło), GIF i MP4. Wszystko w przeglądarce; plik nie jest wysyłany.
import { isSvg, LIMIT, type Drawing, type Source, type Style } from '../../../engine/src/logo/logo.ts';
import { clean, type Kind, type Settings } from '../../../engine/src/logo/logo-file.ts';
import { raster, render } from './source.ts';
import { about, drawLogo, logoSvg, rasterizer, source, START } from './make.ts';

export const logoHtml = () => `
<p class="label">/logo</p>
<h1 tabindex="-1">Logo w ASCII</h1>
<p>Zamienia logo albo ikonę w rysunek ze znaków z błyskiem (glint) albo linią skanu (scan), jak biblioteka <a href="https://ascii.rest" rel="noopener">ascii.rest</a>. Plik nie opuszcza przeglądarki. Używaj własnych znaków albo takich, do których masz prawa.</p>
<div class="logo">
  <div class="logo__drop" data-drop role="button" tabindex="0" aria-label="Wczytaj obraz: przeciągnij, wybierz albo wklej">
    <canvas class="logo__canvas" data-canvas role="img" aria-label="Podgląd logo w znakach" hidden></canvas>
    <p class="logo__prompt" data-prompt>Przeciągnij tu plik, <u>wybierz go</u> albo wklej (Ctrl+V).<br><span class="ed-hint">SVG, PNG, JPG, WebP, GIF</span></p>
    <input type="file" data-file accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" hidden>
  </div>
  <form class="logo__panel" data-form onsubmit="return false" hidden>
    <label>Nazwa <input type="text" name="name" maxlength="32" autocomplete="off"></label>
    <label>Szerokość <span><input type="number" name="width" min="16" max="${LIMIT.cols}" step="1" value="64" inputmode="numeric"> kolumn, najwyżej ${LIMIT.cols}</span></label>
    <fieldset><legend>Styl</legend>
      <label><input type="radio" name="style" value="logo" checked> logo <span class="ed-hint">(znak dopasowany do kształtu krawędzi)</span></label>
      <label><input type="radio" name="style" value="shade"> shade <span class="ed-hint">(znak wg jasności, dla zdjęć)</span></label></fieldset>
    <fieldset><legend>Kategoria i ruch</legend>
      <label><input type="radio" name="category" value="companies" checked> companies <span class="ed-hint">(glint)</span></label>
      <label><input type="radio" name="category" value="logos"> logos <span class="ed-hint">(glint)</span></label>
      <label><input type="radio" name="category" value="distros"> distros <span class="ed-hint">(scan)</span></label></fieldset>
    <label>Co ile <span><input type="number" name="every" min="3" max="60" step="1" value="5" inputmode="numeric"> s</span></label>
    <button type="button" class="ed-btn" data-ground hidden></button>
    <p class="ed-hint" data-facts role="status"></p>
    <div class="logo__out">
      <label>Format <select class="ed-btn" name="format" data-format>
        <option value="ts">.ts (plik biblioteki ascii.rest)</option>
        <option value="svg">SVG, ciemne tło</option>
        <option value="svg-light">SVG, jasne tło</option>
        <option value="gif">GIF</option>
        <option value="mp4">MP4 (wideo H.264)</option>
      </select></label>
      <label data-side hidden>Szerokość <select class="ed-btn" name="side"><option value="480">480 px</option><option value="720" selected>720 px</option><option value="1080">1080 px</option></select></label>
      <button type="button" class="ed-btn ed-btn--primary" data-download>Pobierz</button>
    </div>
    <div class="ed-anim__bar" data-bar hidden><span></span></div>
    <p class="ed-note" data-msg role="status"></p>
    <button type="button" class="ed-btn" data-another>Inny obraz</button>
  </form>
</div>
<p class="ed-hint">Styl logo, usuwanie tła i plik .ts: kod z <a href="https://github.com/bas3line/ascii" rel="noopener">bas3line/ascii</a> (MIT). Format .ts to plik biblioteki ascii.rest (do 80 × 32 znaków).</p>`;

export function mountLogo(main: HTMLElement): () => void {
  const $ = <T extends Element = HTMLElement>(s: string) => main.querySelector<T>(s)!;
  const drop = $('[data-drop]'), fileIn = $<HTMLInputElement>('[data-file]'), canvas = $<HTMLCanvasElement>('[data-canvas]'), form = $<HTMLFormElement>('[data-form]');
  const msg = $('[data-msg]'), facts = $('[data-facts]'), groundBtn = $<HTMLButtonElement>('[data-ground]');
  let src: Source | null = null, image: Blob | null = null, file = '', keepGround = false, drawing: Drawing | null = null, reading = 0, raf = 0, alive = true, busy = false;
  const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | RadioNodeList).value;
  const width = () => Math.max(16, Math.min(LIMIT.cols, Math.round(+val('width')) || 64));
  const settings = (): Settings => ({ proper: val('name'), file, category: val('category') as Kind, every: +val('every') || 5 });

  /** Wczytanie (jak load() w ascii.rest/make): SVG jako obraz bez skryptów, reszta przez createImageBitmap; tło usuwane, jeśli jest. */
  const load = async (blob: Blob, name: string) => {
    const mine = ++reading; msg.textContent = 'Wczytuję…';
    try {
      const next = isSvg({ type: blob.type, name }) ? await render(await blob.text()) : await raster(blob, { keepGround });
      if (mine !== reading || !alive) return;
      src = next; image = blob; file = name;
      if (!val('name')) (form.elements.namedItem('name') as HTMLInputElement).value = clean(name.replace(/\.[a-z0-9]+$/i, '')).slice(0, 32);
      /* zdjęcie albo obraz bez gładkiego tła wygląda najlepiej w stylu shade (jak w ascii.rest/make) */
      (form.querySelector<HTMLInputElement>(`input[name="style"][value="${src.photo ? 'shade' : 'logo'}"]`)!).checked = true;
      groundBtn.hidden = !src.ground && !keepGround; groundBtn.textContent = keepGround ? 'Usuń tło' : `Zostaw tło (${src.ground ?? ''})`;
      msg.textContent = ''; redraw();
    } catch (e) { if (mine === reading) msg.textContent = (e as Error).message; }
  };
  const redraw = () => {
    if (!src) return;
    drawing = drawLogo(src, width(), val('style') as Style);
    const a = about(drawing, settings()); const n = drawing.colors.length;
    facts.textContent = `${drawing.cols}×${drawing.rows} znaków, ${n === 1 ? '1 kolor' : `${n} ${n < 5 ? 'kolory' : 'kolorów'}`}, ${a.scan ? 'scan' : 'glint'} co ${a.every} s, plik ${a.slug}.ts`;
    form.hidden = false; canvas.hidden = false; $('[data-prompt]').hidden = true; drop.classList.add('logo__drop--full'); play();
  };
  /** Podgląd: pętla w czasie rzeczywistym (24 fps, komórka 10 × 20 px, ciemne tło). */
  const play = () => {
    cancelAnimationFrame(raf); if (!drawing) return;
    const r = rasterizer(drawing, settings(), 24, 10); canvas.width = r.w; canvas.height = r.h; const g = canvas.getContext('2d')!; const t0 = performance.now(); let last = -1;
    const tick = (now: number) => { if (!alive) return; const k = Math.floor((((now - t0) / 1000) % r.every) * r.fps) % r.n; if (k !== last) { g.putImageData(new ImageData(r.paint(k) as Uint8ClampedArray<ArrayBuffer>, r.w, r.h), 0, 0); last = k; } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  };
  const save = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000); };

  /** Eksport animacji GIF/MP4 w wątku strony: klatki z rasterizer(), kodery z app/src/engine (gif.ts, mp4.ts). */
  const exportAnim = async (fmt: 'gif' | 'mp4') => {
    if (!drawing || busy) return; busy = true; const bar = $('[data-bar]'), fill = bar.firstElementChild as HTMLElement; bar.hidden = false;
    try {
      const side = Number(val('side')); const cw = Math.max(2, Math.floor(side / drawing.cols)); const r = rasterizer(drawing, settings(), 24, cw);
      await document.fonts.load(`${Math.round(cw / 0.6)}px "Geist Mono"`, '8/#');
      const prog = (done: number, total: number) => { fill.style.width = `${(100 * done) / total}%`; msg.textContent = `Koduję ${fmt.toUpperCase()}: ${done} z ${total}…`; };
      const frame = async (k: number) => { await new Promise((res) => setTimeout(res, 0)); return r.paint(k); };
      const slug = about(drawing, settings()).slug; let blob: Blob, w = r.w, h = r.h;
      if (fmt === 'gif') { const { encodeGif } = await import('../engine/gif.ts'); blob = new Blob([await encodeGif(frame, r.n, r.w, r.h, r.fps, prog) as BlobPart], { type: 'image/gif' }); }
      else {
        const { encodeMp4, evenDims, mp4Supported } = await import('../engine/mp4.ts'); const e = evenDims(r.w, r.h); w = e.w; h = e.h;
        if (!(await mp4Supported('avc', e.w, e.h))) { msg.textContent = 'Ta przeglądarka nie koduje wideo H.264 (WebCodecs), więc MP4 nie powstanie. Wybierz GIF albo użyj Chrome, Edge lub Safari.'; return; }
        blob = new Blob([await encodeMp4(frame, r.n, r.w, e.w, e.h, r.fps, 'avc', prog) as BlobPart], { type: 'video/mp4' });
      }
      save(blob, `${slug}.${fmt}`); msg.textContent = `Gotowe: ${slug}.${fmt}, ${w}×${h} px, ${r.n} klatek (${r.every} s × ${r.fps} fps), ${(blob.size / 1048576).toFixed(1)} MB.`;
    } catch (e) { msg.textContent = `Błąd eksportu: ${(e as Error).message}`; }
    finally { busy = false; bar.hidden = true; }
  };
  const download = async (kind: string) => {
    if (!drawing) return; const s = settings(); const slug = about(drawing, s).slug;
    if (kind === 'ts') { const ts = source(drawing, s); save(new Blob([ts], { type: 'text/plain;charset=utf-8' }), `${slug}.ts`); msg.textContent = `Gotowe: ${slug}.ts, ${(new TextEncoder().encode(ts).length / 1024).toFixed(1)} kB. Plik do src/pieces biblioteki ascii.rest.`; }
    else if (kind === 'svg' || kind === 'svg-light') { const svg = logoSvg(drawing, s, kind === 'svg'); const name = kind === 'svg' ? `${slug}.dark.svg` : `${slug}.svg`; save(new Blob([svg], { type: 'image/svg+xml' }), name); msg.textContent = `Gotowe: ${name}, ${Math.round(svg.length / 1024)} kB, pętla ${about(drawing, s).every} s.`; }
    else await exportAnim(kind as 'gif' | 'mp4');
  };

  drop.addEventListener('click', (e) => { if (!src && !(e.target as Element).closest('form')) fileIn.click(); });
  drop.addEventListener('keydown', (e) => { if (!src && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileIn.click(); } });
  fileIn.addEventListener('change', () => { const f = fileIn.files?.[0]; if (f) { keepGround = false; load(f, f.name); } fileIn.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('logo__drop--over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('logo__drop--over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('logo__drop--over'); const f = e.dataTransfer?.files[0]; if (f) { keepGround = false; load(f, f.name); } });
  const onPaste = (e: ClipboardEvent) => {
    const f = [...(e.clipboardData?.files ?? [])][0]; if (f) { keepGround = false; load(f, f.name || 'wklejony obraz'); return; }
    const t = e.clipboardData?.getData('text/plain') ?? ''; if (/<svg[\s>]/i.test(t)) { keepGround = false; load(new Blob([t], { type: 'image/svg+xml' }), 'wklejony.svg'); }
  };
  document.addEventListener('paste', onPaste);
  groundBtn.addEventListener('click', () => { if (!image) return; keepGround = !keepGround; load(image, file); });
  let tm: number | undefined;
  form.addEventListener('input', (e) => { const n = (e.target as HTMLInputElement).name; if (n === 'side' || n === 'format') return; clearTimeout(tm); tm = window.setTimeout(redraw, n === 'width' || n === 'name' || n === 'every' ? 250 : 0); });
  /* najpierw wybór formatu z listy, pobranie dopiero przyciskiem (prośba użytkownika); szerokość tylko dla GIF i MP4 */
  const syncFormat = () => { const f = val('format'); $('[data-side]').hidden = f !== 'gif' && f !== 'mp4'; };
  form.addEventListener('change', (e) => { if ((e.target as HTMLElement).matches('[data-format]')) syncFormat(); });
  form.addEventListener('click', (e) => { if ((e.target as Element).closest('[data-download]')) download(val('format')); if ((e.target as Element).closest('[data-another]')) fileIn.click(); });
  syncFormat();

  (window as any).__logoTest = { load: (b: Blob, n: string) => load(b, n), drawing: () => drawing, settings, ts: () => (drawing ? source(drawing, settings()) : null), svg: (dark: boolean) => (drawing ? logoSvg(drawing, settings(), dark) : null), START };
  return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(tm); document.removeEventListener('paste', onPaste); delete (window as any).__logoTest; };
}

