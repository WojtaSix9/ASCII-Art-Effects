// Edytor, wersja tymczasowa z kroku 3: płótno ze zdjęciem roboczym i prawy panel parametrów budowany z `params`.
// Pełny układ (lewy panel stylów, pasek górny, eksport) to krok 5 (05, sekcja 8).
import { SAMPLES } from '../config/sample.ts';
import { sharedEngine } from '../engine/client.ts';
import type { EffectMeta } from '../engine/protocol.ts';
import { cropPixels, loadImage, paint, previewScale } from '../engine/preview.ts';
import { mountParamPanel, type Values } from '../ui/param-panel.ts';

export const editorHtml = () => `
<h1 class="sr-only" tabindex="-1">Edytor</h1>
<div class="ed-layout">
  <div class="ed-stage" data-stage aria-busy="true"><canvas class="ed-canvas" data-canvas role="img" aria-label="Podgląd efektu na zdjęciu roboczym"></canvas></div>
  <aside class="ed-panel" aria-label="Parametry">
    <div class="pp-sec"><label class="pp-title" for="ed-style">/ Styl</label><select id="ed-style" data-style></select></div>
    <div class="pp-sec"><label class="pp-title" for="ed-sample">/ Zdjęcie robocze</label><select id="ed-sample" data-sample>${
      SAMPLES.map((s, i) => `<option value="${i + 1}">${i + 1}. ${s.alt.split(',')[0]}</option>`).join('')}</select></div>
    <p class="ed-note" data-note role="status"></p>
    <form class="pp" data-panel onsubmit="return false"></form>
    <p class="ed-meta" data-meta aria-live="off"></p>
  </aside>
</div>`;

export function mountEditor(root: HTMLElement, url: URL): () => void {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const styleSel = root.querySelector<HTMLSelectElement>('[data-style]')!;
  const sampleSel = root.querySelector<HTMLSelectElement>('[data-sample]')!;
  const panel = root.querySelector<HTMLFormElement>('[data-panel]')!;
  const note = root.querySelector<HTMLElement>('[data-note]')!;
  const meta = root.querySelector<HTMLElement>('[data-meta]')!;
  const engine = sharedEngine();
  let alive = true, defs: EffectMeta[] = [], effect: EffectMeta | null = null, values: Values = {};
  let img: HTMLImageElement | null = null, scale = 1, sized = '';

  const render = async () => {
    if (!effect || !img) return;
    stage.setAttribute('aria-busy', 'true');
    try {
      const out = await engine.render({ style: { id: effect.id, params: values } }, scale);
      if (!alive || !out) return;
      paint(canvas, out.image); stage.dataset.rendered = effect.id;
      meta.textContent = `${out.image.width}×${out.image.height} px (skala ${scale.toFixed(2)}), render ${out.workerMs.toFixed(0)} ms`;
      if (note.dataset.kind === 'error') { note.textContent = ''; note.dataset.kind = ''; }
    } catch (e) { note.textContent = `Błąd renderu: ${(e as Error).message}`; note.dataset.kind = 'error'; }
    finally { if (alive) stage.setAttribute('aria-busy', 'false'); }
  };

  const selectStyle = (id: string) => {
    effect = defs.find((d) => d.id === id) ?? null; if (!effect) return;
    styleSel.value = id;
    const u = new URL(location.href); u.searchParams.set('style', id); history.replaceState(null, '', u);   // ?sample zostaje
    values = {};
    const read = mountParamPanel(panel, effect.name, effect.params, {}, (v) => { values = v; render(); });
    values = read();
    render();
  };

  // Płótno mieści zdjęcie w scenie (jak object-fit: contain); podgląd w rozdzielczości ekranu.
  const layout = () => {
    if (!img) return;
    const W = stage.clientWidth - 48, H = stage.clientHeight - 48; if (W <= 0 || H <= 0) return;
    const k = Math.min(W / img.naturalWidth, H / img.naturalHeight, 1);
    const cw = Math.round(img.naturalWidth * k), ch = Math.round(img.naturalHeight * k);
    const key = `${cw}x${ch}x${devicePixelRatio}`; if (key === sized) return; sized = key;   // sized = '' wymusza przeliczenie
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    scale = previewScale(img.naturalWidth, img.naturalHeight, cw, ch);
    stage.dataset.scale = scale.toFixed(3);
    render();
  };
  let t: number | undefined;
  const ro = new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(layout, 150); });

  styleSel.addEventListener('change', () => selectStyle(styleSel.value));

  // Zdjęcie robocze: ?sample=1|2 (domyślnie 1)
  const useSample = async (n: number) => {
    const s = SAMPLES[n - 1] ?? SAMPLES[0]; const i = await loadImage(s.src); if (!alive) return;
    img = i; sampleSel.value = String(SAMPLES.indexOf(s) + 1); canvas.setAttribute('aria-label', `Podgląd efektu: ${s.alt}`);
    await engine.setSource(cropPixels(img, { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight }));
  };
  sampleSel.addEventListener('change', async () => {
    const u = new URL(location.href); u.searchParams.set('sample', sampleSel.value); history.replaceState(null, '', u);
    await useSample(Number(sampleSel.value)); sized = ''; layout();
  });

  (async () => {
    const [d] = await Promise.all([engine.defs(), useSample(Number(url.searchParams.get('sample')) || 1)]);
    if (!alive) return;
    defs = d;
    styleSel.innerHTML = defs.map((e) => `<option value="${e.id}">${e.name}</option>`).join('');
    layout(); ro.observe(stage);   // najpierw rozmiar i skala, potem pierwszy render
    const want = url.searchParams.get('style');
    const ok = want && defs.some((e) => e.id === want);
    if (want && !ok) note.textContent = `Efekt „${want}” nie jest jeszcze dostępny. Pokazuję Characters.`;
    selectStyle(ok ? want! : 'characters');
  })().catch((e) => { note.textContent = `Błąd: ${(e as Error).message}`; });

  return () => { alive = false; ro.disconnect(); clearTimeout(t); };
}
