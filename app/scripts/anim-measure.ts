// Etap 2, krok 10: pomiar eksportu GIF i MP4 dla każdego efektu z animacją (zbudowana wersja, headless Chromium).
// Zdjęcie robocze 1, pierwszy ruch efektu z ustawieniami domyślnymi, pętla 4 s × 24 fps = 96 klatek, dłuższy bok 720 px (domyślny).
// MP4 na VP9: Chromium z Playwrighta nie ma kodera H.264, więc rozmiar dla H.264 będzie inny (ten sam bitrate, inny kodek).
// Uruchomienie: npm run build && node scripts/anim-measure.ts > reports/anim-measure.md
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import effects from '../../engine/src/data/effects.json' with { type: 'json' };

const ANIM = (effects as { id: string; name: string; animated?: boolean; motions?: { id: string }[] }[]).filter((e) => e.animated);
const BASE = 'http://localhost:4173';
const server = spawn('npx', ['vite', 'preview'], { stdio: 'ignore' });
for (let i = 0; ; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* czekamy */ } if (i > 100) { server.kill(); throw new Error('vite preview nie wystartował'); } await new Promise((r) => setTimeout(r, 100)); }
const browser = await chromium.launch(); const rows: string[] = []; const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/editor?style=${ANIM[0].id}&sample=1`);
  await page.waitForFunction(() => (window as any).__editorTest?.isIdle(), null, { timeout: 60_000 });
  for (const e of ANIM) {
    await page.evaluate((v) => { const el = document.querySelector<HTMLSelectElement>('[data-style]')!; el.value = v; el.dispatchEvent(new Event('change')); }, e.id);
    await page.waitForFunction((v) => { const T = (window as any).__editorTest; return T.isIdle() && T.state().style === v; }, e.id, { timeout: 120_000 });
    const r = await page.evaluate(async () => {
      const T = (window as any).__editorTest; const s = T.state(); const motion = s.anim.byStyle[s.style]?.id ?? null; if (!motion) return { motion };
      const t0 = performance.now(); const g = await T.gif(); const gt = performance.now() - t0;
      const t1 = performance.now(); const m = await T.mp4('vp9'); const mt = performance.now() - t1;
      /* ruch naprawdę jest: klatka w fazie 0,25 różni się od fazy 0 */
      const a = new Uint8Array((await T.renderPhase(0.25, 0)).img.buffer), b = new Uint8Array((await T.renderPhase(0.25, 0.25)).img.buffer); let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
      return { motion, w: g.w, h: g.h, gif: g.bytes.length, gt, mw: m.w, mh: m.h, mp4: m.bytes.length, mt, moved: diff > 0 };
    });
    const mb = (b: number) => (b / 1048576).toFixed(1);
    rows.push(r.motion ? `| ${e.name} | ${r.motion} | ${r.w}×${r.h} | ${mb(r.gif!)} MB${r.gif! > 20 * 1048576 ? ' ⚠' : ''} | ${(r.gt! / 1000).toFixed(1)} s | ${mb(r.mp4!)} MB | ${(r.mt! / 1000).toFixed(1)} s | ${r.moved ? 'tak' : '**NIE**'} |` : `| ${e.name} | **brak ruchu w stanie** | | | | | | |`);
    console.error(rows[rows.length - 1]);
  }
} finally { await browser.close(); server.kill(); }
console.log(`Pomiar eksportu animacji (${new Date().toISOString().slice(0, 10)}): zdjęcie robocze 1 (photo-01-atrium, 1000×729), pętla 4 s × 24 fps = 96 klatek, 720 px, GIF bez ditheringu, MP4 na VP9 (headless Chromium).\n`);
console.log('| Efekt | Ruch | Wymiary | GIF | Czas GIF | MP4 (VP9) | Czas MP4 | Ruch widoczny |\n|---|---|---|---|---|---|---|---|\n' + rows.join('\n'));
console.log(`\n${ANIM.length} efektów; błędy strony: ${errors.length ? errors.join(' | ') : 'brak'}. ⚠ = ponad 20 MB (próg ostrzeżenia w oknie eksportu).`);
