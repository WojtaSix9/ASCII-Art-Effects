// Strona /video (prośba użytkownika po kroku 10). Część 1 (Node): sceny ascii.rest w app/src/video/scenes (nagłówki, kontrakt
// piece). Część 2 (Chromium): strona na zbudowanej wersji z filmami generowanymi w teście przez ffmpeg (lavfi, bez cudzych nagrań).
// Chromium z Playwrighta nie ma H.264 (ani kodera, ani dekodera), więc filmy testowe są VP9/WebM, a MP4 eksportujemy z VP9
// (haczyk window.__videoCodec); H.264 sprawdza tylko komunikat. Uruchomienie: npm run build && node scripts/video-check.ts
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const res: [string, boolean, string?][] = []; const t = (n: string, ok: boolean, info?: unknown) => res.push([n, ok, info === undefined ? undefined : JSON.stringify(info)]);

// ---------- część 1: Node ----------
const SC = new URL('../src/video/scenes/', import.meta.url).pathname; const files = readdirSync(SC).filter((f) => f.endsWith('.ts')).sort();
t('sceny: 3 pliki, bez logotypów (kategoria scenes)', files.length === 3, files);
for (const f of files) {
  const src = readFileSync(join(SC, f), 'utf8'); const head = src.split('\n').slice(0, 4).join('\n');
  const mod = await import(join(SC, f)); const m = mod.meta; const fr = mod.default(m.options ?? {}); const color = new Uint8Array(m.cols * m.rows);
  const frames = [0, 1, 2.5].map((x) => fr(x, { color }));
  t(`${f}: nagłówek (źródło, commit 8fd792e, MIT, LICENSES/ascii.rest-MIT.txt, zakres zmian), kategoria scenes, klatki rows × cols, indeksy kolorów w palecie, scena się rusza`,
    head.includes('github.com/bas3line/ascii') && head.includes('8fd792e') && head.includes('MIT') && head.includes('LICENSES/ascii.rest-MIT.txt') && head.includes('nothing else changed')
    && m.category === 'scenes' && frames.every((x: string) => x.split('\n').length === m.rows && x.split('\n').every((l) => l.length === m.cols)) && color.every((c) => c < m.palette.length) && new Set(frames).size > 1,
    { name: m.name, cols: m.cols, rows: m.rows });
}

// ---------- filmy testowe (ffmpeg, lavfi) ----------
const dir = mkdtempSync(join(tmpdir(), 'video-'));
const ff = (args: string[]) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
/* 10 s: 4 s czerni, potem 6 s bieli (sprawdza, że podgląd idzie za filmem i że z dłuższego bierzemy 8 s); dźwięk sinus */
const long = join(dir, 'czarny-bialy-10s.webm');
ff(['-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=30:d=4', '-f', 'lavfi', '-i', 'color=c=white:s=320x180:r=30:d=6', '-f', 'lavfi', '-i', 'sine=f=440:d=10',
  '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-map', '2:a', '-c:v', 'libvpx-vp9', '-b:v', '200k', '-c:a', 'libopus', long]);
/* 3 s, pionowy, ruchomy wzór testsrc2 */
const short = join(dir, 'testsrc-3s.webm'); ff(['-f', 'lavfi', '-i', 'testsrc2=s=180x320:r=30:d=3', '-c:v', 'libvpx-vp9', '-b:v', '200k', short]);
/* H.264 (Chromium z Playwrighta go nie dekoduje → komunikat) */
const avc = join(dir, 'testsrc-h264.mp4'); ff(['-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', avc]);
const junk = join(dir, 'nie-film.webm'); writeFileSync(junk, 'to nie jest film');
const probe = (f: string) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,width,height,nb_read_frames', '-of', 'json', f]).toString()).streams as { codec_type: string; codec_name: string; width: number; height: number; nb_read_frames: string }[];

// ---------- część 2: Chromium ----------
const BASE = 'http://localhost:4173';
const server = spawn('npx', ['vite', 'preview'], { stdio: 'ignore' });
for (let i = 0; ; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* czekamy */ } if (i > 100) { server.kill(); throw new Error('vite preview nie wystartował'); } await new Promise((r) => setTimeout(r, 100)); }
const browser = await chromium.launch(); const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + '/'); await page.click('.nav__links a[href="/video"]'); await page.waitForSelector('[data-drop]');
  t('nawigacja: link „Wideo” prowadzi do /video', page.url().endsWith('/video') && (await page.textContent('h1')) === 'Wideo w ASCII');
  await page.waitForFunction(() => document.querySelectorAll('[data-effect] option').length > 0);
  const effs = await page.$$eval('[data-effect] option', (o) => o.map((x) => (x as HTMLOptionElement).value));
  t('efekty: tylko rodzina ASCII (10: ASCII & Text + Cross, Diamond, Lines, Diagonal)', effs.join() === 'characters,block-chars,braille,dots,mixed,asciiStudio,cross,diamond,lines,diagonal', effs);

  /* sceny: trzy kanwy 800 × 400 z obrazem (nie samo tło), podpis z nazwą i notką, uwaga, że to nie wynik narzędzia */
  await page.waitForTimeout(1500);
  const sc = await page.$$eval('[data-scene]', (cs) => cs.map((c) => { const k = c as HTMLCanvasElement; const d = k.getContext('2d')!.getImageData(0, 0, k.width, k.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) ink++; return { w: k.width, h: k.height, ink: ink / (d.length / 4), cap: k.nextElementSibling!.textContent }; }));
  const note = await page.textContent('.vscenes');
  t('przykłady: 3 sceny ascii.rest 800×400, każda z obrazem (> 5% jasnych pikseli), podpis „nazwa: notka”, opis „nie wynik tego narzędzia”', sc.length === 3 && sc.every((s) => s.w === 800 && s.h === 400 && s.ink > 0.05 && s.cap!.includes(':')) && !!note?.includes('nie wynik tego narzędzia'), sc);

  /* film 10 s → pierwsze 8 s, komunikat; 15 fps = 120 klatek, 480 × 270 */
  await page.setInputFiles('[data-file]', long);
  await page.waitForFunction(() => (window as any).__videoTest.frames() > 0 && (window as any).__videoTest.idle(), null, { timeout: 120_000 });
  const i1 = await page.evaluate(() => (window as any).__videoTest.info()); const m1 = await page.textContent('[data-msg]');
  t('film 10 s: wczytane pierwsze 8 s (120 klatek po 15 fps), klatki 480 × 270, komunikat o przycięciu', i1.truncated && i1.n === 120 && i1.used === 8 && i1.w === 480 && i1.h === 270 && !!m1?.includes('pierwszych 8 s'), { i1, m1 });
  const nf = await page.evaluate(() => (window as any).__videoTest.frames());
  const l = await page.evaluate(() => [15, 45, 75, 105].map((k) => (window as any).__videoTest.luma(k)));
  /* próg z budowy filmu: czarne klatki (0–4 s) w efekcie dają samo tło; białe (4–8 s) – znaki na całej powierzchni; wystarczy porządek */
  t('podgląd: 120 klatek; klatki z czarnej części (1 s, 3 s) ciemniejsze niż z białej (5 s, 7 s)', nf === 120 && Math.max(l[0].mean, l[1].mean) < Math.min(l[2].mean, l[3].mean) && l[0].w === 480, l);
  const cv = await page.evaluate(() => { const c = document.querySelector('[data-canvas]') as HTMLCanvasElement; return { hidden: c.hidden, w: c.width, h: c.height }; });
  t('podgląd: kanwa widoczna, 480 × 270', !cv.hidden && cv.w === 480 && cv.h === 270, cv);

  /* zmiana efektu → nowy podgląd */
  const before = l[3].mean; await page.evaluate(() => (window as any).__videoTest.setEffect('braille'));
  await page.waitForFunction(() => (window as any).__videoTest.idle(), null, { timeout: 60_000 }); await page.waitForTimeout(300);
  const after = await page.evaluate(() => (window as any).__videoTest.luma(105));
  t('zmiana efektu (Characters → Braille): podgląd przeliczony (inna jasność klatki 7 s)', Math.abs(after.mean - before) > 0.5, { before, after: after.mean });

  /* eksport GIF 720 px: 720 × 405, 120 klatek, bez dźwięku (GIF go nie ma) */
  const dl = async (fmt: string, side: string) => { await page.selectOption('[data-format]', fmt); await page.selectOption('select[name="side"]', side); const [d] = await Promise.all([page.waitForEvent('download', { timeout: 300_000 }), page.click('[data-download]')]); return { name: d.suggestedFilename(), path: (await d.path())! }; };
  const gif = await dl('gif', '720'); const gp = probe(gif.path);
  t('GIF 720 px: plik czarny-bialy-10s-braille.gif, 720 × 405, 120 klatek', gif.name === 'czarny-bialy-10s-braille.gif' && gp.length === 1 && gp[0].width === 720 && gp[0].height === 405 && +gp[0].nb_read_frames === 120, { name: gif.name, gp });

  /* MP4 H.264: brak kodera w tym Chromium → komunikat */
  await page.selectOption('[data-format]', 'mp4'); await page.click('[data-download]');
  await page.waitForFunction(() => /H\.264|Gotowe|Błąd/.test(document.querySelector('[data-msg]')!.textContent ?? ''), null, { timeout: 60_000 });
  const mm = await page.textContent('[data-msg]'); t('MP4 (H.264) w Chromium z Playwrighta: komunikat zamiast pliku', !!mm?.includes('nie koduje wideo H.264'), mm);
  /* MP4 przez VP9 (tylko test): jedna ścieżka wideo, bez dźwięku, mimo dźwięku w źródle; 480 × 270, 120 klatek */
  await page.evaluate(() => { (window as any).__videoCodec = 'vp9'; });
  const mp4 = await dl('mp4', '480'); const mp = probe(mp4.path);
  t('MP4 (VP9, test): tylko ścieżka wideo (źródło ma dźwięk), 480 × 270, 120 klatek', mp.length === 1 && mp[0].codec_type === 'video' && mp[0].width === 480 && mp[0].height === 270 && +mp[0].nb_read_frames === 120, mp);
  /* przerwanie eksportu */
  await page.selectOption('[data-format]', 'gif'); await page.selectOption('select[name="side"]', '1080'); await page.click('[data-download]');
  await page.waitForSelector('[data-cancel]:not([hidden])'); await page.waitForTimeout(500); await page.click('[data-cancel]');
  await page.waitForFunction(() => (window as any).__videoTest.idle(), null, { timeout: 60_000 });
  t('Przerwij: eksport przerwany, komunikat „Przerwano.”', (await page.textContent('[data-msg]')) === 'Przerwano.');

  /* krótki pionowy film, 12 fps: 3 s → 36 klatek, 270 × 480, bez komunikatu o przycięciu */
  await page.selectOption('select[name="fps"]', '12'); await page.waitForTimeout(100);
  await page.setInputFiles('[data-file]', short);
  await page.waitForFunction(() => (window as any).__videoTest.info()?.n === 36 && (window as any).__videoTest.frames() === 36 && (window as any).__videoTest.idle(), null, { timeout: 60_000 });
  const i2 = await page.evaluate(() => (window as any).__videoTest.info()); const m2 = await page.textContent('[data-msg]');
  t('film 3 s pionowy, 12 fps: 36 klatek 270 × 480, bez komunikatu o przycięciu', !i2.truncated && i2.w === 270 && i2.h === 480 && !m2?.includes('pierwszych'), { i2, m2 });

  /* H.264 na wejściu: ten Chromium go nie dekoduje → komunikat o kodeku; plik nie-film → komunikat */
  await page.setInputFiles('[data-file]', avc); await page.waitForFunction(() => (window as any).__videoTest.idle() && /dekoduje|Gotowe|Błąd|odczytać/.test(document.querySelector('[data-msg]')!.textContent ?? '') || (window as any).__videoTest.info()?.codec === 'avc', null, { timeout: 60_000 });
  const m3 = await page.textContent('[data-msg]'); const i3 = await page.evaluate(() => (window as any).__videoTest.info());
  t('film H.264: w Chromium bez dekodera H.264 komunikat o kodeku (avc); w przeglądarce z dekoderem wczytany', !!m3?.includes('nie dekoduje tego filmu (kodek avc)') || i3?.codec === 'avc', { m3, codec: i3?.codec });
  await page.setInputFiles('[data-file]', junk); await page.waitForFunction(() => (window as any).__videoTest.idle() && /odczytać|ścieżki/.test(document.querySelector('[data-msg]')!.textContent ?? ''), null, { timeout: 30_000 }).catch(() => {});
  const m4 = await page.textContent('[data-msg]'); t('plik, który nie jest filmem: komunikat', !!m4 && /odczytać|ścieżki wideo/.test(m4), m4);
} finally { await browser.close(); server.kill(); }
t('brak błędów w konsoli', errors.length === 0, errors);
for (const [n, ok, info] of res) console.log(`${ok ? "OK  " : "FAIL"} ${n}${(!ok || process.env.VERBOSE) && info ? `  [${info}]` : ""}`);
console.log(`${res.filter((r) => r[1]).length}/${res.length} OK`); process.exit(res.every((r) => r[1]) ? 0 : 1);
