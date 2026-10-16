// Krok 5: edytor w Chromium (Playwright) na zbudowanej wersji. Uruchomienie: npm run build && node scripts/editor-check.ts
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium, type Page } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_SOURCE } from '../src/config/limits.ts';
import { READY } from '../src/config/thumbs.ts';

const BASE = 'http://localhost:4173';
const server = spawn('npx', ['vite', 'preview'], { stdio: 'ignore' });
for (let i = 0; ; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* czekamy */ } if (i > 100) { server.kill(); throw new Error('vite preview nie wystartował'); } await new Promise((r) => setTimeout(r, 100)); }
const res: [string, boolean, string?][] = [];
const t = (name: string, ok: boolean, info?: unknown) => res.push([name, ok, info === undefined ? undefined : typeof info === 'string' ? info : JSON.stringify(info)]);

const hash = (p: Page, sel = '[data-canvas]') => p.evaluate((s) => {
  const c = document.querySelector<HTMLCanvasElement>(s)!; const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let h = 0x811c9dc5; for (let i = 0; i < d.length; i += 3) { h ^= d[i]; h = Math.imul(h, 0x01000193) >>> 0; } return `${c.width}x${c.height}:${h.toString(16)}`;
}, sel);
/** Czeka, aż edytor nic nie robi (render, kolejka, przeliczenie układu, wczytywanie) – sygnał z edytora, nie odgadywane opóźnienie.
 *  Dwa kolejne odczyty co 50 ms, bo akcja mogła jeszcze nie zdążyć uruchomić renderu. */
const idle = (p: Page) => p.waitForFunction(() => (window as any).__editorTest?.isIdle(), null, { timeout: 60_000, polling: 50 });
const settle = async (p: Page) => { await idle(p); await p.waitForTimeout(50); await idle(p); };
const setRange = async (p: Page, sel: string, v: number) => {
  await p.$eval(sel, (el, val) => { const i = el as HTMLInputElement; i.value = String(val); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  await settle(p);
};

// Duży PNG 4000×2000 (gradient) do testu wczytywania własnego zdjęcia
const { createCanvas } = createRequire(new URL('../../engine/package.json', import.meta.url))('@napi-rs/canvas');
const big = createCanvas(4000, 2000); const bg = big.getContext('2d'); const grd = bg.createLinearGradient(0, 0, 4000, 2000);
grd.addColorStop(0, '#102040'); grd.addColorStop(1, '#f0c080'); bg.fillStyle = grd; bg.fillRect(0, 0, 4000, 2000); bg.fillStyle = '#e04030'; bg.beginPath(); bg.arc(1200, 900, 500, 0, 7); bg.fill();
const bigPng: Buffer = big.toBuffer('image/png');

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage(); const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + '/editor?style=characters&sample=1'); await idle(page);

  // Układ (05, sekcja 8)
  const L = await page.evaluate(() => ({
    styles: document.querySelectorAll('[data-pick]').length, rail: document.querySelectorAll('[data-rail] button').length,
    disabled: [...document.querySelectorAll<HTMLButtonElement>('[data-rail] button')].filter((b) => b.disabled).length,
    tools: !!document.querySelector('[data-ed-tools] [data-undo]'), fav: /ulubione/i.test(document.body.textContent ?? ''),
  }));
  t(`układ: ${READY.length} stylów w lewym panelu, szyna 7 ikon (Animation aktywna dla Characters: glint/scan, etap 2; Kadr i Tekst od kroku 7), narzędzia w pasku górnym, bez Ulubionych`, L.styles === READY.length && L.rail === 7 && L.disabled === 0 && L.tools && !L.fav, L);

  // Lewy panel
  const h0 = await hash(page);
  await page.click('[data-pick="dots"]'); await settle(page);
  t('lewy panel: klik „Dots” → render Dots, zaznaczenie, lista stylu i adres nadążają',
    (await page.getAttribute('[data-pick="dots"]', 'aria-pressed')) === 'true' && (await page.inputValue('[data-style]')) === 'dots' && new URL(page.url()).searchParams.get('style') === 'dots' && (await hash(page)) !== h0);
  await page.fill('[data-search]', 'brai');
  t('lewy panel: szukaj „brai” → tylko Braille', JSON.stringify(await page.$$eval('[data-pick]', (b) => b.map((x) => (x as HTMLElement).dataset.pick))) === '["braille"]');
  await page.fill('[data-search]', '');
  const w0 = (await page.locator('[data-left]').boundingBox())!.width;
  await page.click('[data-collapse]'); await page.waitForTimeout(250); const w1 = (await page.locator('[data-left]').boundingBox())!.width;
  const exp1 = await page.getAttribute('[data-collapse]', 'aria-expanded');
  await page.click('[data-collapse]'); await page.waitForTimeout(250); const w2 = (await page.locator('[data-left]').boundingBox())!.width;
  await settle(page);   // zmiana szerokości sceny → przeliczenie skali podglądu (ResizeObserver, debounce 150 ms)
  t('lewy panel: zwiń/rozwiń (aria-expanded, szerokość 311 → wąsko → 311)', Math.round(w0) === 311 && w1 < 80 && exp1 === 'false' && Math.round(w2) === 311, { w0, w1, w2 });

  // Cofnij / ponów
  await page.click('[data-pick="characters"]'); await settle(page);
  const c0 = await hash(page);
  await setRange(page, '[data-panel] [data-p="cellSize"]', 18); const c18 = await hash(page);
  await page.click('[data-ed-tools] [data-undo]'); await settle(page);
  const cu = await hash(page); const vu = await page.inputValue('[data-panel] [data-p="cellSize"]');
  await page.click('[data-ed-tools] [data-redo]'); await settle(page);
  const cr = await hash(page); const vr = await page.inputValue('[data-panel] [data-p="cellSize"]');
  t('cofnij/ponów: Cell size 18 → cofnij = obraz i suwak jak przed zmianą, ponów = jak po', c18 !== c0 && cu === c0 && vu === '10' && cr === c18 && vr === '18', { vu, vr });
  await page.click('[data-pick="lego"]'); await settle(page);
  await page.keyboard.press('Control+z'); await settle(page);
  t('cofnij: Ctrl+Z po zmianie stylu wraca do Characters z jego ustawieniami (Cell size 18)', (await page.inputValue('[data-style]')) === 'characters' && (await page.inputValue('[data-panel] [data-p="cellSize"]')) === '18' && (await hash(page)) === c18);
  await page.focus('[data-search]'); await page.keyboard.type('x'); await page.keyboard.press('Control+z');
  t('cofnij: Ctrl+Z w polu tekstowym nie zmienia stylu (zostaje Characters)', (await page.inputValue('[data-style]')) === 'characters');
  await page.fill('[data-search]', '');
  // Seria ruchów suwaka (input) z jednym puszczeniem (change) = jeden krok historii
  await page.$eval('[data-panel] [data-p="cellSize"]', (el) => { const i = el as HTMLInputElement; for (const v of [19, 20, 21, 22]) { i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); } i.dispatchEvent(new Event('change', { bubbles: true })); });
  await settle(page); await page.click('[data-ed-tools] [data-undo]'); await settle(page);
  t('historia: przeciąganie suwaka 18→22 to jeden krok cofania (wraca do 18)', (await page.inputValue('[data-panel] [data-p="cellSize"]')) === '18');

  // Color
  const k0 = await hash(page);
  await page.click('[data-tab="color"]'); await page.selectOption('[data-color] [data-p="preset"]', 'sepia'); await settle(page);
  const k1 = await hash(page);
  await page.click('[data-color-reset]'); await settle(page);
  t('Color: Sepia zmienia obraz, „Resetuj Color” przywraca identyczny', k1 !== k0 && (await hash(page)) === k0);

  // Krok 7: Photo Filter, Gradient Map, Levels, Curves w zakładce Color
  {
    const col = () => page.evaluate(() => (window as any).__editorTest.state().color);
    await page.click('[data-tab="color"]');
    const k0 = await hash(page);
    const ids = await page.$$eval('[data-color] [data-p]', (els) => els.map((e) => (e as HTMLElement).dataset.p));
    t('Color: kolejność jak w oryginale (preset, Photo Filter, tint, saturation, vibrance, hue, Gradient Map, grayscale, invert)',
      JSON.stringify(ids) === JSON.stringify(['preset', 'photoFilter', 'photoDensity', 'photoPreserve', 'tint', 'tintOpacity', 'blend', 'saturation', 'vibrance', 'hue', 'gradientMap', 'gradientAmount', 'grayscale', 'invertImage']), ids);
    await page.selectOption('[data-color] [data-p="photoFilter"]', 'warm'); await settle(page); const kw = await hash(page);
    await setRange(page, '[data-color] [data-p="photoDensity"]', 0);
    t('Photo Filter: Warming zmienia obraz, gęstość 0 = bez zmian (bajt w bajt)', kw !== k0 && (await hash(page)) === k0);
    await page.selectOption('[data-color] [data-p="photoFilter"]', 'none'); await settle(page);
    await page.selectOption('[data-color] [data-p="gradientMap"]', 'ocean'); await settle(page); const kg = await hash(page);
    await page.selectOption('[data-color] [data-p="gradientMap"]', 'none'); await settle(page);
    t('Color/Gradient Map: Ocean zmienia obraz, None przywraca', kg !== k0 && (await hash(page)) === k0);
    await setRange(page, '[data-levels] [data-p="levelsGamma"]', 1.8); const kl = await hash(page);
    t('Levels: gamma 1,8 zmienia obraz i trafia do stanu', kl !== k0 && (await col()).levelsGamma === 1.8);
    await page.click('[data-ed-tools] [data-undo]'); await settle(page);
    t('Levels: cofnij przywraca gammę 1 i obraz', (await hash(page)) === k0 && (await page.inputValue('[data-levels] [data-p="levelsGamma"]')) === '1');
    // Curves
    const cvPts = async (ch = 'rgb') => ((await col()).curves ?? { rgb: [[0, 0], [1, 1]] })[ch];
    const cv = page.locator('[data-cv]'); await cv.scrollIntoViewIfNeeded(); const box = (await cv.boundingBox())!;
    await cv.click({ position: { x: box.width * 0.3, y: box.height * 0.4 } }); await settle(page);
    let pts = await cvPts();
    t('Curves: kliknięcie dodaje punkt (ok. 0,30 → 0,60) i zmienia obraz', pts.length === 3 && Math.abs(pts[1][0] - 0.3) < 0.01 && Math.abs(pts[1][1] - 0.6) < 0.01 && (await hash(page)) !== k0, pts);
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Shift+ArrowRight'); await settle(page);
    pts = await cvPts(); const want = [Math.round(0.3 * 255 + 10) / 255, Math.round(0.6 * 255 + 1) / 255];
    t('Curves: strzałka ↑ = +1/255, Shift+→ = +10/255', Math.abs(pts[1][0] - want[0]) < 1.5 / 255 && Math.abs(pts[1][1] - want[1]) < 1.5 / 255, pts[1]);
    const bx = await page.inputValue('[data-px]'), by = await page.inputValue('[data-py]');
    await page.fill('[data-py]', '40'); await page.locator('[data-py]').dispatchEvent('change'); await settle(page);
    pts = await cvPts();
    t('Curves: pole „Wyjście” ustawia punkt (40/255) i pokazuje wartości zaznaczonego', Math.abs(pts[1][1] - 40 / 255) < 1e-9 && Number(bx) > 0 && Number(by) > 0, { bx, by, p: pts[1] });
    await page.mouse.move(box.x + pts[1][0] * box.width, box.y + (1 - pts[1][1]) * box.height); await page.mouse.down();
    await page.mouse.move(box.x + 0.5 * box.width, box.y + 0.5 * box.height, { steps: 4 }); await page.mouse.up(); await settle(page);
    pts = await cvPts();
    t('Curves: przeciągnięcie przesuwa punkt na (0,5; 0,5)', Math.abs(pts[1][0] - 0.5) < 0.01 && Math.abs(pts[1][1] - 0.5) < 0.01, pts[1]);
    await cv.focus(); await page.keyboard.press('Delete'); await settle(page);
    t('Curves: Delete usuwa zaznaczony punkt (zostają 2 końce, obraz jak na starcie)', (await cvPts()).length === 2 && (await hash(page)) === k0);
    await page.click('[data-ch="r"]'); await cv.click({ position: { x: box.width * 0.5, y: box.height * 0.2 } }); await settle(page);
    const c = await col(); const kr = await hash(page);
    t('Curves: kanał R ma własną krzywą, RGB bez zmian', c.curves.r.length === 3 && c.curves.rgb.length === 2 && kr !== k0, c.curves);
    // Eksport uwzględnia korekty: PNG @1x = render w skali 1
    const same = await page.evaluate(async () => {
      const T = (window as any).__editorTest; const r = await T.renderAt(1); const png = await T.exportBlob('png', 1);
      const bmp = await createImageBitmap(png.blob); const c2 = new OffscreenCanvas(bmp.width, bmp.height); const g = c2.getContext('2d')!; g.drawImage(bmp, 0, 0);
      const dig = async (d: BufferSource) => [...new Uint8Array(await crypto.subtle.digest('SHA-1', d))].join(',');
      return (await dig(g.getImageData(0, 0, bmp.width, bmp.height).data)) === (await dig(new Uint8Array(r.img.buffer)));
    });
    t('Curves: eksport PNG @1x z krzywą R = render w skali 1', same);
    await page.click('[data-color-reset]'); await settle(page);
    t('„Resetuj Color, Levels i Curves” przywraca obraz bajt w bajt', (await hash(page)) === k0 && Object.keys(await col()).length === 0);
  }

  // Post FX
  await page.click('[data-tab="postfx"]'); await page.check('[data-fx-on="vignette"]'); await settle(page);
  const p1 = await hash(page); const shown = await page.isVisible('[data-fx-params="vignette"] [data-p="intensity"]');
  await page.uncheck('[data-fx-on="vignette"]'); await settle(page);
  t('Post FX: Vignette zmienia obraz i pokazuje parametry; wyłączenie przywraca identyczny', p1 !== k0 && shown && (await hash(page)) === k0);

  // Post FX per glif (krok 7.2): aktywne tylko w stylach glifowych; ustawienie przetrwa zmianę stylu
  const style0 = await page.inputValue('[data-style]');
  const pick = (id: string) => page.evaluate((v) => { const el = document.querySelector<HTMLSelectElement>('[data-style]')!; el.value = v; el.dispatchEvent(new Event('change')); }, id);   // select stylu jest w ukrytej zakładce Styl
  const gstate = () => page.evaluate(() => { const r = document.querySelector('[data-fx="charChroma"]')!; return { dis: (r.querySelector('[data-fx-on]') as HTMLInputElement).disabled, note: !(r.querySelector('[data-fx-note]') as HTMLElement).hidden, inState: !!(window as any).__editorTest.state().postFx.charChroma }; });
  await pick('braille'); await settle(page); const b0 = await hash(page);
  const gOn = await gstate(); await page.check('[data-fx-on="charChroma"]'); await settle(page); const b1 = await hash(page);
  await pick('pixel'); await settle(page); const gOff = await gstate();
  await pick('braille'); await settle(page); const b2 = await hash(page); const gBack = await gstate();
  await page.uncheck('[data-fx-on="charChroma"]'); await settle(page); const b3 = await hash(page);
  t('Post FX: Character Chromatic zmienia Braille; w Pixel Art wyszarzony z podpowiedzią, ustawienie zostaje; po powrocie ten sam obraz; wyłączenie przywraca identyczny',
    !gOn.dis && !gOn.note && b1 !== b0 && gOff.dis && gOff.note && gOff.inState && !gBack.dis && b2 === b1 && b3 === b0, { gOn, gOff, gBack, same: b2 === b1, back: b3 === b0 });
  await page.check('[data-fx-on="halftone"]'); await settle(page); const b4 = await hash(page); await page.uncheck('[data-fx-on="halftone"]'); await settle(page);
  t('Post FX: Halftone zmienia obraz, wyłączenie przywraca identyczny', b4 !== b0 && (await hash(page)) === b0);
  await pick(style0); await settle(page);

  // Kadr (krok 7.3)
  {
    const ET = () => page.evaluate(() => { const t = (window as any).__editorTest; return { st: t.state(), v: t.view() }; });
    const k0c = await hash(page);
    await page.click('[data-ed-tools] [data-crop-open]'); const tabOn = await page.isVisible('[data-tabpanel="crop"] [data-cpad]');
    await page.click('[data-aspect="1:1"]'); await settle(page); const a1 = await ET(); const cv1 = await page.evaluate(() => { const c = document.querySelector<HTMLCanvasElement>('[data-canvas]')!; return { w: c.width, h: c.height, cssW: parseFloat(c.style.width), cssH: parseFloat(c.style.height) }; });
    const lp = await page.evaluate(() => document.querySelector<HTMLElement>('[data-lpad]')!.style.aspectRatio);
    t('kadr: przycisk w pasku otwiera zakładkę; 1:1 → kwadrat w px źródła, płótno kwadratowe (piksele i wymiary na ekranie), obraz inny, pole świateł w proporcji kadru',
      tabOn && Math.abs(a1.v.sw - a1.v.sh) <= 1 && Math.abs(cv1.w - cv1.h) <= 1 && Math.abs(cv1.cssW - cv1.cssH) <= 1 && (await hash(page)) !== k0c && lp.replace(/\s/g, '') === `${a1.v.sw}/${a1.v.sh}`, { v: a1.v, cv1, lp });
    // przeciągnięcie środka przesuwa, rozmiar bez zmian; cofnij wraca
    const pad = (await page.locator('[data-cpad]').boundingBox())!; const bx = (await page.locator('[data-crop-box]').boundingBox())!;
    await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await page.mouse.down();
    await page.mouse.move(bx.x + bx.width / 2 - pad.width * 0.1, bx.y + bx.height / 2, { steps: 4 }); await page.mouse.up(); await settle(page); const a2 = await ET();
    t('kadr: przeciągnięcie przesuwa kadr w lewo, rozmiar ten sam', a2.v.sx < a1.v.sx && a2.v.sw === a1.v.sw && a2.v.sh === a1.v.sh, { a1: a1.v, a2: a2.v });
    await page.click('[data-ed-tools] [data-undo]'); await settle(page); const a3 = await ET();
    t('kadr: cofnij przywraca poprzednie położenie', a3.v.sx === a1.v.sx && a3.v.sy === a1.v.sy);
    // narożnik przy 1:1 zostaje kwadratem
    const bx2 = (await page.locator('[data-crop-box]').boundingBox())!;
    await page.mouse.move(bx2.x + bx2.width - 3, bx2.y + bx2.height - 3); await page.mouse.down(); /* uchwyt narożnika: połowa wewnątrz pola */ await page.mouse.move(bx2.x + bx2.width * 0.6, bx2.y + bx2.height * 0.8, { steps: 4 }); await page.mouse.up(); await settle(page); const a4 = await ET();
    t('kadr: narożnik zmniejsza kadr i przy 1:1 zostaje kwadrat', a4.v.sw < a1.v.sw && Math.abs(a4.v.sw - a4.v.sh) <= 1 && a4.v.sx === a1.v.sx && a4.v.sy === a1.v.sy, a4.v);
    // Dowolne + pola w px
    await page.click('[data-aspect="free"]'); await page.fill('[data-cf="w"]', '400'); await page.locator('[data-cf="w"]').dispatchEvent('change'); await settle(page);
    await page.fill('[data-cf="x"]', '100'); await page.locator('[data-cf="x"]').dispatchEvent('change'); await settle(page); const a5 = await ET();
    t('kadr: pola X i szerokość ustawiają kadr w px źródła (Dowolne: wysokość bez zmian)', a5.v.sw === 400 && a5.v.sx === 100 && a5.v.sh === a4.v.sh, a5.v);
    // klawiatura
    await page.focus('[data-crop-box]'); await page.keyboard.press('ArrowDown'); await settle(page); const a6 = await ET();
    const srcH = await page.evaluate(() => (document.querySelector<HTMLInputElement>('[data-cf="h"]')!.max ? Number(document.querySelector<HTMLInputElement>('[data-cf="h"]')!.max) : 0));
    t('kadr: strzałka w dół przesuwa o 1% wysokości zdjęcia', Math.abs(a6.v.sy - a5.v.sy - Math.round(srcH * 0.01)) <= 1, { from: a5.v.sy, to: a6.v.sy, srcH });
    // eksport w wymiarach kadru, zgodny z renderem w skali 1
    await page.click('[data-export]'); const sz = await page.textContent('[data-size="2"]'); await page.click('[data-cancel]');
    const ex = await page.evaluate(async () => { const t = (window as any).__editorTest; const r = await t.exportBlob('png', 1); const b = await createImageBitmap(r.blob); const c = new OffscreenCanvas(b.width, b.height); const g = c.getContext('2d')!; g.drawImage(b, 0, 0);
      const e = g.getImageData(0, 0, b.width, b.height).data; const rr = await t.renderAt(1); const d = new Uint8Array(rr.img.buffer); let diff = 0; for (let i = 0; i < d.length; i++) diff = Math.max(diff, Math.abs(d[i] - e[i])); return { w: r.w, h: r.h, diff, len: d.length === e.length }; });
    t('kadr: eksport @1x ma wymiary kadru i te same piksele co render (PNG), etykieta @2x = kadr × 2', ex.w === a6.v.sw && ex.h === a6.v.sh && ex.len && ex.diff === 0 && sz === `${a6.v.sw * 2}×${a6.v.sh * 2} px`, { ex, sz, v: a6.v });
    // reset → bajt w bajt jak bez kadru; cofnij → kadr wraca
    await page.click('[data-crop-reset]'); await settle(page); const r0 = await ET(); const kr = await hash(page);
    await page.click('[data-ed-tools] [data-undo]'); await settle(page); const r1 = await ET();
    t('kadr: reset = brak kadru i obraz identyczny jak przed kadrowaniem; cofnij przywraca kadr', r0.st.crop === null && kr === k0c && !!r1.st.crop && r1.v.sw === a6.v.sw, { k: kr === k0c });
    await page.click('[data-crop-reset]'); await settle(page);
    const smp = await page.inputValue('[data-sample]'); await page.click('[data-aspect="4:5"]'); await settle(page); const had = !!(await ET()).st.crop;
    await page.selectOption('[data-sample]', smp === '1' ? '2' : '1'); await settle(page); const after = await ET();
    t('kadr: zmiana zdjęcia usuwa kadr (dotyczył poprzedniego zdjęcia)', had && after.st.crop === null);
    await page.selectOption('[data-sample]', smp); await settle(page);
    await page.click('[data-tab="style"]');
  }

  // Warstwa tekstu (krok 7.4)
  {
    const ST = () => page.evaluate(() => (window as any).__editorTest.state());
    const h0 = await hash(page);
    await page.click('[data-ed-tools] [data-text-add]'); await settle(page);
    const s1 = await ST(); const h1 = await hash(page);
    const ui1 = await page.evaluate(() => ({ tab: !document.querySelector<HTMLElement>('[data-tabpanel="text"]')!.hidden, box: !!document.querySelector('[data-tbox="0"]'), focus: document.activeElement?.hasAttribute('data-ttext') }));
    t('tekst: przycisk T dodaje napis, otwiera zakładkę Tekst, obraz się zmienia, na płótnie jest ramka napisu', s1.text.length === 1 && h1 !== h0 && ui1.tab && ui1.box && !!ui1.focus, ui1);
    await page.fill('[data-ttext]', 'Zażółć gęślą'); await settle(page); const h2 = await hash(page);
    await page.fill('[data-ttext]', '   '); await settle(page); const h3 = await hash(page);
    t('tekst: pole tekstu zmienia napis; same spacje = obraz jak bez napisu', h2 !== h1 && h3 === h0);
    await page.fill('[data-ttext]', 'PLAKAT'); await page.locator('[data-ttext]').dispatchEvent('change'); await settle(page);
    const redo0 = await page.isDisabled('[data-ed-tools] [data-redo]'); await page.focus('[data-ttext]'); await page.keyboard.press('Control+z'); await settle(page);
    t('tekst: Ctrl+Z w polu napisu nie cofa historii edytora (Ponów nadal wyłączone; cofa tylko przeglądarka w polu)', redo0 && (await page.isDisabled('[data-ed-tools] [data-redo]')));
    await page.fill('[data-ttext]', 'PLAKAT'); await page.locator('[data-ttext]').dispatchEvent('change'); await settle(page);
    // kroje: Bebas Neue (wąski) ma węższą ramkę niż Geist Mono, więc czcionka naprawdę się wczytała w Workerze
    const boxW = () => page.evaluate(() => document.querySelector<HTMLElement>('[data-tbox="0"]')!.getBoundingClientRect().width);
    const wMono = await boxW(); await page.selectOption('[data-tparams] [data-p="font"]', 'bebas'); await settle(page); const wBebas = await boxW();
    await page.selectOption('[data-tparams] [data-p="font"]', 'playfair'); await settle(page); const wPlay = await boxW();
    t('tekst: zmiana kroju działa w Workerze (Bebas Neue wyraźnie węższy niż Geist Mono, Playfair inny)', wBebas < wMono * 0.75 && Math.abs(wPlay - wMono) > 2, { wMono, wBebas, wPlay });
    // przeciąganie ramki i cofnij
    const bb = (await page.locator('[data-tbox="0"]').boundingBox())!; const cvb = (await page.locator('[data-canvas]').boundingBox())!;
    const before = await ST();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + bb.width / 2 + cvb.width * 0.2, bb.y + bb.height / 2 - cvb.height * 0.3, { steps: 5 }); await page.mouse.up(); await settle(page);
    const after = await ST(); const bb2 = (await page.locator('[data-tbox="0"]').boundingBox())!;
    t('tekst: przeciągnięcie przesuwa napis (+20% X, −30% Y ±1) i ramkę po renderze', Math.abs(after.text[0].x - before.text[0].x - 20) <= 1 && Math.abs(after.text[0].y - before.text[0].y + 30) <= 1 && Math.abs((bb2.x - bb.x) - cvb.width * 0.2) <= 3, { b: [before.text[0].x, before.text[0].y], a: [after.text[0].x, after.text[0].y] });
    await page.click('[data-ed-tools] [data-undo]'); await settle(page);
    t('tekst: cofnij przywraca położenie napisu', (await ST()).text[0].y === before.text[0].y);
    await page.focus('[data-tbox="0"]'); await page.keyboard.press('Shift+ArrowLeft'); await settle(page);
    t('tekst: Shift + strzałka w lewo przesuwa o 5%', (await ST()).text[0].x === before.text[0].x - 5);
    // eksport = render (z napisem)
    const same = await page.evaluate(async () => { const T = (window as any).__editorTest; const r = await T.renderAt(1); const png = await T.exportBlob('png', 1);
      const bmp = await createImageBitmap(png.blob); const c2 = new OffscreenCanvas(bmp.width, bmp.height); const g = c2.getContext('2d')!; g.drawImage(bmp, 0, 0);
      const dig = async (d: BufferSource) => [...new Uint8Array(await crypto.subtle.digest('SHA-1', d))].join(','); return (await dig(g.getImageData(0, 0, bmp.width, bmp.height).data)) === (await dig(new Uint8Array(r.img.buffer))); });
    t('tekst: eksport PNG @1x z napisem = render w skali 1', same);
    // porównanie ukrywa ramki; limit 4; Delete usuwa
    await page.click('[data-ed-tools] [data-compare]'); const hid = await page.evaluate(() => document.querySelector<HTMLElement>('[data-tlayer]')!.hidden); await page.click('[data-ed-tools] [data-compare]');
    for (let i = 0; i < 4; i++) await page.click('[data-ed-tools] [data-text-add]');
    await settle(page); const n4 = (await ST()).text.length; const dis = await page.isDisabled('[data-tadd]'); const msg = await page.textContent('[data-note]');
    t('tekst: porównanie ukrywa ramki; najwyżej 4 napisy (przycisk wyłączony, komunikat)', hid && n4 === 4 && dis && !!msg?.includes('4'), { n4, dis, msg });
    for (let i = 3; i >= 0; i--) { await page.focus(`[data-tbox="${i}"]`).catch(() => {}); await page.keyboard.press('Delete'); await settle(page); }
    const sEnd = await ST(); const hEnd = await hash(page);
    t('tekst: Delete na ramce usuwa napisy; po usunięciu obraz jak bez napisów', sEnd.text.length === 0 && hEnd === h0, { n: sEnd.text.length });
    await page.click('[data-tab="style"]');
  }

  // Porównanie
  await page.click('[data-ed-tools] [data-compare]');
  const cmp = await page.evaluate(() => ({ pressed: document.querySelector('[data-compare]')!.getAttribute('aria-pressed'), vis: getComputedStyle(document.querySelector('[data-before]')!).display }));
  await page.click('[data-ed-tools] [data-compare]');
  t('porównanie: przycisk pokazuje oryginał na wierzchu, drugi klik ukrywa', cmp.pressed === 'true' && cmp.vis === 'block' && (await page.evaluate(() => getComputedStyle(document.querySelector('[data-before]')!).display)) === 'none', cmp);

  // Zoom
  const z0 = await page.evaluate(() => ({ s: Number(document.querySelector<HTMLElement>('[data-stage]')!.dataset.scale), w: parseFloat(document.querySelector<HTMLElement>('[data-canvas]')!.style.width) }));
  await page.click('[data-zoom="1"]'); await settle(page);
  const z1 = await page.evaluate(() => ({ s: Number(document.querySelector<HTMLElement>('[data-stage]')!.dataset.scale), w: parseFloat(document.querySelector<HTMLElement>('[data-canvas]')!.style.width), label: document.querySelector('[data-zoom="fit"]')!.textContent }));
  await page.click('[data-zoom="fit"]'); await settle(page);
  t('zoom: + → 150%, płótno 1,5× szersze, podgląd renderuje się w większej skali (≤ 1); „100%” wraca', z1.label === '150%' && Math.abs(z1.w / z0.w - 1.5) < 0.01 && z1.s > z0.s && z1.s <= 1 && (await page.textContent('[data-zoom="fit"]')) === '100%', { z0, z1 });

  // Lights (docs/07)
  {
    const lights = () => page.evaluate(() => (window as any).__editorTest.state().lights);
    const base = await hash(page);
    await page.click('[data-tab="lights"]'); await page.check('[data-lights-on]'); await settle(page);
    let st = await lights(); const lit = await hash(page);
    t('Lights: włączenie dodaje jedno światło (Radius 30, Intensity 80, białe) i zmienia obraz', st.enabled && st.items.length === 1 && st.items[0].radius === 30 && st.items[0].intensity === 80 && st.items[0].color === '#ffffff' && lit !== base, st);
    await page.uncheck('[data-lights-on]'); await settle(page);
    t('Lights: wyłączenie przywraca obraz bajt w bajt', (await hash(page)) === base);
    await page.check('[data-lights-on]'); await settle(page);
    const pb = (await page.locator('[data-lpad]').boundingBox())!;
    for (const [fx, fy] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) { await page.mouse.click(pb.x + pb.width * fx, pb.y + pb.height * fy); await settle(page); }
    st = await lights();
    t('Lights: kliknięcia w pole dodają światła do limitu 4, piąte daje komunikat', st.items.length === 4 && !!(await page.textContent('[data-note]'))?.includes('Najwyżej 4'), st.items.length);
    await page.focus('[data-light="0"]'); const x0 = st.items[0].x; await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown'); await settle(page);
    st = await lights();
    t('Lights: strzałka → przesuwa o 1%, Shift+strzałka o 5%', Math.abs(st.items[0].x - (x0 + 0.01)) < 1e-9 && Math.abs(st.items[0].y - 0.45) < 1e-9, st.items[0]);
    const h4 = await hash(page);
    await page.focus('[data-light="1"]'); await page.keyboard.press('Delete'); await settle(page);
    const n3 = (await lights()).items.length; await page.click('[data-ed-tools] [data-undo]'); await settle(page);
    t('Lights: Delete usuwa światło, cofnij przywraca je i identyczny obraz', n3 === 3 && (await lights()).items.length === 4 && (await hash(page)) === h4, n3);
    const lb = (await page.locator('[data-light="2"]').boundingBox())!;
    await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2); await page.mouse.down(); await page.mouse.move(pb.x + pb.width * 0.5, pb.y + pb.height * 0.5, { steps: 4 }); await page.mouse.up(); await settle(page);
    st = await lights();
    t('Lights: przeciągnięcie przesuwa światło w środek pola', Math.abs(st.items[2].x - 0.5) < 0.02 && Math.abs(st.items[2].y - 0.5) < 0.02, st.items[2]);
    const hd = await hash(page);
    await setRange(page, '[data-lparams] [data-p="intensity"]', 0);
    await page.$eval('[data-lparams] [data-p="color"]', (i) => { const el = i as HTMLInputElement; el.value = '#ff0000'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); await settle(page);
    st = await lights();
    t('Lights: panel zaznaczonego światła zmienia jego Intensity i kolor', st.items[2].intensity === 0 && st.items[2].color === '#ff0000' && (await hash(page)) !== hd, st.items[2]);
    const ha = await hash(page); await setRange(page, '[data-lamb] [data-p="ambient"]', 40);
    t('Lights: Ambient 40 zmienia obraz', (await lights()).ambient === 40 && (await hash(page)) !== ha);
    // Eksport uwzględnia światła: PNG @1x = render w skali 1
    const same = await page.evaluate(async () => {
      const T = (window as any).__editorTest; const r = await T.renderAt(1); const png = await T.exportBlob('png', 1);
      const bmp = await createImageBitmap(png.blob); const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d')!; g.drawImage(bmp, 0, 0);
      const dig = async (d: BufferSource) => [...new Uint8Array(await crypto.subtle.digest('SHA-1', d))].join(',');
      return (await dig(g.getImageData(0, 0, bmp.width, bmp.height).data)) === (await dig(new Uint8Array(r.img.buffer)));
    });
    t('Lights: eksport PNG @1x ze światłami = render w skali 1 (piksele identyczne)', same);
    // Dither: bez świateł
    await page.click('[data-pick="dither"]'); await settle(page);
    const dl = await page.evaluate(() => ({ dis: document.querySelector<HTMLButtonElement>('[data-tab="lights"]')!.disabled, tab: document.querySelector('[data-tab="style"]')!.getAttribute('aria-pressed') }));
    const hDl = await hash(page); await page.click('[data-tab="style"]');
    t('Lights: przy Dither zakładka wyłączona, panel wraca do Stylu', dl.dis && dl.tab === 'true', dl);
    await page.click('[data-pick="characters"]'); await settle(page); await page.click('[data-tab="lights"]'); await page.uncheck('[data-lights-on]'); await settle(page);
    await page.click('[data-pick="dither"]'); await settle(page);
    t('Lights: Dither ignoruje światła (obraz ze światłami = bez świateł)', (await hash(page)) === hDl);
    await page.click('[data-pick="characters"]'); await settle(page);
  }

  // Losuj
  const s0 = await page.inputValue('[data-panel] [data-p="seed"]'); await page.click('[data-reseed]'); await settle(page);
  t('Losuj (pasek dolny): nowy seed w panelu', (await page.inputValue('[data-panel] [data-p="seed"]')) !== s0);

  // Eksport: PNG @1x bajt w bajt jak render w skali 1; JPG @2x
  const ex = await page.evaluate(async () => {
    const T = (window as any).__editorTest; const st = T.state(); const r = await T.renderAt(1);
    const dig = async (d: Uint8ClampedArray | ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-1', d))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const png = await T.exportBlob('png', 1); const bmp = await createImageBitmap(png.blob); const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d')!; g.drawImage(bmp, 0, 0);
    const pngPix = await dig(g.getImageData(0, 0, bmp.width, bmp.height).data);
    const jpg = await T.exportBlob('jpeg', 2); const jb = await createImageBitmap(jpg.blob);
    return { style: st.style, renderW: r.img.w, renderH: r.img.h, pngType: png.blob.type, pngW: bmp.width, pngH: bmp.height, same: pngPix === (await dig(new Uint8ClampedArray(r.img.buffer))), jpgType: jpg.blob.type, jpgW: jb.width, jpgH: jb.height };
  });
  t('eksport PNG @1x: 1500×1153 (rozmiar zdjęcia 1), piksele identyczne z renderem w skali 1', ex.pngType === 'image/png' && ex.pngW === 1500 && ex.pngH === 1153 && ex.renderW === 1500 && ex.same, ex);
  t('eksport JPG @2x: image/jpeg 3000×2306', ex.jpgType === 'image/jpeg' && ex.jpgW === 3000 && ex.jpgH === 2306, ex);
  // Przez interfejs: okno, rozmiary, pobranie pliku
  await page.click('[data-export]');
  const sizes = [await page.textContent('[data-size="1"]'), await page.textContent('[data-size="2"]')];
  await page.check('input[name="format"][value="jpeg"]'); await page.check('input[name="scale"][value="2"]');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.click('[data-go]')]);
  t('eksport z okna: rozmiary @1x/@2x, plik ascii-art-<styl>@2x.jpg', sizes[0] === '1500×1153 px' && sizes[1] === '3000×2306 px' && dl.suggestedFilename() === `ascii-art-${ex.style}@2x.jpg`, { sizes, file: dl.suggestedFilename() });
  await page.waitForTimeout(1000);
  // Własne zdjęcie 4000×2000 → zmniejszone do 3000×1500
  await page.setInputFiles('[data-file]', { name: 'duze.png', mimeType: 'image/png', buffer: bigPng });
  await page.waitForFunction(() => document.querySelector('[data-note]')?.textContent?.includes('Wczytano'), null, { timeout: 30_000 }); await settle(page);
  const up = await page.evaluate(() => ({ note: document.querySelector('[data-note]')!.textContent, sample: (document.querySelector('[data-sample]') as HTMLSelectElement).value, url: location.search }));
  await page.click('[data-export]'); const usz = await page.textContent('[data-size="2"]'); await page.click('[data-cancel]');
  t(`własne zdjęcie: 4000×2000 → ${MAX_SOURCE}×1500, wybór „Twoje zdjęcie”, bez ?sample w adresie, eksport @2x 6000×3000`,
    !!up.note?.includes('3000×1500') && up.sample === 'user' && !up.url.includes('sample') && usz === '6000×3000 px', { ...up, usz });
  // Limit kanwy: skala 8 przy zdjęciu 3000×1500 = 24000×12000 (288 Mpx) przekracza limit powierzchni kanwy Chromium (ok. 268 Mpx)
  const lim = await page.evaluate(async () => { try { await (window as any).__editorTest.exportBlob('png', 8); return 'ok'; } catch (e) { return (e as Error).message; } });
  t('limit kanwy: zbyt duży eksport zgłasza CANVAS_LIMIT przed renderem (sprawdzenie w Workerze)', lim.startsWith('CANVAS_LIMIT:24000x12000'), lim);

  await page.setInputFiles('[data-file]', { name: 'notatka.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await page.waitForTimeout(200);
  t('własne zdjęcie: plik, który nie jest obrazem → komunikat błędu', !!(await page.textContent('[data-note]'))?.includes('nie jest obrazem'));

  // Etap 2, krok 3: filtr i zakładka Animation, odtwarzacz (pętla liczona z góry w Workerze, potem odtwarzana)
  const ANIM = READY.filter((e) => e.animated).map((e) => e.id);
  await page.goto(BASE + '/editor?style=rgbsplit&sample=1'); await settle(page);
  const lb = await page.$$eval('[data-styles] .badge-anim', (b) => b.map((x) => (x.closest('[data-pick]') as HTMLElement).dataset.pick));
  await page.click('[data-anim-filter]'); const lf = await page.$$eval('[data-pick]', (b) => b.map((x) => (x as HTMLElement).dataset.pick));
  await page.click('[data-anim-filter]'); const lf2 = await page.$$eval('[data-pick]', (b) => b.length);
  t(`lewy panel: badge na ${ANIM.length} stylach z ruchem; filtr Animation → tylko one; ponowny klik → wszystkie`, JSON.stringify(lb) === JSON.stringify(ANIM) && JSON.stringify(lf) === JSON.stringify(ANIM) && lf2 === READY.length, { lb, lf, lf2 });
  const tabOn = !(await page.isDisabled('[data-tab="anim"]')); await page.click('[data-tab="anim"]');
  const motionOpts = await page.$$eval('[data-motion] option', (o) => o.map((x) => (x as HTMLOptionElement).value));
  t('zakładka Animation: aktywna dla RGB Split, lista ruchów z silnika, parametry speed i intensity, długość pętli i fps', tabOn && JSON.stringify(motionOpts) === '["pulse"]' && !!(await page.$('[data-motion-params] [data-p="speed"]')) && !!(await page.$('[data-motion-params] [data-p="intensity"]')) && !!(await page.$('[data-loop-params] [data-p="loopSeconds"]')) && !!(await page.$('[data-loop-params] [data-p="fps"]')), motionOpts);
  const still = await hash(page); const stillW = await page.$eval('[data-canvas]', (c) => (c as HTMLCanvasElement).width);
  const animSt = () => page.evaluate(() => (window as any).__editorTest.anim());
  const t0 = Date.now(); await page.click('[data-play]');
  await page.waitForFunction(() => (window as any).__editorTest.anim()?.phase === 'playing', null, { timeout: 120_000, polling: 100 }); const prepMs = Date.now() - t0;
  const a1 = await animSt();
  const seen = new Set<string>(); for (let i = 0; i < 12; i++) { seen.add(await hash(page)); await page.waitForTimeout(90); }
  const a2 = await animSt(); const cw = await page.$eval('[data-canvas]', (c) => (c as HTMLCanvasElement).width);
  t('odtwarzanie: pętla 4 s × 24 fps = 96 klatek policzonych z góry, potem odtwarzanie; klatki ≤ 720 px; kanwa pokazuje różne klatki', a1.total === 96 && a1.frames === 96 && Math.max(a1.w, a1.h) <= 720 && cw === a1.w && seen.size >= 4 && a2.shown > a1.shown, { a1, a2, seen: seen.size, prepMs });
  await page.$eval('[data-motion-params] [data-p="intensity"]', (el) => { const i = el as HTMLInputElement; i.value = '100'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  const a3 = await animSt();
  await page.waitForFunction(() => (window as any).__editorTest.anim()?.phase === 'playing', null, { timeout: 120_000, polling: 100 });
  t('zmiana ruchu w trakcie: pętla zatrzymana i liczona od nowa, potem dalej gra', a3.phase !== 'playing' && (await animSt()).frames === 96, a3);
  await page.click('[data-play]'); await settle(page); await page.waitForTimeout(150); await settle(page);
  const a4 = await animSt(); const backW = await page.$eval('[data-canvas]', (c) => (c as HTMLCanvasElement).width);
  t('pauza: koniec odtwarzania, zwykły podgląd w pełnej rozdzielczości, obraz statyczny jak przed odtwarzaniem', a4.phase === 'idle' && backW === stillW && (await hash(page)) === still, { a4, backW, stillW });
  await page.click('[data-play]'); await page.waitForFunction(() => (window as any).__editorTest.anim()?.phase !== 'idle', null, { timeout: 10_000 });
  await page.click('[data-pick="lego"]'); await settle(page);
  t('zmiana stylu na efekt bez ruchu (LEGO): odtwarzanie zatrzymane, zakładka Animation wyłączona, panel wraca do Stylu', (await animSt()).phase === 'idle' && (await page.isDisabled('[data-tab="anim"]')) && !(await page.isHidden('[data-tabpanel="style"]')));
  // Etap 2, krok 6: glint i scan w edytorze (Characters: znaki „/” i szumu z czcionki w Workerze)
  await page.click('[data-pick="characters"]'); await settle(page); await page.click('[data-tab="anim"]');
  const cm = await page.$$eval('[data-motion] option', (o) => o.map((x) => (x as HTMLOptionElement).value));
  await page.click('[data-play]'); await page.waitForFunction(() => (window as any).__editorTest.anim()?.phase === 'playing', null, { timeout: 120_000, polling: 100 });
  const cs = new Set<string>(); for (let i = 0; i < 16; i++) { cs.add(await hash(page)); await page.waitForTimeout(120); }
  const ca = await animSt(); await page.click('[data-play]'); await settle(page);
  t('Characters: ruchy glint i scan w zakładce Animation; pętla policzona (96 klatek) i odtwarzana, kanwa pokazuje różne klatki (przejście pasa)', JSON.stringify(cm) === '["glint","scan"]' && ca.frames === 96 && cs.size >= 3, { cm, frames: ca.frames, seen: cs.size });
  await page.click('[data-pick="lego"]'); await settle(page);
  // Etap 2, krok 4: eksport GIF
  await page.click('[data-export]'); const gifHiddenChars = await page.isHidden('[data-anim-only]');   /* tu wybrany jest LEGO (bez ruchu) */ await page.click('[data-cancel]');
  await page.click('[data-pick="rgbsplit"]'); await settle(page); await page.click('[data-tab="anim"]');
  await page.$eval('[data-loop-params] [data-p="loopSeconds"]', (el) => { const i = el as HTMLInputElement; i.value = '1'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.selectOption('[data-loop-params] [data-p="fps"]', '12'); await settle(page);
  await page.click('[data-export]'); const gifVisible = !(await page.isHidden('[data-anim-only]'));
  await page.check('input[name="format"][value="gif"]'); const info = await page.textContent('[data-anim-info]'); const stillHidden = await page.isHidden('[data-for="still"]');
  t('eksport: GIF tylko dla efektów z ruchem; po wyborze GIF rozmiar 480/720/1080 (domyślnie 720) i opis pętli', gifHiddenChars && gifVisible && stillHidden && !!info?.startsWith('720×') && info.includes('12 klatek (1 s × 12 fps)'), { gifHiddenChars, gifVisible, info });
  const [gdl] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.click('[data-go]')]);
  await page.waitForFunction(() => document.querySelector('[data-export-msg]')?.textContent?.startsWith('Gotowe'), null, { timeout: 120_000 });
  const gmsg = await page.textContent('[data-export-msg]'); await page.click('[data-cancel]');
  t('eksport GIF z okna: pasek postępu, plik ascii-art-rgbsplit-720px.gif, komunikat z rozmiarem', gdl.suggestedFilename() === 'ascii-art-rgbsplit-720px.gif' && !!gmsg?.includes('MB'), { file: gdl.suggestedFilename(), gmsg });
  const G = await page.evaluate(async () => {
    const T = (window as any).__editorTest; const g = await T.gif();
    const dec = new (window as any).ImageDecoder({ data: g.bytes, type: 'image/gif' }); await dec.tracks.ready; await dec.completed;
    const n = dec.tracks.selectedTrack.frameCount, rep = dec.tracks.selectedTrack.repetitionCount; const durs: number[] = []; const err: number[] = []; let f0: Uint8ClampedArray | null = null, half = 0, offPal = 0;
    for (let k = 0; k < n; k++) {
      const { image } = await dec.decode({ frameIndex: k }); durs.push(image.duration);
      const c = new OffscreenCanvas(image.displayWidth, image.displayHeight); const x = c.getContext('2d')!; x.drawImage(image, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; image.close();
      if (k === 0) f0 = d; if (k === n / 2) { let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - f0![i]); half = s / (d.length / 4); }
      if (k % 3 === 0) {   /* faza: klatka k najbliższa renderowi w fazie k/n, nie (k+1)/n ani (k+3)/n (bez progu). Nie k+6: pulse to cos, fazy k i n−k dają ten sam obraz */
        const mae = async (ph: number) => { const r = await T.renderPhase(g.w / T.view().sw, ph); const e = new Uint8ClampedArray(r.img.buffer); let s = 0; for (let i = 0; i < d.length; i += 4) for (let q = 0; q < 3; q++) s += Math.abs(d[i + q] - e[i + q]); return +(s / (d.length / 4 * 3)).toFixed(2); };
        err.push([await mae(k / n), await mae(((k + 1) % n) / n), await mae(((k + 3) % n) / n)] as any);
        const pal = new Set<number>(); const gct = 1 << ((g.bytes[10] & 7) + 1); for (let j = 0; j < gct; j++) pal.add((g.bytes[13 + 3 * j] << 16) | (g.bytes[14 + 3 * j] << 8) | g.bytes[15 + 3 * j]);
        for (let i = 0; i < d.length; i += 4) if (!pal.has((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])) { offPal++; }
      }
    }
    let cancel = ''; try { await T.gif(3); } catch (e) { cancel = (e as Error).message; }
    return { w: g.w, h: g.h, size: g.bytes.length, ms: Math.round(g.ms), n, rep, durs, err, half: +half.toFixed(2), cancel, offPal };
  });
  t('GIF (ImageDecoder w Chromium): 12 klatek 720 px (domyślnie), pętla w nieskończoność, czasy 8/8/9 cs (suma 1 s)', G.n === 12 && Math.max(G.w, G.h) === 720 && G.rep === Infinity && G.durs.reduce((a: number, b: number) => a + b, 0) === 1_000_000 && G.durs.every((d: number) => d === 80_000 || d === 90_000), G);
  t('GIF: każdy kolor klatki należy do palety globalnej; klatka k najbliższa renderowi silnika w fazie k/12 (nie k+1, k+3); klatka 6 różni się od 0', G.offPal === 0 && G.err.every((e: number[]) => e[0] < e[1] && e[0] < e[2]) && G.half > 2, { err: G.err, half: G.half, offPal: G.offPal });
  t('GIF: przerwanie w trakcie → błąd CANCELLED', G.cancel === 'CANCELLED', G.cancel);

  // Etap 2, krok 4c: MP4. Chromium z Playwrighta nie ma kodera H.264, więc: ścieżka „brak H.264” w UI + kontener na wymuszonym VP9.
  await page.click('[data-export]'); await page.check('input[name="format"][value="mp4"]');
  await page.waitForFunction(() => !!document.querySelector('[data-export-msg]')?.textContent, null, { timeout: 10_000 });
  const noAvc = { msg: await page.textContent('[data-export-msg]'), go: await page.isDisabled('[data-go]'), info: await page.textContent('[data-anim-info]') };
  await page.selectOption('select[name="side"]', '480'); await page.waitForTimeout(300); await page.click('[data-cancel]');
  t('MP4 bez kodera H.264 (Chromium z Playwrighta): komunikat zamiast pliku, przycisk Pobierz wyłączony', !!noAvc.msg?.includes('nie koduje wideo H.264') && noAvc.go && !!noAvc.info?.includes('12 klatek'), noAvc);
  const M = await page.evaluate(async () => {
    const T = (window as any).__editorTest; let avcErr = ''; try { await T.mp4('avc'); } catch (e) { avcErr = (e as Error).message; }
    const m = await T.mp4('vp9'); const sw = T.view().sw;
    const ph = async (f: number) => Array.from(new Uint8Array((await T.renderPhase(m.w / sw, f)).img.buffer));
    const r = await T.renderPhase(m.w / sw, 0); let cancel = ''; try { await T.mp4('vp9', 3); } catch (e) { cancel = (e as Error).message; }
    return { avcErr, w: m.w, h: m.h, type: m.type, bytes: Array.from(m.bytes as Uint8Array), rw: r.img.w, f3: await ph(3 / 12), f1: await ph(1 / 12), f5: await ph(5 / 12), cancel };
  });
  t('MP4: zlecenie H.264 bez kodera → błąd NO_CODEC (sprawdzenie w Workerze przed renderem); przerwanie → CANCELLED', M.avcErr === 'NO_CODEC:avc' && M.cancel === 'CANCELLED', { avcErr: M.avcErr, cancel: M.cancel });
  const probe = spawnSync('ffprobe', ['-version']).status === 0;
  if (!probe) t('MP4: POMINIĘTE — brak ffprobe w PATH (kontener niesprawdzony)', true);
  else {
    const dir = mkdtempSync(join(tmpdir(), 'mp4-')); const f = join(dir, 'a.mp4'); const buf = Buffer.from(M.bytes); writeFileSync(f, buf);
    const pr = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_name,width,height,pix_fmt,color_range,color_space,color_primaries,color_transfer,r_frame_rate,nb_read_frames,duration', '-of', 'json', f], { encoding: 'utf8' });
    const s = JSON.parse(pr.stdout).streams[0];
    t('MP4 (VP9 wymuszony, ffprobe): 12 klatek, 1,000 s, 12 fps, wymiary parzyste, yuv420p, zakres tv, BT.709 (primaries/transfer/matrix), moov przed mdat, typ video/mp4',
      s.codec_name === 'vp9' && +s.nb_read_frames === 12 && Math.abs(+s.duration - 1) < 1e-6 && s.r_frame_rate === '12/1' && s.width % 2 === 0 && s.height % 2 === 0 && s.width === M.w && s.height === M.h && s.pix_fmt === 'yuv420p' && s.color_range === 'tv'
      && s.color_primaries === 'bt709' && s.color_transfer === 'bt709' && s.color_space === 'bt709' && buf.indexOf('moov') < buf.indexOf('mdat') && M.type === 'video/mp4', { ...s, moov: buf.indexOf('moov'), mdat: buf.indexOf('mdat') });
    /* piksele: klatka 3 zdekodowana przez ffmpeg (YUV→RGB wg znaczników BT.709) vs render silnika w fazach 3/12, 1/12, 5/12 (bez progu: 3 najbliżej).
       Faza 3/12 = najszybszy ruch (offset 7 px vs 9,3 i 4,4); przy 6/12 (minimum cos) sąsiednie fazy różnią się o 0,4 px, poniżej szumu kompresji */
    const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'select=eq(n\\,3)', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 }).stdout as Buffer;
    const mae = (e: number[]) => { let sum = 0, n = 0; for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) for (let q = 0; q < 3; q++) { sum += Math.abs(raw[(y * M.w + x) * 3 + q] - e[(y * M.rw + x) * 4 + q]); n++; } return +(sum / n).toFixed(2); };
    const E = [mae(M.f3), mae(M.f1), mae(M.f5)];
    t('MP4: klatka 3 (dekodowana ffmpeg) najbliższa renderowi silnika w fazie 3/12, nie 1/12 i 5/12 (kolory i kolejność klatek zgodne)', raw.length === M.w * M.h * 3 && E[0] < E[1] && E[0] < E[2], { E, raw: raw.length });
  }
  t('brak błędów w konsoli', errors.length === 0, errors.join(' | '));
} finally { await browser.close(); server.kill(); }
for (const [n, ok, info] of res) console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${!ok && info ? `  [${info}]` : ''}`);
const okN = res.filter((r) => r[1]).length; console.log(`${okN}/${res.length} OK`);
process.exit(okN === res.length ? 0 : 1);
