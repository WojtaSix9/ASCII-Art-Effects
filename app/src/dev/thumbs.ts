// /dev/thumbs: generator miniatur (05, krok 5, wariant B). Renderuje gotowe efekty na zdjęciach roboczych (naprzemiennie),
// pakuje WebP do .zip; zawartość wkłada się do public/thumbs/. W tym repozytorium robi to też `npm run thumbs` (Playwright).
import { SAMPLES } from '../config/sample.ts';
import { READY, THUMB, sampleNoFor } from '../config/thumbs.ts';
import { EngineClient } from '../engine/client.ts';
import { coverRect, cropPixels, loadImage, paint } from '../engine/preview.ts';
import { zipStore } from './zip.ts';

export const thumbsHtml = () => `<p class="label">/dev</p><h1 tabindex="-1">Miniatury efektów</h1>
  <p>Renderuje ${READY.length} gotowych efektów (${THUMB.w}×${THUMB.h}, WebP) na zdjęciach roboczych naprzemiennie. Wynik: plik .zip do rozpakowania w <code>app/public/thumbs/</code>.</p>
  <p data-status role="status">Start…</p><p><a class="btn-outline" data-zip hidden download="thumbs.zip">Pobierz thumbs.zip</a></p>
  <div class="dev-grid" data-grid></div>`;

const hex = async (b: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-1', b))].map((x) => x.toString(16).padStart(2, '0')).join('');

export function mountThumbs(main: HTMLElement): () => void {
  const status = main.querySelector<HTMLElement>('[data-status]')!, grid = main.querySelector<HTMLElement>('[data-grid]')!, zipA = main.querySelector<HTMLAnchorElement>('[data-zip]')!;
  const client = new EngineClient(); let alive = true;
  const files: { name: string; data: Uint8Array }[] = [];
  const manifest: { generated: string; size: string; samples: Record<string, { src: string; sha1: string; crop: unknown }>; thumbs: Record<string, { sample: number; bytes: number; mode: string; ms: number }> } =
    { generated: new Date().toISOString(), size: `${THUMB.w}x${THUMB.h}`, samples: {}, thumbs: {} };
  // Stratny WebP (jakość z 05) albo jakość 1 (w Chromium bezstratny), co mniejsze: efekty z małą paletą (dither, braille,
  // lego, pixel) są bezstratnie kilka–kilkanaście razy mniejsze, zdjęciowe (halftone, duotone) stratnie.
  const blobOf = (c: HTMLCanvasElement, q: number) => new Promise<Blob>((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('toBlob'))), 'image/webp', q));
  const encode = async (c: HTMLCanvasElement) => {
    const [lossy, hi] = await Promise.all([blobOf(c, THUMB.quality), blobOf(c, 1)]);
    if (lossy.type !== 'image/webp') throw new Error(`przeglądarka nie koduje WebP (dała ${lossy.type}); użyj Chromium lub Firefoksa`);
    const best = hi.size < lossy.size ? hi : lossy;
    return { data: new Uint8Array(await best.arrayBuffer()), mode: best === hi ? 'q1' : `q${THUMB.quality}` };
  };
  (async () => {
    await client.init();
    for (let n = 1; n <= SAMPLES.length; n++) {
      const s = SAMPLES[n - 1]; const img = await loadImage(s.src); const crop = coverRect(img.naturalWidth, img.naturalHeight, THUMB.w, THUMB.h, s.focus);
      manifest.samples[n] = { src: s.src, sha1: await hex(await (await fetch(s.src)).arrayBuffer()), crop };
      const c = document.createElement('canvas'); c.width = THUMB.w; c.height = THUMB.h;
      c.getContext('2d')!.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, THUMB.w, THUMB.h);
      files.push({ name: `_sample-${n}.webp`, data: (await encode(c)).data });
      const scale = THUMB.w / crop.sw;
      await client.setSource(cropPixels(img, crop));
      for (const e of READY.filter((x) => sampleNoFor(x.id) === n)) {
        if (!alive) return;
        status.textContent = `Renderuję ${e.name}…`;
        const out = (await client.render({ style: { id: e.id } }, scale))!;
        const cv = document.createElement('canvas'); paint(cv, out.image);
        if (cv.width !== THUMB.w || cv.height !== THUMB.h) {   // zaokrąglenia skali: dociągnij do dokładnego rozmiaru
          const fix = document.createElement('canvas'); fix.width = THUMB.w; fix.height = THUMB.h; fix.getContext('2d')!.drawImage(cv, 0, 0, THUMB.w, THUMB.h); paint(cv, fix.getContext('2d')!.getImageData(0, 0, THUMB.w, THUMB.h));
        }
        const { data, mode } = await encode(cv); files.push({ name: `${e.id}.webp`, data });
        manifest.thumbs[e.id] = { sample: n, bytes: data.length, mode, ms: Math.round(out.workerMs) };
        const fig = document.createElement('figure'); cv.style.width = '100%'; fig.append(cv); fig.insertAdjacentHTML('beforeend', `<figcaption>${e.id} · zdjęcie ${n}</figcaption>`); grid.append(fig);
      }
    }
    files.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2) + '\n') });
    zipA.href = URL.createObjectURL(zipStore(files)); zipA.hidden = false;
    status.textContent = `Gotowe: ${Object.keys(manifest.thumbs).length} miniatur + ${SAMPLES.length} kadry „przed”.`;
    (window as any).__thumbs = { manifest, files: files.map((f) => ({ name: f.name, b64: btoa(Array.from(f.data, (b) => String.fromCharCode(b)).join('')) })) };
  })().catch((e) => { status.textContent = `Błąd: ${(e as Error).message}`; (window as any).__thumbs = { error: String(e) }; });
  return () => { alive = false; client.terminate(); };
}
