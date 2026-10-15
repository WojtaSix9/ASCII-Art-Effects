// Audyt dostępności (krok 8): axe-core, reguły WCAG 2.0/2.1 A i AA, na zbudowanej wersji (vite preview).
// Strony serwisu oraz edytor z każdą zakładką panelu, oknem eksportu, światłem i napisem. Także wąski ekran 375 px.
// Uruchomienie: npm run build && node scripts/a11y-check.ts
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';

const BASE = 'http://localhost:4173';
const server = spawn('npx', ['vite', 'preview'], { stdio: 'pipe' });
for (let i = 0; ; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* jeszcze nie */ }
  if (i > 100) { server.kill(); throw new Error('vite preview nie wystartował'); }
  await new Promise((r) => setTimeout(r, 100));
}
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const res: [string, boolean, string?][] = [];
const t = (name: string, ok: boolean, info?: string) => res.push([name, ok, info]);

async function audit(page: Page, name: string) {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => (window as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
  const v = (r.violations as any[]).map((x) => `${x.id} (${x.impact}, ${x.nodes.length}): ${x.nodes.slice(0, 3).map((n: any) => n.target.join(' ')).join(' | ')}`);
  t(`axe ${name}: 0 naruszeń WCAG 2.1 AA`, v.length === 0, v.join('\n      '));
}
const idle = (p: Page) => p.waitForFunction(() => (window as any).__editorTest?.isIdle(), null, { timeout: 30000 });

const browser = await chromium.launch();
try {
  for (const [w, h] of [[1440, 900], [375, 800]] as const) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    for (const p of ['/', '/effects', '/how-to', '/licenses', '/nie-ma']) { await page.goto(BASE + p, { waitUntil: 'networkidle' }); await audit(page, `${w}px ${p}`); }
    await page.goto(BASE + '/editor', { waitUntil: 'networkidle' }); await idle(page);
    for (const tab of ['style', 'lights', 'color', 'postfx', 'text', 'crop']) {
      await page.evaluate((n) => document.querySelector<HTMLButtonElement>(`[data-tab="${n}"]`)!.click(), tab);
      if (tab === 'lights') await page.evaluate(() => { const c = document.querySelector<HTMLInputElement>('[data-lights-on]')!; c.click(); });
      if (tab === 'postfx') await page.evaluate(() => document.querySelector<HTMLInputElement>('[data-fx-on="vignette"]')!.click());
      if (tab === 'text') await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-text-add]')!.click());
      await idle(page); await audit(page, `${w}px /editor, zakładka ${tab}`);
    }
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-export]')!.click()); await audit(page, `${w}px /editor, okno eksportu`);
    await page.close();
  }
} finally { await browser.close(); server.kill(); }
for (const [n, ok, info] of res) console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${!ok && info ? `\n      ${info}` : ''}`);
const okN = res.filter((r) => r[1]).length; console.log(`${okN}/${res.length} OK`);
process.exit(okN === res.length ? 0 : 1);
