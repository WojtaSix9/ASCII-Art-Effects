// /dev/engine: testy silnika w przeglądarce (krok 2 z briefu 00, sekcja 6). Strona nie jest linkowana z nawigacji.
// Można ją otworzyć w dowolnej przeglądarce (Safari, Firefox, telefon); Playwright czyta wynik z window.__engineReport.
import { EngineClient } from '../engine/client.ts';
import type { CoverageRes, BenchRes, HeapRes, InitRes } from '../engine/protocol.ts';
import { EFFECTS } from '../../../engine/src/index.ts';
import expectedHashes from './fixtures/engine-hashes.json';
import expectedCoverage from './fixtures/glyph-coverage.json';

type Check = { name: string; ok: boolean; info?: string };
export type EngineReport = {
  userAgent: string; init?: InitRes; checks: Check[]; coverage?: CoverageRes;
  roundTrip?: { size: string; workerMs: number; totalMs: number }[];
  bench?: BenchRes; memory?: { renders: number; workerHeap: number | null; pageHeap: number | null }[]; done: boolean;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pageHeap = () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
const mb = (b: number | null) => (b == null ? '—' : (b / 1048576).toFixed(1) + ' MB');

export const devEngineHtml = () => `<p class="label">/dev</p><h1 tabindex="-1">Test silnika w przeglądarce</h1>
    <p>Strona deweloperska. Testy szybkie ruszają same; pomiar czasu i pamięci uruchamiasz przyciskami (trwa to do minuty).</p>
    <p><button type="button" class="btn-outline" data-act="bench">Pomiar czasu</button>
       <button type="button" class="btn-outline" data-act="memory">Test pamięci</button></p>
    <div class="dev" data-out></div>`;

export function mountDevEngine(main: HTMLElement): () => void {
  const out = main.querySelector<HTMLElement>('[data-out]')!;
  const client = new EngineClient();
  const report: EngineReport = { userAgent: navigator.userAgent, checks: [], done: false };
  (window as any).__engineReport = report;
  const sections: Record<string, string> = {};
  let grid: HTMLElement | null = null;   // podgląd presetów (kanwy) wstawiany ponownie po każdym przebudowaniu HTML
  const show = (key: string, html: string) => {
    sections[key] = html; out.innerHTML = Object.values(sections).join('');
    if (grid) out.querySelector('[data-grid]')?.replaceWith(grid);
  };
  const showChecks = () => show('checks', `<h2 class="label">/ testy</h2><ul class="dev-list">${report.checks.map((c) =>
    `<li class="${c.ok ? 'ok' : 'fail'}">${c.ok ? 'OK' : 'FAIL'} · ${esc(c.name)}${c.info ? ` <span>${esc(c.info)}</span>` : ''}</li>`).join('')}</ul>`);
  const check = (name: string, ok: boolean, info?: string) => { report.checks.push({ name, ok, info }); showChecks(); };

  const quick = async () => {
    // 1. Start Workera i czcionki
    const init = report.init = await client.init();
    check('Worker (module) uruchomiony, OffscreenCanvas dostępny', init.offscreen);
    check('FontFaceSet w Workerze (self.fonts)', init.workerFonts, init.workerFonts ? '' : 'brak: znaki Characters rysuje czcionka zastępcza');
    const [geist, ...lazy] = init.fonts;
    check(`Geist Mono w Workerze: ${geist?.loaded}/${geist?.faces} podzbiorów wczytanych od razu`, !!geist && geist.faces > 0 && geist.loaded === geist.faces, `${init.fontMs} ms`);
    check('Noto Sans Mono (greek) i Noto Sans JP zarejestrowane, pobierane na żądanie', lazy.length === 2 && lazy.every((f) => f.faces > 0), lazy.map((f) => `${f.family}: ${f.faces}`).join(', '));

    // 2. Te same bajty co w Node (efekty bez czcionki)
    const got = await client.call<Record<string, string>>({ type: 'hashes' });
    const exp = expectedHashes as Record<string, string>;
    const diff = Object.keys(exp).filter((k) => got[k] !== exp[k]);
    check(`Render identyczny z Node: ${Object.keys(exp).length - diff.length}/${Object.keys(exp).length} przypadków (17 efektów, 13 post FX, Color, Dither)`, diff.length === 0, diff.join(', '));

    // 3. Pokrycie znaków presetów
    const cov = report.coverage = await client.call<CoverageRes>({ type: 'coverage' });
    check('Metoda pokrycia: kontrola „A” = Geist Mono', cov.controls.latinA === 'Geist Mono', cov.controls.latinA);
    check('Metoda pokrycia: kontrola U+10FFFD = brak (tofu)', cov.controls.privateUse === 'missing' || cov.controls.privateUse === 'fallback', cov.controls.privateUse);
    const expCov = expectedCoverage as Record<string, Record<string, string>>;
    const all = cov.rows.flatMap((r) => Object.entries(r.chars).map(([ch, src]) => ({ preset: r.preset, ch, src })));
    const device = all.filter((c) => c.src === 'fallback' || c.src === 'missing');
    check(`Każdy znak 16 presetów rysuje kod albo czcionka z npm (bez czcionek urządzenia): ${all.length - device.length}/${all.length}`, device.length === 0, device.map((c) => `${c.preset}:${c.ch}`).join(' '));
    const wrong = all.filter((c) => c.src !== 'drawn' && expCov[c.preset]?.[c.ch] !== c.src);
    check('Źródło znaków z czcionek zgodne z tablicami cmap (wzorzec)', wrong.length === 0, wrong.map((c) => `${c.preset}:${c.ch}=${c.src}≠${expCov[c.preset]?.[c.ch]}`).join(' '));
    const SRC = ['drawn', 'Geist Mono', 'Noto Sans Mono', 'Noto Sans JP', 'fallback', 'missing'] as const;
    const LBL = ['rysowane kodem', 'Geist Mono', 'Noto Sans Mono', 'Noto Sans JP', 'czcionka urządzenia', 'brak (tofu)'];
    show('coverage', `<h2 class="label">/ źródło znaków w presetach</h2><table class="dev-table"><thead><tr><th>Preset</th>${LBL.map((l) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${
      cov.rows.map((r) => `<tr><td>${r.preset}</td>${SRC.map((k) => `<td>${esc(Object.entries(r.chars).filter(([, v]) => v === k).map(([c]) => c).join(''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`);

    // 4. Tryb "najnowszy wygrywa"
    await client.call({ type: 'testImage', w: 600, h: 400 });
    const before = client.rendersExecuted;
    const ids = EFFECTS.map((e) => e.id).slice(0, 10);
    const res = await Promise.all(ids.map((id) => client.render({ style: { id } })));
    const nulls = res.filter((r) => r === null).length;
    check('Najnowszy wygrywa: 10 szybkich zleceń → 2 rendery (pierwsze i ostatnie), 8 pominiętych', client.rendersExecuted - before === 2 && nulls === 8 && res[0] !== null && res[9] !== null,
      `wykonane ${client.rendersExecuted - before}, null ${nulls}`);

    // 5. Czas w obie strony (zlecenie → Worker → ImageData → kanwa) vs czas samego renderu
    report.roundTrip = [];
    const cv = document.createElement('canvas'); const g = cv.getContext('2d')!;
    for (const [w, h] of [[600, 400], [1600, 1067]]) {
      await client.call({ type: 'testImage', w, h });
      const t: number[] = []; let wm = 0;
      for (let i = 0; i < 6; i++) {
        const s = performance.now(); const r = (await client.render({ style: { id: 'pixel' } }))!;
        cv.width = r.image.width; cv.height = r.image.height; g.putImageData(r.image, 0, 0);
        if (i > 0) { t.push(performance.now() - s); wm += r.workerMs; }
      }
      report.roundTrip.push({ size: `${w}×${h}`, workerMs: wm / t.length, totalMs: t.reduce((a, b) => a + b) / t.length });
    }
    show('rt', `<h2 class="label">/ czas w obie strony (pixel, średnia z 5)</h2><table class="dev-table"><tbody>${report.roundTrip.map((r) =>
      `<tr><td>${r.size}</td><td>render w Workerze ${r.workerMs.toFixed(1)} ms</td><td>razem z transferem i kanwą ${r.totalMs.toFixed(1)} ms</td></tr>`).join('')}</tbody></table>`);

    // 5b. Świeży Worker: pierwszy render Katakana i Math musi już mieć czcionki (maski znaków są zapamiętywane na stałe)
    const digest = async (im: ImageData) => [...new Uint8Array(await crypto.subtle.digest('SHA-1', im.data))].map((b) => b.toString(16).padStart(2, '0')).join('');
    for (const preset of ['katakana', 'math']) {
      const state = { style: { id: 'characters', params: { charSet: preset } } };
      const fresh = new EngineClient();
      try {
        await fresh.call({ type: 'testImage', w: 240, h: 160 }); const a = (await fresh.render(state))!;
        await client.call({ type: 'testImage', w: 240, h: 160 }); const b = (await client.render(state))!;
        check(`Świeży Worker: pierwszy render „${preset}” = render po wczytaniu czcionek`, (await digest(a.image)) === (await digest(b.image)));
      } finally { fresh.terminate(); }
    }

    // 6. Podgląd presetów znaków (ocena wzrokowa: tofu, krzywe znaki)
    await client.call({ type: 'testImage', w: 360, h: 240 });
    const figs = document.createElement('div'); figs.className = 'dev-grid';
    for (const r of cov.rows) {
      const o = await client.render({ style: { id: 'characters', params: { charSet: r.preset } } });
      if (!o) continue;
      const c = document.createElement('canvas'); c.width = o.image.width; c.height = o.image.height; c.getContext('2d')!.putImageData(o.image, 0, 0);
      const fig = document.createElement('figure'); fig.append(c); fig.insertAdjacentHTML('beforeend', `<figcaption>${r.preset}</figcaption>`); figs.append(fig);
    }
    grid = figs; show('grid', '<h2 class="label">/ characters × presety</h2><div data-grid></div>');
    report.done = true;
  };

  const bench = async () => {
    show('bench', '<h2 class="label">/ czasy</h2><p>Liczę…</p>');
    const b = report.bench = await client.call<BenchRes>({ type: 'bench', w: 1600, h: 1067, runs: 3 });
    show('bench', `<h2 class="label">/ czasy (${b.w}×${b.h}, mediana z ${b.runs}, w Workerze)</h2><table class="dev-table"><tbody>${
      b.rows.map((r) => `<tr><td>${r.name}</td><td class="${r.ms > 100 ? 'fail' : 'ok'}">${r.ms.toFixed(0)} ms</td></tr>`).join('')}</tbody></table>`);
  };

  // Wielokrotny render przez pełną ścieżkę (Worker → ImageData → kanwa), skale 1× i 2×, wszystkie efekty.
  // runBatch jest wystawione dla Playwrighta, który między partiami mierzy RSS procesów przeglądarki.
  const cv = document.createElement('canvas'); const g = cv.getContext('2d')!;
  let renders = 0;
  const runBatch = async () => {
    if (!report.memory) { report.memory = []; await client.call({ type: 'testImage', w: 1600, h: 1067 }); }
    for (const scale of [1, 2]) for (const e of EFFECTS) {
      const r = await client.render({ style: { id: e.id } }, scale);
      if (r) { cv.width = r.image.width; cv.height = r.image.height; g.putImageData(r.image, 0, 0); renders++; }
    }
    const heap = await client.call<HeapRes>({ type: 'gc' });
    const row = { renders, workerHeap: heap.usedJSHeapSize, pageHeap: pageHeap() };
    report.memory.push(row);
    show('memory', `<h2 class="label">/ pamięć (po GC, jeśli dostępne)</h2><table class="dev-table"><thead><tr><th>renderów</th><th>sterta Workera</th><th>sterta strony</th></tr></thead><tbody>${
      report.memory.map((m) => `<tr><td>${m.renders}</td><td>${mb(m.workerHeap)}</td><td>${mb(m.pageHeap)}</td></tr>`).join('')}</tbody></table>`);
    return row;
  };
  (window as any).__engineDev = { runBatch, bench };

  main.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (act === 'bench') bench();
    if (act === 'memory') (async () => { for (let i = 0; i < 5; i++) await runBatch(); })();
  });
  quick().catch((e) => check('Błąd testów', false, String(e)));
  return () => client.terminate();
}
