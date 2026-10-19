// Etap 2, krok 8: strona /logo. Część 1 (Node): własności kodu przeniesionego z ascii.rest (engine/src/logo/). Część 2 (Chromium):
// strona na zbudowanej wersji, własne obrazy (favicon strony i kształty rysowane w teście; bez cudzych logotypów, plik 09, 7.4).
// Uruchomienie: npm run build && node scripts/logo-check.ts
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import GLYPHS from '../../engine/src/logo/glyphs.json' with { type: 'json' };
import { CH, CW, FILL, GX, GY, LIMIT, clearGround, drawCells, layout, size, trim, type Glyph } from '../../engine/src/logo/logo.ts';
import { piece, source } from '../../engine/src/logo/logo-file.ts';

const res: [string, boolean, string?][] = []; const t = (n: string, ok: boolean, info?: unknown) => res.push([n, ok, info === undefined ? undefined : JSON.stringify(info)]);
const G = GLYPHS as Glyph[];

// ---------- część 1: Node ----------
/* siatka: wysoki i szeroki obraz, różne szerokości; zawsze w limicie biblioteki 80×32 i z marginesem 2 kolumn / 1 wiersza */
const sz = [0.2, 0.5, 1, 2, 5, 12].flatMap((a) => [16, 40, 64, 80].map((w) => ({ a, w, ...size(a, w) })));
t('size(): dla proporcji 0,2–12 i szerokości 16–80 siatka ≤ 80×32 i ≤ żądanej szerokości (+ margines)', sz.every((s) => s.cols <= LIMIT.cols && s.rows <= LIMIT.rows && s.cols >= 5 && s.rows >= 3), sz.filter((s) => s.cols > LIMIT.cols || s.rows > LIMIT.rows));
/* drawCells na sztucznym obrazie: pełny prostokąt w środku siatki → wnętrze FILL ('8'), poza nim pusto, na krawędziach znaki kształtu */
{
  const cols = 12, rows = 6, W = cols * CW, H = rows * CH; const data = new Uint8ClampedArray(W * H * 4);
  const x0 = 3 * CW + CW / 2, x1 = 9 * CW + CW / 2, y0 = 2 * CH, y1 = 4 * CH;   /* lewa i prawa krawędź w połowie komórki */
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; data[i] = 230; data[i + 1] = 40; data[i + 2] = 90; data[i + 3] = 255; }
  const d = drawCells(data, cols, rows, G, 'logo');
  const inner = d.art.slice(2, 4).every((r) => r.slice(4, 9) === FILL.repeat(5)); const outside = [0, 1, 4, 5].every((y) => d.art[y].trim() === '') && d.art.every((r) => r.slice(0, 3).trim() === '' && r.slice(10).trim() === '');
  const edges = d.art.slice(2, 4).map((r) => r[3] + r[9]);
  t('drawCells (styl logo): pełny prostokąt → wnętrze „8”, puste komórki poza nim, w komórkach przeciętych krawędzią w połowie znak kształtu (nie spacja, nie „8”)', inner && outside && edges.every((e) => e[0] !== ' ' && e[0] !== '8' && e[1] !== ' ' && e[1] !== '8'), { art: d.art });
  t('drawCells: jeden kolor obrazu → paleta 1 kolor ≈ (230, 40, 90), indeksy kolorów tylko tam, gdzie jest znak', d.colors.length === 1 && Math.abs(d.colors[0][0] - 230) <= 2 && d.ink.every((r, y) => [...r].every((c, x) => (c === ' ') === (d.art[y][x] === ' '))), { colors: d.colors });
  const sh = drawCells(data, cols, rows, G, 'shade');
  t('drawCells (styl shade): znaki z rampy „.:-=+*#%@” tylko w komórkach z tuszem ≥ 10%', sh.art.every((r) => [...r].every((c) => c === ' ' || '.:-=+*#%@'.includes(c))) && sh.art[2].slice(4, 9).trim().length === 5 && sh.art[0].trim() === '', { art: sh.art });
}
/* tabela kształtów: 25 znaków EDGE + FILL, GX×GY bloków, najciemniejszy blok = 1; „8” sięga wszystkich 8 bloków (pełna wysokość znaku), choć w górnym i dolnym pasie komórki 1:2 ma mało tuszu (ok. 0,23) */
t(`kształty znaków (IBM Plex Mono, metoda z ascii.rest): ${G.length} znaków po ${GX * GY} bloków, maksimum 1, „8” ma tusz w każdym bloku`, G.length === 25 && G.every((g) => g.v.length === GX * GY && g.v.every((v) => v >= 0 && v <= 1)) && Math.max(...G.flatMap((g) => g.v)) === 1 && G.find((g) => g.ch === FILL)!.v.every((v) => v > 0), G.find((g) => g.ch === FILL));
/* usuwanie tła: białe tło z czerwonym kołem → tło przezroczyste od brzegów, koło zostaje, kolor tła #ffffff; obraz z własną przezroczystością bez zmian */
{
  const W = 200, H = 120; const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - 100, y - 60) < 40) { const i = (y * W + x) * 4; data[i + 1] = 0; data[i + 2] = 0; }
  const r = clearGround(data, W, H, true); const box = trim(data, W, H);
  t('clearGround: białe tło → przezroczyste, kolor tła #ffffff; trim() = pudełko koła (ok. 80×80 px w środku)', r.ground === '#ffffff' && r.opaque && data[3] === 0 && data[(60 * W + 100) * 4 + 3] === 255 && !!box && Math.abs(box.w - 80) <= 2 && Math.abs(box.h - 80) <= 2, { r, box });
  const clear = new Uint8ClampedArray(W * H * 4); clear[(60 * W + 100) * 4 + 3] = 255; const r2 = clearGround(clear, W, H, true);
  t('clearGround: obraz z własną przezroczystością → bez zmian (opaque false, bez tła)', !r2.opaque && r2.ground === undefined);
}
/* plik .ts: import w Node, reguły checkera biblioteki (scripts/check.ts), ruch glint tylko na znakach „pełnych”, scan co every s */
{
  const L = layout({ w: 300, h: 150 }, 40); const W = L.W, H = L.H; const data = new Uint8ClampedArray(W * H * 4);
  for (let y = L.dy; y < L.dy + L.dh; y++) for (let x = L.dx; x < L.dx + L.dw; x++) if (Math.hypot((x - L.dx) / L.dw - 0.5, (y - L.dy) / L.dh - 0.5) < 0.45) { const i = (y * W + x) * 4; data[i] = 20; data[i + 1] = 90; data[i + 2] = 200; data[i + 3] = 255; }
  const d = drawCells(data, L.cols, L.rows, G, 'logo'); const dir = mkdtempSync(join(tmpdir(), 'logo-'));
  for (const category of ['companies', 'distros'] as const) {
    const s = { proper: 'Test Mark', file: 'test.svg', category, every: 5 }; const ts = source(d, s); const f = join(dir, `test-mark-${category}.ts`); writeFileSync(f, ts);
    const mod = await import(f); const m = mod.meta; const fr = mod.default({ ...m.options }); const color = new Uint8Array(m.cols * m.rows);
    const at = [0, 1, 2, 2.5, 3, 4, 6].map((x) => fr(x, { color }));
    const ok = /^\s*import\s(?!type\s)/m.test(ts) === false && !/Math\.random|\b(document|window|globalThis)\b/.test(ts) && ['logos', 'companies', 'distros'].includes(m.category) && m.note.length <= 72 && m.cols <= 80 && m.rows <= 32
      && m.palette.length % 6 === 0 && m.palette.every((c: string) => /^#[0-9a-f]{6}$/.test(c)) && at.every((x: string) => x.split('\n').length === m.rows && x.split('\n').every((l) => l.length === m.cols)) && new Set(at).size >= 3;
    const base = at[0].split('\n'); const changed = at.map((x: string) => [...x.replace(/\n/g, '')].filter((c, i) => c !== base.join('')[i]));
    const motionOk = category === 'companies' ? changed.flat().every((c) => c === '/') : changed.flat().every((c) => '#$%&*+<=>?@[]{}'.includes(c));
    t(`plik .ts (${category}): importuje się w Node, reguły checkera biblioteki (tylko import type, kategoria, note, ≤ 80×32, paleta 6n, klatki rows × cols, ≥ 3 różne klatki), ruch ${category === 'companies' ? 'glint: zmiany tylko na „/”' : 'scan: zmiany tylko na znaki szumu'}`, ok && motionOk, { cat: m.category, cols: m.cols, rows: m.rows, distinct: new Set(at).size });
    const p = piece(d, s); const f2 = p.default(p.meta.options as Record<string, unknown>);
    t(`piece() (${category}): ten sam ruch co plik .ts (klatki w chwilach 0–6 s identyczne)`, [0, 1, 2, 2.5, 3, 4, 6].every((x, k) => f2(x, { color: new Uint8Array(m.cols * m.rows) }) === at[k]));
  }
}

// ---------- część 2: Chromium ----------
const BASE = 'http://localhost:4173';
const server = spawn('npx', ['vite', 'preview'], { stdio: 'ignore' });
for (let i = 0; ; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* czekamy */ } if (i > 100) { server.kill(); throw new Error('vite preview nie wystartował'); } await new Promise((r) => setTimeout(r, 100)); }
const browser = await chromium.launch(); const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + '/'); const nav = await page.$$eval('.nav__links a', (a) => a.map((x) => x.textContent));
  await page.click('.nav__links a[href="/logo"]'); await page.waitForSelector('[data-drop]');
  t('nawigacja: link „Logo” między „Efekty” i „Jak używać”; /logo otwiera stronę z polem wczytywania', JSON.stringify(nav) === '["Efekty","Logo","Jak używać"]' && (await page.title()).startsWith('Logo'), nav);
  /* PNG z białym tłem rysowany w teście: koło i prostokąt */
  await page.evaluate(async () => {
    const c = new OffscreenCanvas(800, 400); const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 800, 400); g.fillStyle = '#e6285a'; g.beginPath(); g.arc(200, 200, 160, 0, 7); g.fill(); g.fillStyle = '#145ac8'; g.fillRect(420, 60, 340, 280);
    await (window as any).__logoTest.load(await c.convertToBlob({ type: 'image/png' }), 'test-shapes.png');
  });
  await page.waitForFunction(() => (window as any).__logoTest.drawing(), null, { timeout: 20_000 });
  const a = await page.evaluate(() => ({ d: (window as any).__logoTest.drawing(), facts: document.querySelector('[data-facts]')!.textContent, ground: (document.querySelector('[data-ground]') as HTMLButtonElement).textContent, gh: (document.querySelector('[data-ground]') as HTMLElement).hidden, name: (document.querySelector('input[name="name"]') as HTMLInputElement).value }));
  t('PNG z białym tłem: tło usunięte (przycisk „Zostaw tło (#ffffff)”), styl logo, 2 kolory, nazwa z pliku, opis siatki', !a.gh && a.ground === 'Zostaw tło (#ffffff)' && a.d.style === 'logo' && a.d.colors.length === 2 && a.name === 'test-shapes' && !!a.facts?.includes('glint co 5 s'), { ...a, d: { cols: a.d.cols, rows: a.d.rows, colors: a.d.colors } });
  await page.click('[data-ground]'); await page.waitForFunction(() => (document.querySelector('[data-ground]') as HTMLElement).textContent === 'Usuń tło', null, { timeout: 10_000 });
  const kept = await page.evaluate(() => (window as any).__logoTest.drawing());
  t('„Zostaw tło”: obraz bez usuwania tła → biel jako trzeci kolor, przycisk zmienia się na „Usuń tło”, styl zostaje logo (jak w ascii.rest: photo = false, gdy tło zostawione)', kept.colors.length === 3 && kept.style === 'logo', { colors: kept.colors, style: kept.style });
  await page.click('[data-ground]'); await page.waitForFunction(() => (document.querySelector('[data-ground]') as HTMLElement).textContent?.startsWith('Zostaw'), null, { timeout: 10_000 });
  /* szerokość i ruch */
  await page.fill('input[name="width"]', '40'); await page.check('input[name="category"][value="distros"]'); await page.waitForTimeout(600);
  const b = await page.evaluate(() => ({ d: (window as any).__logoTest.drawing(), facts: document.querySelector('[data-facts]')!.textContent }));
  t('szerokość 40 → siatka ≤ 40 kolumn; kategoria distros → scan', b.d.cols <= 40 && !!b.facts?.includes('scan co 5 s'), { cols: b.d.cols, facts: b.facts });
  /* pobieranie: .ts, SVG ciemne i jasne, GIF; MP4 bez kodera H.264 → komunikat */
  const dl = async (sel: string) => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.click(sel)]); return { name: d.suggestedFilename(), path: await d.path() }; };
  const ts = await dl('[data-dl="ts"]'); const svg = await dl('[data-dl="svg"]'); const svgL = await dl('[data-dl="svg-light"]');
  t('pobieranie: test-shapes.ts, test-shapes.dark.svg, test-shapes.svg', ts.name === 'test-shapes.ts' && svg.name === 'test-shapes.dark.svg' && svgL.name === 'test-shapes.svg', [ts.name, svg.name, svgL.name]);
  const sv = await page.evaluate(async () => { const s = (window as any).__logoTest.svg(true) as string; const h = document.createElement('div'); h.innerHTML = s; document.body.append(h); const n = document.getAnimations().length; h.remove(); const im = new Image(); im.src = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' })); await im.decode(); return { n, w: im.naturalWidth, len: s.length }; });
  t('SVG: otwiera się jako obraz, ma animacje CSS (pętla 5 s)', sv.n > 0 && sv.w > 0, sv);
  const gif = await dl('[data-dl="gif"]');
  const gb = readFileSync(gif.path); const g = { head: gb.subarray(0, 6).toString(), bytes: gb.length };
  const gmsg = await page.textContent('[data-msg]');
  t('GIF: plik test-shapes.gif, 120 klatek (5 s × 24 fps), komunikat z rozmiarem', gif.name === 'test-shapes.gif' && g.head === 'GIF89a' && !!gmsg?.includes('120 klatek'), { name: gif.name, gmsg, g });
  await page.click('[data-dl="mp4"]'); await page.waitForFunction(() => document.querySelector('[data-msg]')!.textContent?.includes('H.264') || document.querySelector('[data-msg]')!.textContent?.includes('.mp4') || document.querySelector('[data-msg]')!.textContent?.startsWith('Błąd'), null, { timeout: 60_000 });
  const mmsg = await page.textContent('[data-msg]'); t('MP4 w Chromium z Playwrighta (bez kodera H.264): komunikat zamiast pliku', !!mmsg?.includes('nie koduje wideo H.264'), mmsg);
  /* SVG strony (favicon) przez pole pliku */
  await page.setInputFiles('[data-file]', new URL('../public/favicon.svg', import.meta.url).pathname); await page.waitForTimeout(1500);
  const fv = await page.evaluate(() => (window as any).__logoTest.drawing());
  t('SVG (favicon strony) przez pole pliku: rysunek logo w siatce ≤ 80×32', fv.style === 'logo' && fv.cols <= 80 && fv.rows <= 32 && fv.art.join('').includes('8'), { cols: fv.cols, rows: fv.rows });
  const bad = await page.evaluate(async () => { try { await (window as any).__logoTest.load(new Blob(['nie obraz'], { type: 'image/png' }), 'zly.png'); } catch { /* komunikat na stronie */ } return document.querySelector('[data-msg]')!.textContent; });
  t('plik, który nie jest obrazem → czytelny komunikat', !!bad?.includes('Nie da się odczytać tego obrazu'), bad);
  t('brak błędów w konsoli', errors.length === 0, errors);
} finally { await browser.close(); server.kill(); }
for (const [n, ok, info] of res) console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${!ok && info ? `  [${info}]` : ''}`);
console.log(`${res.filter((r) => r[1]).length}/${res.length} OK`); process.exit(res.every((r) => r[1]) ? 0 : 1);
