// Krok 3: hero ze suwakiem i panel parametrów w Chromium (Playwright) na zbudowanej wersji.
// Uruchomienie: npm run build && node scripts/ui-check.ts
import { spawn } from 'node:child_process';
import { chromium, type Page } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { EFFECTS } from '../../engine/src/index.ts';
import { SAMPLES, HERO_SAMPLE } from '../src/config/sample.ts';
import { READY, THUMB, sampleNoFor } from '../src/config/thumbs.ts';
import { TILES } from '../src/home/tiles.ts';

const BASE = 'http://localhost:4173';
const server = spawn('npx', ['vite', 'preview'], { stdio: 'ignore' });
for (let i = 0; ; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* czekamy */ }
  if (i > 100) { server.kill(); throw new Error('vite preview nie wystartował'); }
  await new Promise((r) => setTimeout(r, 100));
}
const res: [string, boolean, string?][] = [];
const t = (name: string, ok: boolean, info?: unknown) => res.push([name, ok, info === undefined ? undefined : typeof info === 'string' ? info : JSON.stringify(info)]);

// Skrót pikseli płótna (FNV-1a), liczony na stronie.
const canvasHash = (p: Page, sel: string) => p.evaluate((s) => {
  const c = document.querySelector<HTMLCanvasElement>(s)!; const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let h = 0x811c9dc5; for (let i = 0; i < d.length; i += 7) { h ^= d[i]; h = Math.imul(h, 0x01000193) >>> 0; } return `${c.width}x${c.height}:${h.toString(16)}`;
}, sel);
const rendered = (p: Page, id: string) => p.waitForSelector(`[data-stage][data-rendered="${id}"][aria-busy="false"]`, { timeout: 60_000 });

// Miniatury aktualne wobec zdjęć roboczych (05, krok 5: po podmianie zdjęcia i `npm run thumbs` zmieniają się wszystkie)
{
  const man = JSON.parse(readFileSync(new URL('../public/thumbs/manifest.json', import.meta.url), 'utf8'));
  const stale = SAMPLES.map((s, i) => ({ n: i + 1, now: createHash('sha1').update(readFileSync(new URL('../public' + s.src, import.meta.url))).digest('hex'), was: man.samples[i + 1]?.sha1 })).filter((x) => x.now !== x.was);
  t('miniatury: manifest zgodny z bieżącymi zdjęciami roboczymi (inaczej: npm run thumbs)', stale.length === 0, stale);
  const missing = READY.filter((e) => !man.thumbs[e.id] || man.thumbs[e.id].sample !== sampleNoFor(e.id));
  t(`miniatury: każdy z ${READY.length} gotowych efektów ma miniaturę na właściwym zdjęciu (naprzemiennie)`, missing.length === 0 && READY.length === 18, missing.map((e) => e.id));
}

const browser = await chromium.launch();
try {
  for (const dpr of [1, 2]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    const page = await ctx.newPage(); const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    // --- Hero ---
    await page.goto(BASE + '/'); await rendered(page, 'characters');
    const geo = await page.evaluate(() => {
      const st = document.querySelector<HTMLElement>('[data-stage]')!; const a = document.querySelector<HTMLCanvasElement>('[data-after]')!; const b = document.querySelector<HTMLCanvasElement>('[data-before]')!;
      return { W: st.clientWidth, H: st.clientHeight, scale: Number(st.dataset.scale), aw: a.width, ah: a.height, bw: b.width, bh: b.height, dpr: devicePixelRatio };
    });
    // Kadr cover ze zdjęcia hero; skala = min(1, piksele ekranu / piksele kadru)
    const nat = await page.evaluate(async (src) => { const i = new Image(); i.src = src; await i.decode(); return [i.naturalWidth, i.naturalHeight]; }, HERO_SAMPLE.src);
    const k = Math.max(geo.W / nat[0], geo.H / nat[1]), sw = Math.min(nat[0], Math.round(geo.W / k)), sh = Math.min(nat[1], Math.round(geo.H / k));
    const expScale = Math.min(1, (geo.W * dpr) / sw, (geo.H * dpr) / sh);
    t(`dpr ${dpr}: skala podglądu hero = min(1, ekran/kadr) = ${expScale.toFixed(3)}`, Math.abs(geo.scale - expScale) < 0.002, geo);
    t(`dpr ${dpr}: płótno „po” ma rozmiar kadru × skala (±1 px) i równe „przed”`, Math.abs(geo.aw - sw * expScale) <= 1 && Math.abs(geo.ah - sh * expScale) <= 1 && geo.aw === geo.bw && geo.ah === geo.bh, geo);
    if (dpr === 2) continue;

    const h0 = await canvasHash(page, '[data-after]'), hb = await canvasHash(page, '[data-before]');
    t('hero: render „po” różni się od „przed”', h0 !== hb);
    await page.click('[data-chip="halftone"]'); await rendered(page, 'halftone');
    const pressed = await page.locator('[data-chip][aria-pressed="true"]').allTextContents();
    t('hero: chip Halftone → aria-pressed tylko na nim, inny obraz, link edytora', JSON.stringify(pressed) === '["Halftone"]' && (await canvasHash(page, '[data-after]')) !== h0
      && (await page.getAttribute('[data-open]', 'href')) === '/editor?style=halftone', pressed);
    // Najnowszy wygrywa: szybkie kliknięcia → na końcu widać ostatni wybrany efekt
    for (const id of ['dots', 'lego', 'mosaic', 'dither', 'posterize']) await page.click(`[data-chip="${id}"]`);
    await rendered(page, 'posterize');
    await page.waitForTimeout(300);
    t('hero: 5 szybkich kliknięć → wyświetlony ostatni (posterize)', (await page.getAttribute('[data-stage]', 'data-rendered')) === 'posterize');

    // Suwak: klawiatura
    const now = () => page.getAttribute('[data-handle]', 'aria-valuenow');
    await page.focus('[data-handle]');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    const v60 = await now(); const clip = await page.evaluate(() => getComputedStyle(document.querySelector('[data-after]')!).clipPath);
    await page.keyboard.press('Home'); const v0 = await now(); await page.keyboard.press('End'); const v100 = await now();
    await page.keyboard.press('PageDown'); const v90 = await now();
    t('suwak: →×5 = 60, Home = 0, End = 100, PageDown = 90; clip-path „po” = inset 60%', v60 === '60' && v0 === '0' && v100 === '100' && v90 === '90' && clip.includes('60%'), { v60, v0, v100, v90, clip });
    // Suwak: mysz (przeciąganie w dowolnym miejscu obrazu)
    const box = (await page.locator('[data-stage]').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.4); await page.mouse.down();
    const d25 = Number(await now());
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.4, { steps: 5 }); const d75 = Number(await now()); await page.mouse.up();
    t('suwak: mysz w 25% → 25, przeciągnięcie do 75% → 75; uchwyt ma fokus', Math.abs(d25 - 25) <= 1 && Math.abs(d75 - 75) <= 1 && (await page.evaluate(() => document.activeElement?.hasAttribute('data-handle'))), { d25, d75 });
    await page.click('[data-chip="dots"]'); await rendered(page, 'dots');
    t('suwak: klik w chip zmienia efekt, a nie pozycję suwaka', Math.abs(Number(await now()) - 75) <= 1, await now());

    // --- Edytor: panel z `params` ---
    await page.goto(BASE + '/editor?style=dots'); await rendered(page, 'dots');
    t('edytor: ?style=dots → wybrany Dots', (await page.inputValue('[data-style]')) === 'dots');
    // Dla każdego z 18 efektów: liczba kontrolek = liczba parametrów; render bez błędu
    const ids = await page.$$eval('[data-style] option', (o) => o.map((x) => (x as HTMLOptionElement).value));
    const counts: string[] = [];
    for (const id of ids) {
      await page.selectOption('[data-style]', id); await rendered(page, id);
      const c = await page.evaluate(() => ({ controls: document.querySelectorAll('[data-panel] [data-p], [data-panel] [data-gradient]').length, url: new URL(location.href).searchParams.get('style'), note: document.querySelector('[data-note]')!.textContent }));
      const exp = EFFECTS.find((e) => e.id === id)?.params.length;
      counts.push(`${id}:${c.controls}/${exp}`);
      if (c.controls !== exp || c.url !== id || c.note) counts.push(`!${id} kontrolek=${c.controls} oczekiwane=${exp} url=${c.url} note=${c.note}`);
    }
    t(`edytor: ${ids.length} efektów; kontrolek tyle co parametrów w silniku, render bez błędu, URL ?style= nadąża`, ids.length === 18 && !counts.some((c) => c.startsWith('!')), counts.join(' '));

    // Zmiana parametru zmienia obraz; powrót do wartości daje identyczny obraz (podpięcie + determinizm)
    await page.selectOption('[data-style]', 'characters'); await rendered(page, 'characters');
    const c0 = await canvasHash(page, '[data-canvas]');
    const setRange = async (id: string, v: number) => {
      await page.$eval(`[data-p="${id}"]`, (el, val) => { const i = el as HTMLInputElement; i.value = String(val); i.dispatchEvent(new Event('input', { bubbles: true })); }, v);
      await page.waitForTimeout(50); await rendered(page, 'characters');
      await page.waitForFunction(() => document.querySelector('[data-stage]')!.getAttribute('aria-busy') === 'false');
    };
    await setRange('cellSize', 20); const c20 = await canvasHash(page, '[data-canvas]'); const out20 = await page.textContent('[data-out="cellSize"]');
    await setRange('cellSize', 10); const c10 = await canvasHash(page, '[data-canvas]');
    t('panel: Cell size 20 → inny obraz i etykieta „20 px”; powrót do 10 → identyczny obraz', c20 !== c0 && c10 === c0 && out20 === '20 px', { c0, c20, c10, out20 });
    await page.selectOption('[data-p="charSet"]', 'braille'); await page.waitForTimeout(50); await rendered(page, 'characters');
    await page.waitForFunction(() => document.querySelector('[data-stage]')!.getAttribute('aria-busy') === 'false');
    t('panel: lista Character set → Braille zmienia obraz', (await canvasHash(page, '[data-canvas]')) !== c0);
    const s0 = await page.inputValue('[data-p="seed"]'); await page.click('[data-random="seed"]'); const s1 = await page.inputValue('[data-p="seed"]');
    t('panel: „Losuj” zmienia seed', s0 !== s1, { s0, s1 });
    // Skala podglądu edytora: płótno w pikselach = obraz × skala
    const eg = await page.evaluate(() => { const st = document.querySelector<HTMLElement>('[data-stage]')!; const c = document.querySelector<HTMLCanvasElement>('[data-canvas]')!; return { scale: Number(st.dataset.scale), w: c.width, cssW: parseFloat(c.style.width) }; });
    const w1 = await page.evaluate(async (src) => { const i = new Image(); i.src = src; await i.decode(); return i.naturalWidth; }, SAMPLES[0].src);
    t(`edytor: podgląd w rozdzielczości ekranu (szer. płótna = ${w1} × skala = szer. CSS przy dpr 1)`, Math.abs(eg.w - w1 * eg.scale) <= 1 && Math.abs(eg.w - eg.cssW) <= 1, eg);
    // Przełącznik zdjęcia roboczego
    await page.selectOption('[data-sample]', '2'); await page.waitForFunction(() => document.querySelector('[data-stage]')!.getAttribute('aria-busy') === 'false');
    await page.waitForTimeout(300); await page.waitForFunction(() => document.querySelector('[data-stage]')!.getAttribute('aria-busy') === 'false');
    t('edytor: zdjęcie 2 → inny obraz, ?sample=2 w adresie', (await canvasHash(page, '[data-canvas]')) !== c0 && new URL(page.url()).searchParams.get('sample') === '2');

    // --- Kafelki na stronie głównej ---
    await page.goto(BASE + '/'); await rendered(page, 'characters');
    await page.locator('.tiles').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.tile img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30_000 });
    const tiles = await page.$$eval('[data-tile]', (as) => as.map((a) => ({ id: (a as HTMLElement).dataset.tile, href: a.getAttribute('href'), after: a.querySelector<HTMLImageElement>('.tile__after')!.naturalWidth, before: a.querySelector<HTMLImageElement>('.tile__before')!.naturalWidth })));
    t('kafelki: 9, każdy z miniaturą 960 px i kadrem „przed”, link do edytora z efektem i jego zdjęciem',
      tiles.length === 9 && JSON.stringify(tiles.map((x) => x.id)) === JSON.stringify(TILES) && tiles.every((x) => x.after === THUMB.w && x.before === THUMB.w && x.href === `/editor?style=${x.id}&sample=${sampleNoFor(x.id!)}`), tiles);
    const op = (id: string) => page.$eval(`[data-tile="${id}"] .tile__before`, (e) => getComputedStyle(e).opacity);
    const o0 = await op('lego'); await page.hover('[data-tile="lego"]'); await page.waitForTimeout(350); const o1 = await op('lego');
    await page.mouse.move(5, 5); await page.waitForTimeout(350); const o2 = await op('lego');
    t('kafelki: hover → oryginał (opacity 0 → 1), po zjechaniu wraca do wyniku', o0 === '0' && o1 === '1' && o2 === '0', { o0, o1, o2 });
    await page.focus('[data-tile="dither"]'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    t('kafelki: fokus z klawiatury też pokazuje oryginał', (await op('dither')) === '1' || (await page.waitForTimeout(300), await op('dither')) === '1');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const dur = await page.$eval('[data-tile="lego"] .tile__before', (e) => getComputedStyle(e).transitionDuration);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    t('kafelki: prefers-reduced-motion → bez animacji przejścia', dur === '0s', dur);
    await page.click('[data-tile="braille"]'); await rendered(page, 'braille');
    t('kafelki: klik → edytor z tym efektem i tym samym zdjęciem co miniatura', (await page.inputValue('[data-style]')) === 'braille' && (await page.inputValue('[data-sample]')) === String(sampleNoFor('braille')));

    // Nieznany efekt
    await page.goto(BASE + '/editor?style=warhol'); await rendered(page, 'characters');
    const n = await page.textContent('[data-note]');
    t('edytor: ?style=warhol (efekt „wkrótce”) → komunikat i Characters', !!n?.includes('warhol') && new URL(page.url()).searchParams.get('style') === 'characters', n);

    // Wąski ekran: bez poziomego przewijania strony, chipy przewijają się w pasku
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(BASE + '/'); await rendered(page, 'characters');
    const nw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, chips: document.querySelector('.hero__chips')!.scrollWidth > document.querySelector('.hero__chips')!.clientWidth }));
    t('375 px: strona bez poziomego przewijania, chipy przewijane w pasku', nw.sw <= 375 && nw.chips, nw);

    t('brak błędów w konsoli', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
for (const [n, ok, info] of res) console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${!ok && info ? `  [${info}]` : ''}`);
const okN = res.filter((r) => r[1]).length; console.log(`${okN}/${res.length} OK`);
process.exit(okN === res.length ? 0 : 1);
