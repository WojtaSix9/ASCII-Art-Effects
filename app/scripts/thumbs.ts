// Generuje miniatury przez stronę /dev/thumbs w Chromium (Playwright) i zapisuje je w public/thumbs/.
// Uruchomienie: npm run build && node scripts/thumbs.ts
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
const server = spawn('npx', ['vite', 'preview'], { stdio: 'ignore' });
for (let i = 0; ; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* czekamy */ } if (i > 100) { server.kill(); throw new Error('vite preview nie wystartował'); } await new Promise((r) => setTimeout(r, 100)); }
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(BASE + '/dev/thumbs');
  await page.waitForFunction(() => (window as any).__thumbs, null, { timeout: 300_000 });
  const res = await page.evaluate(() => (window as any).__thumbs);
  if (res.error) throw new Error(res.error);
  const dir = new URL('../public/thumbs/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.webp') || f === 'manifest.json') rmSync(new URL(f, dir));
  for (const f of res.files as { name: string; b64: string }[]) writeFileSync(new URL(f.name, dir), Buffer.from(f.b64, 'base64'));
  const total = (res.files as { b64: string }[]).reduce((a, f) => a + Buffer.from(f.b64, 'base64').length, 0);
  console.log(`${res.files.length} plików w public/thumbs/ (${(total / 1024).toFixed(0)} KB)`);
} finally { await browser.close(); server.kill(); }
