// Eksport animowanego SVG (plik 09, sekcja 6.3; krok 6B etapu 2). Czysta funkcja: klatki (siatka znaków + kolor komórek) → tekst SVG.
// Technika jak w ascii.rest (src/svg.ts, odczytane z github.com/bas3line/ascii @ 8fd792e, MIT; kod własny): każda różna klatka to
// grupa wierszy <text> pokolorowanych odcinkami; CSS pokazuje grupy po kolei (krokowo, bez skryptu, działa w <img> i README);
// wiersze rozciągnięte do siatki (textLength), więc pasują w każdej czcionce o stałej szerokości; przy prefers-reduced-motion
// widać pierwszą klatkę (= obraz statyczny). Kolory komórek sprowadzone do wspólnej palety (median cut), żeby odcinki były dłuższe.
import type { CellGrid } from '../core/types.ts';

export type SvgFont = { family: string; faces: { woff2Base64: string; unicodeRange?: string }[] };
export type SvgOptions = { fps: number; maxColors?: number; font?: SvgFont | null; title?: string };
export const SVG_CELL_W = 10;   // szerokość komórki w jednostkach SVG; wysokość = 10 · ch/cw

/** Median cut: do `max` kolorów z listy RGB (Uint8Array po 3), zwraca paletę i indeks każdego koloru wejścia. */
export function medianCut(rgb: Uint8Array, max: number): { palette: number[][]; index: Uint16Array } {
  const n = rgb.length / 3; const ids = Array.from({ length: n }, (_, i) => i); type Box = number[];
  const boxes: Box[] = [ids]; const range = (b: Box, c: number) => { let lo = 255, hi = 0; for (const i of b) { const v = rgb[i * 3 + c]; if (v < lo) lo = v; if (v > hi) hi = v; } return hi - lo; };
  while (boxes.length < max) {
    let bi = -1, bc = 0, br = 0; boxes.forEach((b, k) => { if (b.length < 2) return; for (let c = 0; c < 3; c++) { const r = range(b, c); if (r > br) { br = r; bi = k; bc = c; } } });
    if (bi < 0 || br === 0) break; const b = boxes[bi].sort((x, y) => rgb[x * 3 + bc] - rgb[y * 3 + bc]); const m = b.length >> 1; boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
  }
  const index = new Uint16Array(n); const palette = boxes.map((b, k) => { const s = [0, 0, 0]; for (const i of b) { s[0] += rgb[i * 3]; s[1] += rgb[i * 3 + 1]; s[2] += rgb[i * 3 + 2]; index[i] = k; } return s.map((v) => Math.round(v / b.length)); });
  return { palette, index };
}
const hex = (c: number[]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Animowane SVG z klatek pętli (równo rozłożonych w czasie, fps). Klatki identyczne z poprzednią łączą się w jedną grupę. */
export function animatedSvg(frames: CellGrid[], o: SvgOptions): string {
  const f0 = frames[0]; const { cols, rows } = f0; const CW = SVG_CELL_W, CH = +(CW * (f0.ch / f0.cw)).toFixed(3); const W = cols * CW, H = +(rows * CH).toFixed(2);
  const all = new Uint8Array(frames.length * cols * rows * 3); frames.forEach((f, k) => all.set(f.rgb, k * cols * rows * 3));
  const { palette, index } = medianCut(all, o.maxColors ?? 32);
  /* grupy: (indeks pierwszej klatki, liczba klatek), łączenie klatek identycznych z poprzednią */
  const key = (k: number) => frames[k].text.join('\n') + '|' + index.subarray(k * cols * rows, (k + 1) * cols * rows).join(',');
  const groups: { k: number; len: number }[] = []; let prev = '';
  frames.forEach((_, k) => { const s = key(k); if (groups.length && s === prev) groups[groups.length - 1].len++; else groups.push({ k, len: 1 }); prev = s; });
  const N = frames.length, T = +(N / o.fps).toFixed(4);
  const fontSize = +Math.min(CH, CW / 0.6).toFixed(3);
  const family = (o.font ? `"${o.font.family}",` : '') + 'ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono","DejaVu Sans Mono",monospace';
  let css = (o.font ? o.font.faces.map((f) => `@font-face{font-family:"${o.font!.family}";src:url(data:font/woff2;base64,${f.woff2Base64}) format("woff2");${f.unicodeRange ? `unicode-range:${f.unicodeRange};` : ''}}`).join('') : '')
    + `text{font-family:${family};font-size:${fontSize}px;white-space:pre;dominant-baseline:central}`
    + palette.map((c, i) => `.c${i.toString(36)}{fill:${hex(c)}}`).join('');
  if (groups.length > 1) {
    const durs = [...new Set(groups.map((g) => g.len))];
    css += `.f{opacity:0;animation-duration:${T}s;animation-timing-function:step-end;animation-iteration-count:infinite}` + durs.map((d) => `@keyframes v${d}{0%{opacity:1}${+((100 * d) / N).toFixed(4)}%,100%{opacity:0}}`).join('')
      + groups.map((g, i) => `.f.g${i}{animation-name:v${g.len};animation-delay:-${+(((N - g.k) % N) / o.fps).toFixed(4)}s}`).join('')
      + `@media (prefers-reduced-motion:reduce){.f{animation:none!important}}`;   /* nakładki ukryte (opacity 0), zostaje baza = klatka 0 = obraz statyczny */
  }
  /* warstwa bazowa = klatka 0 (zawsze widoczna); grupy klatek zawierają tylko odcinki komórek różne od bazy (prostokąt w kolorze tła
     zakrywa bazę, na nim tekst odcinka). Klatki równe bazie nie mają grupy. Przy reduced-motion grupy znikają, zostaje baza. */
  const rowSvg = (k: number, y: number, x0: number, x1: number) => {
    const f = frames[k]; const base = k * cols * rows; const line = [...f.text[y]]; let row = '', run = '', cls = -1;
    const flush = () => { if (run) row += cls < 0 ? esc(run) : `<tspan class="c${cls.toString(36)}">${esc(run)}</tspan>`; run = ''; };
    for (let x = x0; x < x1; x++) { const ch = line[x] ?? ' '; const c = ch === ' ' ? cls : index[base + y * cols + x]; if (c !== cls) { flush(); cls = c; } run += ch; }
    flush(); return row.trim() ? `<text x="${x0 * CW}" y="${+((y + 0.5) * CH).toFixed(2)}" textLength="${(x1 - x0) * CW}" lengthAdjust="spacingAndGlyphs">${row}</text>` : '';
  };
  let baseSvg = ''; for (let y = 0; y < rows; y++) if (frames[0].text[y].trim()) baseSvg += rowSvg(0, y, 0, cols);
  const same = (k: number, y: number, x: number) => frames[k].text[y][x] === frames[0].text[y][x] && (frames[k].text[y][x] === ' ' || index[k * cols * rows + y * cols + x] === index[y * cols + x]);
  const overlays = groups.map((g, gi) => {
    if (gi === 0) return '';
    let out = '';
    for (let y = 0; y < rows; y++) {
      let x = 0;
      while (x < cols) {
        if (same(g.k, y, x)) { x++; continue; }
        let e = x + 1, gap = 0; while (e < cols && gap < 3) { if (same(g.k, y, e)) gap++; else gap = 0; e++; } e -= gap;   /* odcinek, przerwy < 3 komórek scalone */
        out += `<rect x="${x * CW}" y="${+(y * CH).toFixed(2)}" width="${(e - x) * CW}" height="${CH}" class="b"/>` + rowSvg(g.k, y, x, e); x = e;
      }
    }
    return out ? `<g class="f g${gi}">${out}</g>` : '';
  }).join('');
  css += `.b{fill:${hex(f0.ground)}}`;
  const body = `<g>${baseSvg}</g>${overlays}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${o.title ? `<title>${esc(o.title)}</title>` : ''}<style>${css}</style><rect width="100%" height="100%" fill="${hex(f0.ground)}"/>${body}</svg>`;
}
