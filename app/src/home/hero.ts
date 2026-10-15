// Hero strony głównej (05, sekcja 5.1): suwak przed/po na zdjęciu roboczym, chipy efektów, render na żywo w Workerze.
import effects from '../../../engine/src/data/effects.json' with { type: 'json' };
import { HERO_SAMPLE as SAMPLE } from '../config/sample.ts';
import { sharedEngine } from '../engine/client.ts';
import { coverRect, cropPixels, loadImage, paint, previewScale, type Rect } from '../engine/preview.ts';

/** 13 chipów (05: ok. 13 efektów ze statusem ready, pierwszy Characters), potem „…” do /effects. */
export const HERO_CHIPS = ['characters', 'block-chars', 'braille', 'dots', 'halftone', 'pixel', 'lego', 'mosaic', 'hexmosaic', 'dither', 'duotone', 'posterize', 'gradientmap'];
const nameOf = (id: string) => (effects as { id: string; name: string }[]).find((e) => e.id === id)?.name ?? id;

export const heroHtml = () => `
<section class="hero" aria-label="Podgląd efektu">
  <div class="hero__stage" data-stage aria-busy="true">
    <canvas class="hero__img" data-before role="img" aria-label="${SAMPLE.alt}"></canvas>
    <canvas class="hero__img hero__after" data-after aria-hidden="true"></canvas>
    <span class="hero__tag hero__tag--before">Przed</span>
    <span class="hero__tag hero__tag--after">Po</span>
    <div class="hero__divider" data-divider>
      <button type="button" class="hero__handle" data-handle role="slider" aria-label="Porównanie przed i po"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-valuetext="50% oryginału">‹ ›</button>
    </div>
    <div class="hero__chips" role="group" aria-label="Efekt">
      ${HERO_CHIPS.map((id, i) => `<button type="button" class="chip" data-chip="${id}" aria-pressed="${i === 0}">${nameOf(id)}</button>`).join('')}
      <a class="chip" href="/effects" aria-label="Wszystkie efekty">…</a>
    </div>
  </div>
  <div class="hero__copy">
    <h1 tabindex="-1">Zdjęcie jako ASCII, piksele i&nbsp;druk</h1>
    <p>Efekty liczą się w przeglądarce: zdjęcie nie opuszcza Twojego komputera.</p>
    <a class="btn-outline" data-open href="/editor?style=${HERO_CHIPS[0]}">Otwórz edytor</a>
  </div>
</section>`;

export function mountHero(root: HTMLElement): () => void {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const before = root.querySelector<HTMLCanvasElement>('[data-before]')!;
  const after = root.querySelector<HTMLCanvasElement>('[data-after]')!;
  const handle = root.querySelector<HTMLElement>('[data-handle]')!;
  const open = root.querySelector<HTMLAnchorElement>('[data-open]')!;
  const engine = sharedEngine();
  let alive = true, style = HERO_CHIPS[0], pos = 50, img: HTMLImageElement | null = null;
  let crop: Rect | null = null, scale = 1, sized = '';

  // --- suwak przed/po ---
  const setPos = (p: number) => {
    pos = Math.min(100, Math.max(0, p));
    stage.style.setProperty('--pos', pos + '%');
    handle.setAttribute('aria-valuenow', String(Math.round(pos)));
    handle.setAttribute('aria-valuetext', `${Math.round(pos)}% oryginału`);
  };
  const fromPointer = (e: PointerEvent) => { const r = stage.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100); };
  let dragging = false;
  // Przeciąganie w dowolnym miejscu obrazu (poza chipami); fokus na uchwyt, żeby dalej działała klawiatura.
  stage.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.hero__chips') || e.button !== 0) return;
    dragging = true; stage.setPointerCapture(e.pointerId); fromPointer(e); handle.focus({ preventScroll: true }); e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
  stage.addEventListener('pointerup', () => { dragging = false; });
  stage.addEventListener('pointercancel', () => { dragging = false; });
  handle.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -2, ArrowDown: -2, ArrowRight: 2, ArrowUp: 2, PageDown: -10, PageUp: 10 }[e.key];
    if (step !== undefined) setPos(pos + step); else if (e.key === 'Home') setPos(0); else if (e.key === 'End') setPos(100); else return;
    e.preventDefault();
  });
  setPos(50);

  // --- render ---
  const render = async () => {
    if (!crop) return;
    stage.setAttribute('aria-busy', 'true');
    try {
      const out = await engine.render({ style: { id: style } }, scale);
      if (!alive || !out) return;
      paint(after, out.image); stage.dataset.rendered = style;
    } catch (e) { console.error(e); }
    finally { if (alive) stage.setAttribute('aria-busy', 'false'); }
  };
  // Kadr i źródło zależą od rozmiaru sceny; przy zmianie rozmiaru liczymy je od nowa.
  const layout = async () => {
    if (!img) return;
    const W = stage.clientWidth, H = stage.clientHeight; if (!W || !H) return;
    const key = `${W}x${H}x${devicePixelRatio}`; if (key === sized) return; sized = key;
    crop = coverRect(img.naturalWidth, img.naturalHeight, W, H, SAMPLE.focus);
    scale = previewScale(crop.sw, crop.sh, W, H);
    const bw = Math.round(crop.sw * scale), bh = Math.round(crop.sh * scale);
    before.width = bw; before.height = bh;
    before.getContext('2d')!.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, bw, bh);
    stage.dataset.scale = scale.toFixed(3);
    await engine.setSource(cropPixels(img, crop));
    if (alive) render();
  };
  let t: number | undefined;
  const ro = new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(layout, 150); });

  root.querySelector('.hero__chips')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-chip]'); if (!b) return;
    style = b.dataset.chip!;
    root.querySelectorAll('[data-chip]').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    open.href = `/editor?style=${style}`;
    render();
  });

  loadImage(SAMPLE.src).then((i) => { if (!alive) return; img = i; layout(); ro.observe(stage); })
    .catch((e) => { stage.dataset.error = String(e); console.error(e); });
  return () => { alive = false; ro.disconnect(); clearTimeout(t); };
}
