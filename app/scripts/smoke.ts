// Test szkieletu w prawdziwej przeglądarce (Chromium z Playwright, headless) na zbudowanej wersji (vite preview).
// Uruchomienie: npm run build && node scripts/smoke.ts
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
const server = spawn('npx', ['vite', 'preview'], { stdio: 'pipe' });
const stop = () => server.kill();
for (let i = 0; ; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* serwer jeszcze nie wstał */ }
  if (i > 100) { stop(); throw new Error('vite preview nie wystartował'); }
  await new Promise((r) => setTimeout(r, 100));
}

const res: [string, boolean, string?][] = [];
const t = (name: string, ok: boolean, info?: string) => res.push([name, ok, info]);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  const ROUTES = [
    { path: '/', h1: 'Zdjęcie jako ASCII, piksele i druk', title: 'ASCII Art Effects', layout: 'site', current: null },
    { path: '/effects', h1: 'Efekty', title: 'Efekty · ASCII Art Effects', layout: 'site', current: 'Efekty' },
    { path: '/logo', h1: 'Logo w ASCII', title: 'Logo · ASCII Art Effects', layout: 'site', current: 'Logo' },
    { path: '/video', h1: 'Wideo w ASCII', title: 'Wideo · ASCII Art Effects', layout: 'site', current: 'Wideo' },
    { path: '/how-to', h1: 'Jak używać', title: 'Jak używać · ASCII Art Effects', layout: 'site', current: 'Jak używać' },
    { path: '/licenses', h1: 'Licencje', title: 'Licencje · ASCII Art Effects', layout: 'site', current: null },
    { path: '/editor', h1: 'Edytor', title: 'Edytor · ASCII Art Effects', layout: 'editor', current: null },
  ];
  for (const r of ROUTES) {
    const resp = await page.goto(BASE + r.path, { waitUntil: 'networkidle' });
    const h1 = (await page.locator('h1').textContent())?.replace(/\s+/g, ' ');
    const title = await page.title();
    const hasNav = await page.locator('header.nav').count(), hasEd = await page.locator('header.ed-top').count();
    const cur = await page.locator('a[aria-current="page"]').allTextContents();
    t(`${r.path}: HTTP 200, h1, tytuł`, resp?.status() === 200 && h1 === r.h1 && title === r.title, `${resp?.status()} "${h1}" "${title}"`);
    t(`${r.path}: układ ${r.layout}`, r.layout === 'site' ? hasNav === 1 && hasEd === 0 : hasNav === 0 && hasEd === 1);
    t(`${r.path}: aria-current`, JSON.stringify(cur) === JSON.stringify(r.current ? [r.current] : []), JSON.stringify(cur));
    const foot = await page.locator('footer.foot').count();
    t(`${r.path}: stopka ${r.layout === 'site' ? 'jest' : 'brak (edytor)'}`, foot === (r.layout === 'site' ? 1 : 0));
  }

  // Krok 8: /how-to (5 kroków, linki wewnętrzne działają), /licenses (6 czcionek, tekst OFL ładowany po otwarciu), stopka
  await page.goto(BASE + '/how-to', { waitUntil: 'networkidle' });
  const ht = await page.evaluate(() => ({ steps: [...document.querySelectorAll('.howto-step h2 .label')].map((e) => e.textContent), links: [...document.querySelectorAll('main a[href^="/"]')].map((a) => a.getAttribute('href')) }));
  t('/how-to: 5 kroków (/krok 1–5) i skróty klawiszowe', ht.steps.join(',') === '/krok 1,/krok 2,/krok 3,/krok 4,/krok 5,/skróty', ht.steps.join(','));
  t('/how-to: linki wewnętrzne prowadzą do istniejących stron (/effects, /editor)', ht.links.length >= 2 && ht.links.every((l) => ['/effects', '/editor'].includes(l!)), ht.links.join(','));
  await page.click('footer.foot a[href="/licenses"]'); await page.waitForSelector('h1:text("Licencje")');
  const lic = await page.locator('details.lic').count(); await page.click('details.lic >> nth=4 >> summary');
  await page.waitForFunction(() => document.querySelectorAll('details.lic')[4].querySelector('pre')!.textContent!.length > 1000);
  const ltxt = await page.locator('details.lic >> nth=4 >> pre').textContent();
  t('/licenses: link w stopce, 6 czcionek i 3 biblioteki kodu (ascii.rest, gifenc, Mediabunny), pełny tekst OFL ładowany po otwarciu (Playfair Display)', lic === 9 && !!ltxt?.includes('SIL OPEN FONT LICENSE') && !!ltxt?.includes('Playfair Display'), String(lic));
  const ext = await page.evaluate(() => [...document.querySelectorAll('footer a[href^="http"]')].map((a) => a.getAttribute('href')));
  t('stopka: link do ascii.rest (brief 00, sekcja 7)', ext.includes('https://ascii.rest'), ext.join(','));

  // Tokeny zastosowane
  await page.goto(BASE + '/how-to', { waitUntil: 'networkidle' });
  const st = await page.evaluate(() => ({
    bg: getComputedStyle(document.body).backgroundColor,
    muted: getComputedStyle(document.querySelector('.label')!).color,
    h1font: getComputedStyle(document.querySelector('h1')!).fontFamily,
    bodyfont: getComputedStyle(document.body).fontFamily,
  }));
  t('tokeny: tło body = --bg #040406', st.bg === 'rgb(4, 4, 6)', st.bg);
  t('tokeny: etykieta = --muted #8f8f8f', st.muted === 'rgb(143, 143, 143)', st.muted);
  t('fonty: h1 = Geist Mono, body = Geist', st.h1font.startsWith('"Geist Mono"') && st.bodyfont.startsWith('Geist'), `${st.h1font} | ${st.bodyfont}`);

  // Czcionki faktycznie wczytane (nie zastępcze). document.fonts.check() zwraca true także dla nieznanej rodziny, więc liczymy załadowane FontFace.
  await page.evaluate(() => document.fonts.ready);
  const faces = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/"/g, '')}|${f.weight}|${f.unicodeRange}`));
  // Chrome normalizuje unicode-range: latin zaczyna się od „U+0-FF”, latin-ext od „U+100-”.
  const loaded = (fam: string, range: RegExp) => faces.some((f) => f.startsWith(fam + '|') && range.test(f.split('|')[2]));
  const LATIN = /^U\+0-FF\b/i, LATIN_EXT = /^U\+100-/i;
  t('fonty: Geist Mono, podzbiór latin wczytany', loaded('Geist Mono', LATIN), faces.join('; '));
  t('fonty: Geist, podzbiór latin wczytany', loaded('Geist', LATIN), faces.join('; '));
  t('fonty: latin-ext wczytany dla „ż” (Jak używać) w obu krojach', loaded('Geist Mono', LATIN_EXT) && loaded('Geist', LATIN_EXT), faces.join('; '));
  // symbols2 (bloki U+2580–259F) pobiera logo „▚▞”; cyrylica, greka, wietnamski nie powinny być pobierane.
  const SYMBOLS2 = /U\+2500-259F/i;
  t('fonty: pobrane tylko latin, latin-ext i symbols2 (logo)', faces.every((f) => [LATIN, LATIN_EXT, SYMBOLS2].some((r) => r.test(f.split('|')[2]))), faces.join('; '));

  // Nawigacja po stronie klienta: bez przeładowania, fokus na h1, wstecz
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { (window as any).__noReload = true; });
  await page.getByRole('link', { name: 'Efekty', exact: true }).click();
  const nav1 = await page.evaluate(() => ({ p: location.pathname, keep: (window as any).__noReload === true, focus: document.activeElement?.tagName, title: document.title }));
  t('SPA: klik „Efekty” → /effects bez przeładowania, fokus na h1', nav1.p === '/effects' && nav1.keep && nav1.focus === 'H1' && nav1.title.startsWith('Efekty'), JSON.stringify(nav1));
  await page.getByRole('link', { name: 'Otwórz edytor' }).click();
  t('SPA: „Otwórz edytor” → /editor', await page.evaluate(() => location.pathname) === '/editor');
  await page.goBack(); await page.goBack();
  const back = await page.evaluate(() => ({ p: location.pathname, h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' '), keep: (window as any).__noReload === true }));
  t('SPA: wstecz ×2 → / bez przeładowania', back.p === '/' && back.h1 === 'Zdjęcie jako ASCII, piksele i druk' && back.keep, JSON.stringify(back));

  // Parametr ?style= i ucieczka HTML
  await page.goto(BASE + '/editor?style=dither');
  await page.waitForSelector('[data-stage][data-rendered="dither"]', { timeout: 60_000 });
  t('/editor?style=dither wybiera Dither', (await page.inputValue('[data-style]')) === 'dither');
  const xss = '<img src=x onerror=alert(1)>';
  await page.goto(BASE + '/editor?style=' + encodeURIComponent(xss));
  await page.waitForSelector('[data-stage][data-rendered="characters"]', { timeout: 60_000 });
  t('/editor?style=<img…> trafia do komunikatu jako tekst, nie jako element', (await page.locator('img[src="x"], [data-note] img').count()) === 0 && !!(await page.textContent('[data-note]'))?.includes(xss));

  // Nieznana trasa i ukośnik końcowy
  await page.goto(BASE + '/nie-ma-takiej', { waitUntil: 'networkidle' });
  t('nieznana trasa → strona 404', (await page.locator('h1').textContent()) === 'Nie znaleziono strony');
  await page.goto(BASE + '/effects/', { waitUntil: 'networkidle' });
  t('/effects/ (ukośnik końcowy) → Efekty', (await page.locator('h1').textContent()) === 'Efekty');

  // Klawiatura: pierwszy Tab = link „Przejdź do treści”, widoczny obrys fokusu
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const kb = await page.evaluate(() => { const a = document.activeElement as HTMLElement; const s = getComputedStyle(a); return { text: a.textContent, top: a.getBoundingClientRect().top }; });
  t('klawiatura: pierwszy Tab → „Przejdź do treści” (widoczny)', kb.text === 'Przejdź do treści' && kb.top >= 0, JSON.stringify(kb));
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement!); return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`; });
  t('klawiatura: fokus ma biały obrys 2 px', ring === 'solid 2px rgb(255, 255, 255)', ring);

  // Wąski ekran: bez poziomego przewijania
  for (const w of [375, 320]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const p of ['/', '/effects', '/logo', '/video', '/how-to', '/licenses', '/editor']) {
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      t(`${w}px ${p}: brak poziomego przewijania`, sw <= w, `scrollWidth ${sw}`);
      if (p === '/editor') {
        await page.waitForFunction(() => (window as any).__editorTest?.isIdle(), null, { timeout: 30000 });
        const ed = await page.evaluate(() => { const c = document.querySelector('[data-canvas]')!.getBoundingClientRect(), r = document.querySelector('[data-rail]')!.getBoundingClientRect(), tb = document.querySelector('.ed-toolbar')!.getBoundingClientRect();
          return { cw: c.width, ch: c.height, below: tb.top >= c.bottom - 1 && r.top >= tb.bottom - 1, rail: r.width }; });
        t(`${w}px /editor: płótno na ≥ 80% szerokości, pasek narzędzi pod płótnem, zakładki pod paskiem`, ed.cw >= 0.8 * w && ed.ch > 100 && ed.below, JSON.stringify(ed));
        await page.click('[data-tab="color"]'); const vis = await page.isVisible('[data-tabpanel="color"] [data-color]');
        await page.mouse.wheel(0, 2000); await page.waitForTimeout(100); const top = await page.evaluate(() => document.querySelector('[data-rail]')!.getBoundingClientRect().top);
        t(`${w}px /editor: zakładka Color działa, szyna zakładek zostaje u góry przy przewijaniu panelu`, vis && Math.abs(top) <= 1, `vis ${vis}, top ${top}`);
        continue;
      }
      // Nagłówek: wszystkie elementy w całości wewnątrz, linki widoczne i klikalne
      const hdr = await page.evaluate(() => {
        const h = document.querySelector('header.nav')!.getBoundingClientRect();
        const inside = [...document.querySelectorAll('header.nav a')].map((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.top >= h.top && r.bottom <= h.bottom && r.left >= 0 && r.right <= innerWidth; });
        return inside;
      });
      t(`${w}px ${p}: logo, linki i przycisk mieszczą się w nagłówku`, hdr.length === 6 && hdr.every(Boolean), JSON.stringify(hdr));
    }
  }

  t('brak błędów w konsoli', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close(); stop();
}
for (const [n, ok, info] of res) console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${!ok && info ? `  [${info}]` : ''}`);
const okN = res.filter((r) => r[1]).length; console.log(`${okN}/${res.length} OK`);
process.exit(okN === res.length ? 0 : 1);
