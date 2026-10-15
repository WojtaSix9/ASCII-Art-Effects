// Krok 2: testy silnika w prawdziwej przeglądarce (Chromium z Playwright, headless) przez stronę /dev/engine.
// Dodatkowo: RSS procesów przeglądarki między partiami renderów i czasy tych samych efektów w Node na tej samej maszynie.
// Uruchomienie: npm run build && node scripts/browser-engine.ts  →  reports/browser-engine.txt
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { render, EFFECTS, POSTFX, canvasGlyphs } from '../../engine/src/index.ts';
import { testImage } from '../../engine/scripts/make-test-image.ts';
import type { EngineReport } from '../src/dev/dev-engine.ts';

const BASE = 'http://localhost:4173';
const server = spawn('npx', ['vite', 'preview'], { stdio: 'ignore' });
for (let i = 0; ; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* czekamy */ }
  if (i > 100) { server.kill(); throw new Error('vite preview nie wystartował'); }
  await new Promise((r) => setTimeout(r, 100));
}

// RSS wszystkich procesów Chromium uruchomionych przez ten skrypt (potomkowie tego procesu Node).
function chromiumRss(): number {
  const procs = readdirSync('/proc').filter((d) => /^\d+$/.test(d)).map((pid) => {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8'); const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
      const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8'); const rss = Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1] ?? 0) * 1024;
      return { pid: Number(pid), ppid, cmd, rss };
    } catch { return null; }
  }).filter((p) => p !== null);
  const mine = new Set([process.pid]); let grew = true;
  while (grew) { grew = false; for (const p of procs) if (!mine.has(p.pid) && mine.has(p.ppid)) { mine.add(p.pid); grew = true; } }
  return procs.filter((p) => mine.has(p.pid) && /chrom/i.test(p.cmd)).reduce((s, p) => s + p.rss, 0);
}

const lines: string[] = []; const log = (s = '') => { lines.push(s); console.log(s); };
const mb = (b: number | null | undefined) => (b == null ? '—' : (b / 1048576).toFixed(1).padStart(7) + ' MB');
let failed = 0;

const browser = await chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
let rep: EngineReport;
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + '/dev/engine');
  await page.waitForFunction(() => (window as any).__engineReport?.done || (window as any).__engineReport?.checks.some((c: any) => !c.ok), null, { timeout: 120_000 });
  await page.evaluate(() => (window as any).__engineDev.bench());
  const rss: { renders: number; rss: number; workerHeap: number | null; pageHeap: number | null }[] = [];
  rss.push({ renders: 0, rss: chromiumRss(), workerHeap: null, pageHeap: null });
  for (let i = 0; i < 6; i++) {
    const row = await page.evaluate(() => (window as any).__engineDev.runBatch());
    rss.push({ ...row, rss: chromiumRss() });
  }
  rep = await page.evaluate(() => (window as any).__engineReport);
  const canvases = await page.locator('.dev-grid canvas').count();
  rep.checks.push({ name: 'Podgląd presetów: 16 kanw po wszystkich testach', ok: canvases === 16, info: String(canvases) });
  await page.screenshot({ path: 'reports/browser-engine.png', fullPage: true });

  log(`Przeglądarka: ${rep.userAgent}`);
  log(`Data: ${new Date().toISOString()}`);
  log('');
  log('== Testy ==');
  for (const c of rep.checks) { if (!c.ok) failed++; log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.name}${c.info ? `  [${c.info}]` : ''}`); }
  if (errors.length) { failed++; log(`FAIL błędy w konsoli: ${errors.join(' | ')}`); } else log('OK   brak błędów w konsoli');
  log('');
  log('== Źródło znaków w presetach (Worker, OffscreenCanvas) ==');
  log('preset      kod  Geist  NotoMono  NotoJP  urządzenie  brak');
  for (const r of rep.coverage!.rows) {
    const n = (k: string) => String(Object.values(r.chars).filter((v) => v === k).length).padStart(3);
    log(`${r.preset.padEnd(11)} ${n('drawn')}  ${n('Geist Mono')}    ${n('Noto Sans Mono')}     ${n('Noto Sans JP')}      ${n('fallback')}     ${n('missing')}`);
  }
  log('');
  log('== Czas w obie strony (pixel, zlecenie → Worker → ImageData → kanwa) ==');
  for (const r of rep.roundTrip!) log(`${r.size.padEnd(10)} render ${r.workerMs.toFixed(1).padStart(6)} ms, razem ${r.totalMs.toFixed(1).padStart(6)} ms, narzut ${(r.totalMs - r.workerMs).toFixed(1)} ms`);
  log('');

  // Node na tej samej maszynie (characters wymaga @napi-rs/canvas z engine/node_modules)
  let G: ReturnType<typeof canvasGlyphs> | null = null;
  try { const { createCanvas } = createRequire(new URL('../../engine/package.json', import.meta.url))('@napi-rs/canvas'); G = canvasGlyphs((w: number, h: number) => createCanvas(w, h), '"DejaVu Sans Mono"'); } catch { /* brak: bez characters */ }
  const src = testImage(rep.bench!.w, rep.bench!.h);
  const med = (f: () => void) => { f(); const t: number[] = []; for (let i = 0; i < 3; i++) { const s = performance.now(); f(); t.push(performance.now() - s); } return t.sort((a, b) => a - b)[1]; };
  const nodeMs = new Map<string, number>();
  for (const e of EFFECTS) if (e.id !== 'characters' || G) nodeMs.set(e.id, med(() => render(src, { style: { id: e.id } }, { glyphs: G })));
  for (const f of POSTFX) nodeMs.set(`pixel + ${f.id}`, med(() => render(src, { style: { id: 'pixel' }, postFx: { [f.id]: true } })));
  log(`== Czasy: ${rep.bench!.w}×${rep.bench!.h}, mediana z ${rep.bench!.runs} po rozgrzewce; Chromium (Worker) vs Node 22, ta sama maszyna ==`);
  log('efekt                    Chromium     Node   > 100 ms w przeglądarce');
  for (const r of rep.bench!.rows) {
    const n = nodeMs.get(r.name);
    log(`${r.name.padEnd(22)} ${r.ms.toFixed(0).padStart(7)} ms ${n == null ? '      —' : n.toFixed(0).padStart(6) + ' ms'}   ${r.ms > 100 ? 'tak' : ''}`);
  }
  log('');
  log('== Pamięć: partie po 2 × liczba efektów renderów (skala 1 i 2) na 1600×1067, pełna ścieżka do kanwy, GC po każdej partii ==');
  log('renderów      RSS Chromium   sterta Workera   sterta strony');
  for (const r of rss) log(`${String(r.renders).padStart(8)}   ${mb(r.rss)}      ${mb(r.workerHeap)}      ${mb(r.pageHeap)}`);
} finally {
  await browser.close(); server.kill();
}
writeFileSync('reports/browser-engine.txt', lines.join('\n') + '\n');
process.exit(failed ? 1 : 0);
