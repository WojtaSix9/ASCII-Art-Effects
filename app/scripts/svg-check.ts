// Etap 2, krok 6B: animowane SVG (engine/src/export/svg.ts) w Chromium. Klatki liczy silnik w Node; w przeglądarce zatrzymujemy
// animacje CSS w chwili klatki k (Web Animations: currentTime), składamy widoczny tekst z bazy i widocznych nakładek i porównujemy
// znak w znak z klatką k z silnika (test niezależny od czcionki). Uruchomienie: node scripts/svg-check.ts
import { createRequire } from 'node:module'; import { chromium } from 'playwright';
import { renderCells, animatedSvg, canvasGlyphs, medianCut } from '../../engine/src/index.ts';
import { testImage } from '../../engine/scripts/make-test-image.ts';
const { createCanvas } = createRequire(new URL('../../engine/package.json', import.meta.url))('@napi-rs/canvas');
const G = canvasGlyphs((w: number, h: number) => createCanvas(w, h), '"DejaVu Sans Mono"');
const res: [string, boolean, string?][] = []; const t = (n: string, ok: boolean, info?: unknown) => res.push([n, ok, info === undefined ? undefined : JSON.stringify(info)]);

const src = testImage(300, 200); const FPS = 15, N = 30;
const cases: [string, string][] = [['characters', 'glint'], ['characters', 'scan'], ['braille', 'scan'], ['block-chars', 'glint'], ['mixed', 'scan']];
const b = await chromium.launch();
try {
  for (const [id, m] of cases) {
    const frames = Array.from({ length: N }, (_, i) => renderCells(src, { style: { id }, motion: { id: m } }, { phase: i / N, glyphs: G })!);
    const svg = animatedSvg(frames, { fps: FPS });
    const p = await b.newPage(); await p.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
    const read = (time: number | null) => p.evaluate(([time, cols, rows, CW, CH]) => {
      const svgEl = document.querySelector('svg')!; if (time !== null) for (const a of document.getAnimations()) { a.pause(); a.currentTime = time; }
      const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
      const put = (g: Element) => { for (const t of g.querySelectorAll('text')) { const x0 = Math.round(+t.getAttribute('x')! / CW), y = Math.round(+t.getAttribute('y')! / CH - 0.5); const s = [...(t.textContent ?? '')]; s.forEach((c, i) => { grid[y][x0 + i] = c; }); } };
      const gs = [...svgEl.querySelectorAll('g')]; put(gs[0]); const vis = gs.slice(1).filter((g) => getComputedStyle(g).opacity === '1'); vis.forEach(put);
      return { text: grid.map((r) => r.join('')), visible: vis.length };
    }, [time, frames[0].cols, frames[0].rows, 10, 10 * frames[0].ch / frames[0].cw] as const);
    const bad: number[] = []; let maxVis = 0;
    for (let k = 0; k < N; k++) { const r = await read((k + 0.5) * 1000 / FPS); maxVis = Math.max(maxVis, r.visible); if (r.text.join('\n') !== frames[k].text.join('\n')) bad.push(k); }
    const sz = Buffer.byteLength(svg); const cls = new Set(svg.match(/class="c[0-9a-z]+"/g)).size;
    t(`${id}.${m}: w każdej z ${N} klatek widoczny tekst = klatka silnika (znak w znak); najwyżej 1 nakładka naraz; paleta ≤ 32 klas; ${(sz / 1024).toFixed(0)} kB`, bad.length === 0 && maxVis <= 1 && cls <= 32, { bad: bad.slice(0, 5), maxVis, cls });
    await p.emulateMedia({ reducedMotion: 'reduce' }); const rm = await read(null);
    const st = renderCells(src, { style: { id } }, { glyphs: G })!;
    t(`${id}.${m}: prefers-reduced-motion → widać tylko bazę = obraz statyczny efektu`, rm.visible === 0 && rm.text.join('\n') === st.text.join('\n'));
    await p.close();
  }
  const mc = medianCut(new Uint8Array([0, 0, 0, 255, 255, 255, 250, 250, 250, 5, 5, 5]), 2);
  t('median cut: 4 kolory → 2 grupy (ciemne, jasne), każdy kolor w swojej grupie', mc.palette.length === 2 && mc.index[0] === mc.index[3] && mc.index[1] === mc.index[2] && mc.index[0] !== mc.index[1], mc);
  const one = animatedSvg([renderCells(src, { style: { id: 'characters' } }, { glyphs: G })!], { fps: 15 });
  t('jedna klatka (efekt bez ruchu): SVG bez animacji CSS (statyczny obraz)', !one.includes('@keyframes') && !one.includes('class="f'));
} finally { await b.close(); }
for (const [n, ok, info] of res) console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${!ok && info ? `  [${info}]` : ''}`);
console.log(`${res.filter((r) => r[1]).length}/${res.length} OK`); process.exit(res.every((r) => r[1]) ? 0 : 1);
