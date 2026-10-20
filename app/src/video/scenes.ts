// Przykłady pod narzędziem /video (decyzja użytkownika: „Sceny z ascii.rest”): trzy sceny biblioteki ascii.rest (MIT,
// pliki w ./scenes/ bez zmian poza ścieżką typów), odtwarzane na żywo na kanwie. To ilustracja klimatu, nie wynik narzędzia.
// Rysowanie jak mount() w ascii.rest (src/mount.ts): komórka w × w·cell px, znak czcionki o rozmiarze w / 0,6, środek komórki,
// kolor z palety (env.color); tu bez atlasu znaków, za to przerysowujemy tylko komórki, które się zmieniły.
// Scena gra tylko, gdy jest widoczna; przy prefers-reduced-motion stoi na klatce meta.still (0), jak w ascii.rest.
import type { Meta, Piece } from '../../../engine/src/logo/piece-types.ts';

export const SCENES: { slug: string; load: () => Promise<Piece> }[] = [
  { slug: 'alpine-dawn', load: () => import('./scenes/alpine-dawn.ts') as Promise<Piece> },
  { slug: 'ocean-sunset', load: () => import('./scenes/ocean-sunset.ts') as Promise<Piece> },
  { slug: 'misty-forest', load: () => import('./scenes/misty-forest.ts') as Promise<Piece> },
];

export const scenesHtml = () => `<section class="vscenes" aria-labelledby="vscenes-h">
  <h2 id="vscenes-h">Przykłady stylu</h2>
  <p class="ed-hint">Sceny z biblioteki <a href="https://ascii.rest" rel="noopener">ascii.rest</a> (bas3line, licencja MIT), odtwarzane na żywo. To ilustracja klimatu, nie wynik tego narzędzia: sceny są rysowane kodem, a narzędzie wyżej zamienia klatki Twojego filmu.</p>
  <div class="vscenes__grid">${SCENES.map((s) => `<figure class="vscenes__item"><canvas data-scene="${s.slug}" role="img" aria-label="Scena ${s.slug.replace('-', ' ')} z ascii.rest"></canvas><figcaption data-cap="${s.slug}">${s.slug.replace('-', ' ')}</figcaption></figure>`).join('')}</div>
</section>`;

/** Komórka 4 px: scena 200 × 100 komórek daje kanwę 800 × 400 (cell 1) skalowaną CSS-em do szerokości kolumny. */
const CW = 4;

export function mountScenes(root: HTMLElement): () => void {
  let alive = true; const stops: (() => void)[] = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const s of SCENES) {
    const canvas = root.querySelector<HTMLCanvasElement>(`[data-scene="${s.slug}"]`); if (!canvas) continue;
    s.load().then((p) => { if (alive) stops.push(play(canvas, p, reduced, root.querySelector(`[data-cap="${s.slug}"]`))); });
  }
  return () => { alive = false; stops.forEach((f) => f()); };
}

function play(canvas: HTMLCanvasElement, p: Piece, reduced: boolean, cap: Element | null) {
  const m: Meta = p.meta; const cols = m.cols, rows = m.rows, cell = m.cell ?? 2, ch = CW * cell;
  if (cap) cap.textContent = `${m.name}: ${m.note}`;
  canvas.width = cols * CW; canvas.height = rows * ch; canvas.style.aspectRatio = `${cols} / ${rows * cell}`;
  const g = canvas.getContext('2d')!; const pal = m.palette ?? ['#ffffff']; const ground = m.ground ?? '#000000';
  g.fillStyle = ground; g.fillRect(0, 0, canvas.width, canvas.height);
  g.font = `${(CW / 0.6).toFixed(2)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const frame = p.default(m.options ?? {}); const color = new Uint8Array(cols * rows);
  let lastText = '', lastColor = new Uint8Array(cols * rows), raf = 0, visible = false, t0 = performance.now(), shown = 0;
  const draw = (t: number) => {
    const text = frame(t, { color }); if (text === lastText && color.every((c, i) => c === lastColor[i])) return;
    const lines = text.split('\n'); const prev = lastText.split('\n');
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, c = lines[y]?.[x] ?? ' ';
      if (lastText && prev[y]?.[x] === c && lastColor[i] === color[i]) continue;
      g.fillStyle = ground; g.fillRect(x * CW, y * ch, CW, ch);
      if (c !== ' ') { g.fillStyle = pal[color[i]] ?? pal[0]; g.fillText(c, (x + 0.5) * CW, (y + 0.5) * ch); }
    }
    lastText = text; lastColor = color.slice();
  };
  const tick = (now: number) => {
    if (!visible) return;
    const fps = m.fps || 15; const t = shown + (now - t0) / 1000;
    draw(Math.floor(t * fps) / fps); raf = requestAnimationFrame(tick);
  };
  if (reduced || !m.fps) { draw(m.still ?? 0); return () => {}; }
  const io = new IntersectionObserver(([e]) => {
    const was = visible; visible = e.isIntersecting; const now = performance.now();
    if (visible && !was) { t0 = now; raf = requestAnimationFrame(tick); }
    if (!visible && was) { shown += (now - t0) / 1000; cancelAnimationFrame(raf); }
  });
  io.observe(canvas); draw(0);
  return () => { visible = false; cancelAnimationFrame(raf); io.disconnect(); };
}
