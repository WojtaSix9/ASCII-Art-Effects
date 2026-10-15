// Edytor (05, sekcja 8; krok 5 briefu). Układ: pasek górny (zoom, porównanie, cofnij/ponów) │ lewy panel stylów │
// płótno z paskiem dolnym (Wczytaj, Losuj, Eksport) │ szyna ikon │ prawy panel (Styl, Color, Post FX).
// Decyzje użytkownika: bez Ulubionych; eksport PNG i JPG @1x/@2x; Lights i Animacja wyszarzone (Lights: projekt do akceptacji).
import { SAMPLES } from '../config/sample.ts';
import { MAX_SOURCE } from '../config/limits.ts';
import { READY, thumbUrl } from '../config/thumbs.ts';
import { sharedEngine } from '../engine/client.ts';
import { LIMIT_ERROR, type EffectMeta, type ExportRes, type PostDefs, type RenderRes } from '../engine/protocol.ts';
import { cropPixels, loadImage, paint, previewScale } from '../engine/preview.ts';
import { CATEGORIES, matches } from '../effects/catalog.ts';
import { mountParamPanel, type Values } from '../ui/param-panel.ts';
import { mountCurves } from '../ui/curves-editor.ts';
import type { Curves } from '../../../engine/src/post/grade.ts';
import { ICON } from './icons.ts';
import { lightsHtml, mountLights } from './lights-ui.ts';
import { History, initialState, toRenderState, type EditorState } from './state.ts';

const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const editorHtml = () => `
<h1 class="sr-only" tabindex="-1">Edytor</h1>
<div class="ed" data-ed>
  <aside class="ed-left" data-left aria-label="Style">
    <div class="ed-left__head"><h2 class="ed-left__title">Style</h2>
      <button type="button" class="ed-icon" data-collapse aria-expanded="true" aria-controls="ed-left-body" title="Zwiń panel stylów">${ICON.panel}</button></div>
    <div id="ed-left-body" class="ed-left__body">
      <label class="sr-only" for="ed-search">Szukaj stylu</label>
      <input id="ed-search" class="ed-search" data-search type="search" placeholder="Szukaj nazwy lub tagu" autocomplete="off">
      <div data-styles></div>
      <p class="ed-left__more"><a href="/effects">Wszystkie efekty (także „wkrótce”)</a></p>
    </div>
  </aside>
  <section class="ed-center" aria-label="Płótno">
    <div class="ed-stage" data-stage aria-busy="true">
      <div class="ed-canvas-wrap" data-wrap>
        <canvas class="ed-canvas" data-canvas role="img"></canvas>
        <canvas class="ed-canvas ed-canvas--before" data-before aria-hidden="true" hidden></canvas>
      </div>
      <div class="ed-drop" data-drop hidden><p>Upuść zdjęcie, żeby je wczytać</p></div>
    </div>
    <div class="ed-toolbar" role="toolbar" aria-label="Zdjęcie i eksport">
      <label class="ed-tb"><input type="file" accept="image/*" data-file class="sr-only">${ICON.upload}<span>Wczytaj</span></label>
      <select class="ed-tb ed-tb--select" data-sample aria-label="Zdjęcie robocze">${SAMPLES.map((s, i) => `<option value="${i + 1}">Zdjęcie ${i + 1}</option>`).join('')}<option value="user" hidden>Twoje zdjęcie</option></select>
      <button type="button" class="ed-tb" data-reseed title="Nowy seed efektu">${ICON.dice}<span>Losuj</span></button>
      <button type="button" class="ed-tb ed-tb--primary" data-export>${ICON.download}<span>Eksport</span></button>
    </div>
    <p class="ed-note" data-note role="status"></p>
  </section>
  <nav class="ed-rail" aria-label="Zakładki panelu" data-rail>
    <button type="button" data-tab="style" aria-pressed="true" title="Parametry stylu">${ICON.style}<span class="sr-only">Styl</span></button>
    <button type="button" disabled title="Animacja: wersja 2">${ICON.play}<span class="sr-only">Animacja (wersja 2)</span></button>
    <button type="button" data-tab="lights" aria-pressed="false" title="Lights">${ICON.sun}<span class="sr-only">Lights</span></button>
    <button type="button" data-tab="color" aria-pressed="false" title="Color">${ICON.drop}<span class="sr-only">Color</span></button>
    <button type="button" data-tab="postfx" aria-pressed="false" title="Post FX">${ICON.spark}<span class="sr-only">Post FX</span></button>
  </nav>
  <aside class="ed-panel" aria-label="Parametry" data-panel-root>
    <div data-tabpanel="style">
      <div class="pp-sec"><label class="pp-title" for="ed-style">/ Styl</label><select id="ed-style" data-style></select></div>
      <form class="pp" data-panel onsubmit="return false"></form>
    </div>
    <div data-tabpanel="color" hidden>
      <form class="pp" data-color onsubmit="return false"></form>
      <form class="pp" data-levels onsubmit="return false"></form>
      <div class="pp-sec"><h3 class="pp-title">/ Curves</h3><div data-curves></div></div>
      <p><button type="button" class="ed-btn" data-color-reset>Resetuj Color, Levels i Curves</button></p>
    </div>
    <div data-tabpanel="postfx" hidden><div data-postfx></div></div>
    <div data-tabpanel="lights" hidden>${lightsHtml()}</div>
    <p class="ed-meta" data-meta aria-live="off"></p>
  </aside>
</div>
<dialog class="ed-dialog" data-dialog aria-labelledby="ed-export-h">
  <form method="dialog" data-export-form>
    <h2 id="ed-export-h" class="pp-title">/ Eksport</h2>
    <fieldset><legend>Format</legend>
      <label><input type="radio" name="format" value="png" checked> PNG</label>
      <label><input type="radio" name="format" value="jpeg"> JPG <span class="ed-hint">(bez przezroczystości, tło czarne)</span></label></fieldset>
    <fieldset><legend>Skala</legend>
      <label><input type="radio" name="scale" value="1" checked> @1x <span class="ed-hint" data-size="1"></span></label>
      <label><input type="radio" name="scale" value="2"> @2x <span class="ed-hint" data-size="2"></span></label></fieldset>
    <p class="ed-note" data-export-msg role="status"></p>
    <div class="ed-dialog__actions"><button type="button" class="ed-btn" data-cancel>Anuluj</button><button type="submit" class="ed-btn ed-btn--primary" data-go>Pobierz</button></div>
  </form>
</dialog>`;

const toolsHtml = () => `
  <button type="button" class="ed-icon" data-zoom="-1" title="Pomniejsz" aria-label="Pomniejsz">−</button>
  <button type="button" class="ed-zoom" data-zoom="fit" title="Dopasuj do okna">100%</button>
  <button type="button" class="ed-icon" data-zoom="1" title="Powiększ" aria-label="Powiększ">+</button>
  <span class="ed-sep" aria-hidden="true"></span>
  <button type="button" class="ed-icon" data-compare aria-pressed="false" title="Porównaj z oryginałem">${ICON.compare}<span class="sr-only">Porównaj z oryginałem</span></button>
  <span class="ed-sep" aria-hidden="true"></span>
  <button type="button" class="ed-icon" data-undo disabled title="Cofnij (Ctrl+Z)">${ICON.undo}<span class="sr-only">Cofnij</span></button>
  <button type="button" class="ed-icon" data-redo disabled title="Ponów (Ctrl+Shift+Z)">${ICON.redo}<span class="sr-only">Ponów</span></button>`;

export function mountEditor(root: HTMLElement, url: URL): () => void {
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const tools = document.querySelector<HTMLElement>('[data-ed-tools]');
  if (tools) tools.innerHTML = toolsHtml();
  const T = <E extends Element = HTMLElement>(s: string) => (tools ?? root).querySelector<E>(s)!;
  const stage = $('[data-stage]'), wrap = $('[data-wrap]'), canvas = $<HTMLCanvasElement>('[data-canvas]'), before = $<HTMLCanvasElement>('[data-before]');
  const styleSel = $<HTMLSelectElement>('[data-style]'), sampleSel = $<HTMLSelectElement>('[data-sample]'), panel = $<HTMLFormElement>('[data-panel]');
  const note = $('[data-note]'), meta = $('[data-meta]'), dialog = $<HTMLDialogElement>('[data-dialog]');
  const engine = sharedEngine();
  let alive = true, defs: EffectMeta[] = [], post: PostDefs = { postFx: [], glyphStyles: [], color: [], lights: { params: [], ambient: { id: 'ambient', label: 'Ambient', kind: 'range', default: 100 }, max: 4, skip: [] } };
  let lights: ReturnType<typeof mountLights> | null = null;
  let state: EditorState = initialState('characters');
  const history = new History();
  let img: CanvasImageSource & { width: number; height: number } | null = null;
  let src = { w: 0, h: 0 }, zoom = 1, scale = 1, sizedKey = '', started = false;

  const say = (msg: string, kind = '') => { note.textContent = msg; note.dataset.kind = kind; };

  // ---------- render ----------
  const render = async () => {
    if (!img || !defs.length) return;
    stage.setAttribute('aria-busy', 'true');
    try {
      const out = await engine.render(toRenderState(state), scale);
      if (!alive || !out) return;
      paint(canvas, out.image); stage.dataset.rendered = state.style;
      meta.textContent = `Podgląd ${out.image.width}×${out.image.height} px (skala ${scale.toFixed(2)}), render ${out.workerMs.toFixed(0)} ms`;
      if (note.dataset.kind === 'error') say('');
    } catch (e) { say(`Błąd renderu: ${(e as Error).message}`, 'error'); }
    finally { if (alive) stage.setAttribute('aria-busy', 'false'); }
  };

  // ---------- rozmiar, zoom, porównanie ----------
  const layout = (force = false) => {
    if (!img) return;
    const W = stage.clientWidth - 48, H = stage.clientHeight - 48; if (W <= 0 || H <= 0) return;
    const fit = Math.min(W / src.w, H / src.h, 1);
    const cw = Math.max(1, Math.round(src.w * fit * zoom)), ch = Math.max(1, Math.round(src.h * fit * zoom));
    const key = `${cw}x${ch}x${devicePixelRatio}`; if (key === sizedKey && !force) return; sizedKey = key;
    for (const c of [canvas, before]) { c.style.width = cw + 'px'; c.style.height = ch + 'px'; }
    wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
    const s = previewScale(src.w, src.h, cw, ch);
    T<HTMLButtonElement>('[data-zoom="fit"]').textContent = `${Math.round(zoom * 100)}%`;
    stage.dataset.scale = s.toFixed(3); stage.classList.toggle('is-zoomed', zoom > 1);
    const changed = Math.abs(s - scale) > 1e-6 || force; scale = s;
    drawBefore();
    if (changed) render();
  };
  const drawBefore = () => {
    if (!img) return; const w = Math.round(src.w * scale), h = Math.round(src.h * scale);
    before.width = w; before.height = h; before.getContext('2d')!.drawImage(img, 0, 0, w, h);
  };
  const setZoom = (z: number) => { zoom = Math.min(4, Math.max(0.25, z)); layout(); };
  if (tools) tools.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
    if (b.dataset.zoom === 'fit') setZoom(1);
    else if (b.dataset.zoom) { const d = Number(b.dataset.zoom); setZoom(d > 0 ? ZOOMS.find((z) => z > zoom + 1e-6) ?? 4 : [...ZOOMS].reverse().find((z) => z < zoom - 1e-6) ?? 0.25); }
    else if (b.hasAttribute('data-compare')) { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); before.hidden = !on; }
    else if (b.hasAttribute('data-undo')) restore(history.undo());
    else if (b.hasAttribute('data-redo')) restore(history.redo());
  };
  stage.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
  // Przesuwanie powiększonego obrazu przeciąganiem (scena przewija się natywnie).
  let pan: { x: number; y: number; sl: number; st: number } | null = null;
  stage.addEventListener('pointerdown', (e) => { if (zoom <= 1 || e.button !== 0) return; pan = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => { if (!pan) return; stage.scrollLeft = pan.sl - (e.clientX - pan.x); stage.scrollTop = pan.st - (e.clientY - pan.y); });
  stage.addEventListener('pointerup', () => { pan = null; });
  let t: number | undefined, layoutPending = false, loading = 0;
  const ro = new ResizeObserver(() => { clearTimeout(t); layoutPending = true; t = window.setTimeout(() => { layoutPending = false; layout(); }, 150); });

  // ---------- historia ----------
  const syncHistoryButtons = () => { T<HTMLButtonElement>('[data-undo]').disabled = !history.canUndo; T<HTMLButtonElement>('[data-redo]').disabled = !history.canRedo; };
  const commit = () => { history.commit(state); syncHistoryButtons(); };
  const restore = (s: EditorState | null) => { if (!s) return; state = s; syncUrl(); buildStylePanel(); buildColor(); buildPostFx(); lights?.build(); markStyle(); syncLightsTab(); syncHistoryButtons(); render(); };
  const onKey = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest('input[type="text"], input[type="search"], input[type="number"]')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); restore(history.undo()); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); restore(history.redo()); }
  };
  document.addEventListener('keydown', onKey);

  // ---------- adres ----------
  const syncUrl = () => {
    const u = new URL(location.href); u.searchParams.set('style', state.style);
    if (sampleSel.value === 'user') u.searchParams.delete('sample'); else u.searchParams.set('sample', sampleSel.value);
    window.history.replaceState(null, '', u);
  };

  // ---------- lewy panel: style ----------
  const stylesBox = $('[data-styles]');
  const drawStyles = (q = '') => {
    const list = READY.filter((e) => matches(e, q, ''));
    stylesBox.innerHTML = list.length ? CATEGORIES.map((c) => {
      const items = list.filter((e) => e.category === c); if (!items.length) return '';
      return `<h3 class="ed-cat">${esc(c)}</h3><ul class="ed-styles">${items.map((e) => `<li><button type="button" data-pick="${e.id}" aria-pressed="${e.id === state.style}">
        <img src="${thumbUrl(e.id)}" alt="" width="96" height="67" loading="lazy" decoding="async"><span>${esc(e.name)}</span></button></li>`).join('')}</ul>`;
    }).join('') : '<p class="ed-empty">Brak stylu o tej nazwie.</p>';
  };
  const markStyle = () => stylesBox.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pick === state.style)));
  $<HTMLInputElement>('[data-search]').addEventListener('input', (e) => drawStyles((e.target as HTMLInputElement).value));
  stylesBox.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-pick]'); if (b) selectStyle(b.dataset.pick!); });
  const left = $('[data-left]');
  $('[data-collapse]').addEventListener('click', (e) => {
    const b = e.currentTarget as HTMLButtonElement; const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open)); left.classList.toggle('is-collapsed', !open); b.title = open ? 'Zwiń panel stylów' : 'Rozwiń panel stylów';
  });

  // ---------- prawy panel ----------
  const buildStylePanel = () => {
    const e = defs.find((d) => d.id === state.style); if (!e) return;
    styleSel.value = e.id;
    const read = mountParamPanel(panel, e.name, e.params, state.params[e.id] ?? {},
      (v) => { state.params[e.id] = v; render(); }, (v) => { state.params[e.id] = v; commit(); });
    state.params[e.id] = read();
  };
  const selectStyle = (id: string) => {
    if (!defs.some((d) => d.id === id)) return;
    state.style = id; buildStylePanel(); markStyle(); syncLightsTab(); syncGlyphFx(); syncUrl(); commit(); render();
  };
  /** Dither nie używa świateł (plik 01): zakładka Lights wyłączona, przy otwartej wracamy do Stylu. */
  const syncLightsTab = () => {
    const b = $<HTMLButtonElement>('[data-tab="lights"]'); const off = post.lights.skip.includes(state.style);
    b.disabled = off; b.title = off ? `${defs.find((d) => d.id === state.style)?.name ?? ''} nie używa świateł` : 'Lights';
    if (off && b.getAttribute('aria-pressed') === 'true') showTab('style');
  };
  styleSel.addEventListener('change', () => selectStyle(styleSel.value));

  // Zakładka Color: sekcje Color (kolejność jak w oryginale, plik 01 sekcja 7), Levels, Curves; wszystkie piszą do state.color.
  const COLOR_ORDER = ['preset', 'photoFilter', 'photoDensity', 'photoPreserve', 'tint', 'tintOpacity', 'blend', 'saturation', 'vibrance', 'hue', 'gradientMap', 'gradientAmount', 'grayscale', 'invertImage'];
  const buildColor = () => {
    const by = (ids: string[]) => ids.map((id) => post.color.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d);
    const levelIds = post.color.filter((d) => d.id.startsWith('levels')).map((d) => d.id);
    const merge = (v: Values) => { state.color = { ...state.color, ...v }; };
    mountParamPanel($('[data-color]'), 'Color', by(COLOR_ORDER), state.color, (v) => { merge(v); render(); }, (v) => { merge(v); commit(); }, { sections: false });
    mountParamPanel($('[data-levels]'), 'Levels', by(levelIds), state.color, (v) => { merge(v); render(); }, (v) => { merge(v); commit(); }, { sections: false });
    const def = post.color.find((d) => d.id === 'curves')!.default as Curves;
    mountCurves($('[data-curves]'), (state.color.curves as Curves | undefined) ?? def, (c) => { state.color = { ...state.color, curves: c }; render(); }, (c) => { state.color = { ...state.color, curves: c }; commit(); });
  };
  $('[data-color-reset]').addEventListener('click', () => { state.color = {}; buildColor(); commit(); render(); });

  const fxBox = $('[data-postfx]');
  const buildPostFx = () => {
    fxBox.innerHTML = `<p class="pp-title">/ Post FX</p><p class="ed-hint">Kolejność stała: od góry do dołu.</p>${post.postFx.map((f) => `
      <div class="ed-fx" data-fx="${f.id}"><label class="ed-fx__on"><input type="checkbox" data-fx-on="${f.id}"${state.postFx[f.id] ? ' checked' : ''}> ${esc(f.name)}</label>
      ${f.glyphOnly ? `<p class="ed-hint" data-fx-note hidden>Tylko style znakowe: Characters, Block, Braille.</p>` : ''}
      <form class="pp ed-fx__params" data-fx-params="${f.id}" onsubmit="return false"${state.postFx[f.id] ? '' : ' hidden'}></form></div>`).join('')}`;
    for (const f of post.postFx) if (state.postFx[f.id]) mountFx(f.id);
    syncGlyphFx();
  };
  /** Character Bloom i Chromatic działają tylko w stylach glifowych (plik 01, sekcja 8). W innych są wyszarzone; ustawienia zostają
   *  w stanie, więc po powrocie do stylu glifowego wracają (silnik i tak je pomija). */
  const syncGlyphFx = () => {
    const on = post.glyphStyles.includes(state.style);
    for (const f of post.postFx) if (f.glyphOnly) {
      const row = fxBox.querySelector<HTMLElement>(`[data-fx="${f.id}"]`); if (!row) continue;
      row.classList.toggle('is-off', !on); row.querySelector<HTMLInputElement>('[data-fx-on]')!.disabled = !on;
      row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-fx-params] input, [data-fx-params] select').forEach((el) => { el.disabled = !on; });
      row.querySelector<HTMLElement>('[data-fx-note]')!.hidden = on;
    }
  };
  const mountFx = (id: string) => {
    const f = post.postFx.find((x) => x.id === id)!; const box = fxBox.querySelector<HTMLFormElement>(`[data-fx-params="${id}"]`)!;
    box.hidden = false;
    state.postFx[id] = mountParamPanel(box, '', f.params, state.postFx[id] ?? {}, (v) => { state.postFx[id] = v; render(); }, (v) => { state.postFx[id] = v; commit(); }, { sections: false })();
    if (f.glyphOnly) syncGlyphFx();
  };
  fxBox.addEventListener('change', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLInputElement>('[data-fx-on]'); if (!c) return;
    const id = c.dataset.fxOn!;
    if (c.checked) mountFx(id); else { delete state.postFx[id]; const box = fxBox.querySelector<HTMLElement>(`[data-fx-params="${id}"]`)!; box.hidden = true; box.innerHTML = ''; }
    commit(); render();
  });

  const rail = $('[data-rail]');
  const showTab = (name: string) => {
    rail.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === name)));
    root.querySelectorAll<HTMLElement>('[data-tabpanel]').forEach((p) => { p.hidden = p.dataset.tabpanel !== name; });
  };
  rail.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]'); if (b) showTab(b.dataset.tab!); });

  // ---------- źródło: zdjęcie robocze lub własne ----------
  const setSource = async (image: CanvasImageSource & { width: number; height: number }, label: string) => {
    img = image; src = { w: image.width, h: image.height };
    canvas.setAttribute('aria-label', `Podgląd efektu: ${label}`);
    await engine.setSource(cropPixels(image, { sx: 0, sy: 0, sw: src.w, sh: src.h }));
    sizedKey = ''; zoom = 1; lights?.drawBg();
  };
  const useSample = async (n: number) => {
    const s = SAMPLES[n - 1] ?? SAMPLES[0]; const i = await loadImage(s.src); if (!alive) return;
    sampleSel.value = String(SAMPLES.indexOf(s) + 1);
    await setSource(Object.assign(i, { width: i.naturalWidth, height: i.naturalHeight }), s.alt);
  };
  sampleSel.addEventListener('change', async () => {
    if (sampleSel.value === 'user') return;
    loading++; try { await useSample(Number(sampleSel.value)); syncUrl(); layout(true); } finally { loading--; }
  });
  /** Wczytanie pliku użytkownika: zostaje w przeglądarce; większe niż MAX_SOURCE zmniejszamy. */
  const loadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { say(`„${file.name}” nie jest obrazem.`, 'error'); return; }
    loading++;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const k = Math.min(1, MAX_SOURCE / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
      await setSource(c, file.name);
      const opt = sampleSel.querySelector<HTMLOptionElement>('option[value="user"]')!; opt.hidden = false; sampleSel.value = 'user';
      syncUrl(); layout(true);
      say(k < 1 ? `Wczytano ${file.name}, zmniejszone do ${c.width}×${c.height} px (najdłuższy bok ${MAX_SOURCE} px).` : `Wczytano ${file.name} (${c.width}×${c.height} px).`);
    } catch (e) { say(`Nie udało się wczytać „${file.name}”: ${(e as Error).message}`, 'error'); }
    finally { loading--; }
  };
  $<HTMLInputElement>('[data-file]').addEventListener('change', (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) loadFile(f); (e.target as HTMLInputElement).value = ''; });
  const drop = $('[data-drop]');
  stage.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); drop.hidden = false; } });
  stage.addEventListener('dragleave', (e) => { if (!stage.contains(e.relatedTarget as Node)) drop.hidden = true; });
  stage.addEventListener('drop', (e) => { e.preventDefault(); drop.hidden = true; const f = e.dataTransfer?.files[0]; if (f) loadFile(f); });

  // ---------- Losuj ----------
  $('[data-reseed]').addEventListener('click', () => {
    const e = defs.find((d) => d.id === state.style)!; const seed = e.params.find((p) => p.kind === 'seed');
    if (!seed) { say(`${e.name} nie ma parametru losowego.`); return; }
    state.params[e.id] = { ...state.params[e.id], [seed.id]: Math.floor(Math.random() * ((seed.max ?? 99999) + 1)) };
    buildStylePanel(); commit(); render();
  });

  // ---------- eksport ----------
  const exportBlob = (format: 'png' | 'jpeg', s: number) => engine.call<ExportRes>({ type: 'export', state: toRenderState(state), scale: s, format, quality: 0.92 });
  $('[data-export]').addEventListener('click', () => {
    for (const s of [1, 2]) $(`[data-size="${s}"]`).textContent = `${Math.round(src.w * s)}×${Math.round(src.h * s)} px`;
    $('[data-export-msg]').textContent = ''; dialog.showModal();
  });
  $('[data-cancel]').addEventListener('click', () => dialog.close());
  $<HTMLFormElement>('[data-export-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement); const format = fd.get('format') as 'png' | 'jpeg'; const s = Number(fd.get('scale'));
    const msg = $('[data-export-msg]'), go = $<HTMLButtonElement>('[data-go]');
    go.disabled = true; msg.textContent = 'Renderuję w pełnej rozdzielczości…';
    try {
      const r = await exportBlob(format, s);
      const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob);
      a.download = `ascii-art-${state.style}@${s}x.${format === 'jpeg' ? 'jpg' : 'png'}`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      msg.textContent = `Gotowe: ${r.w}×${r.h} px, ${(r.blob.size / 1048576).toFixed(1)} MB.`;
      setTimeout(() => { if (dialog.open) dialog.close(); }, 800);
    } catch (err) {
      const m = (err as Error).message;
      msg.textContent = m.startsWith(LIMIT_ERROR) ? `Ta przeglądarka nie utworzy obrazu ${m.split(':')[1]} px (limit pamięci kanwy). Wybierz @1x.` : `Błąd eksportu: ${m}`;
    } finally { go.disabled = false; }
  });

  // Haki dla testów (scripts/ui-check.ts): stan i porównanie eksportu z renderem w skali 1.
  (window as any).__editorTest = {
    state: () => structuredClone(state), exportBlob,
    /** Nic się nie dzieje: brak renderu w toku/kolejce, brak oczekującego przeliczenia układu i wczytywania. */
    isIdle: () => started && engine.idle && !layoutPending && !loading,
    renderAt: (s: number) => engine.call<RenderRes>({ type: 'render', state: toRenderState(state), scale: s }),
  };

  // ---------- start ----------
  (async () => {
    const [d, p] = await Promise.all([engine.defs(), engine.postDefs(), useSample(Number(url.searchParams.get('sample')) || 1)]);
    if (!alive) return;
    defs = d; post = p;
    styleSel.innerHTML = defs.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    const want = url.searchParams.get('style'); const ok = !!want && defs.some((e) => e.id === want);
    state = initialState(ok ? want! : 'characters');
    lights = mountLights($('[data-tabpanel="lights"]'), post.lights, { get: () => state, source: () => img, change: () => render(), commit, say });
    drawStyles(); buildStylePanel(); buildColor(); buildPostFx(); lights.build(); markStyle(); syncLightsTab(); syncUrl(); commit();
    if (want && !ok) say(`Efekt „${want}” nie jest jeszcze dostępny. Pokazuję Characters.`);
    layout(true); ro.observe(stage); started = true;
  })().catch((e) => say(`Błąd: ${(e as Error).message}`, 'error'));

  return () => { alive = false; ro.disconnect(); clearTimeout(t); lights?.dispose(); document.removeEventListener('keydown', onKey); delete (window as any).__editorTest; };
}
