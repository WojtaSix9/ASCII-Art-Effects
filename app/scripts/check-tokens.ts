// Kontrast tokenów tekstu z src/styles/tokens.css wobec teł, na których są używane (docs/05, sekcje 2 i 9: >= 4,5:1).
// Wzór WCAG 2.x (luminancja względna sRGB). Uruchomienie: node scripts/check-tokens.ts
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const T: Record<string, string> = {};
for (const m of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) T[m[1]] = m[2].toLowerCase();

const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a: string, b: string) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Pary tekst/tło wg użycia z 05 (sekcja 2.1: strona, chipy; 2.2: panele i pola edytora).
const SITE_TEXT = ['text', 'text-2', 'text-nav', 'text-3', 'muted'];
const ED_TEXT = ['text', 'ed-label', 'ed-section', 'ed-value'];
const pairs: [string, string][] = [
  ...SITE_TEXT.map((t) => [t, 'bg'] as [string, string]),
  ['text', 'chip'], ['muted', 'chip'],
  ...ED_TEXT.flatMap((t) => ['ed-top', 'ed-panel', 'ed-rail', 'ed-field', 'ed-tab-active', 'ed-toolbar'].map((b) => [t, b] as [string, string])),
  ['bg', 'text'],            // przycisk główny: ciemny tekst na białym (hover .btn-outline)
];

let fail = 0; const out: string[] = [];
for (const [fg, bg] of pairs) {
  if (!T[fg] || !T[bg]) { out.push(`FAIL brak tokenu: --${fg} lub --${bg}`); fail++; continue; }
  const r = ratio(T[fg], T[bg]); const ok = r >= 4.5; if (!ok) fail++;
  out.push(`${ok ? 'OK  ' : 'FAIL'} --${fg} ${T[fg]} na --${bg} ${T[bg]}: ${r.toFixed(2)}:1`);
}
// Wartości oryginału z 05, które celowo podnieśliśmy: mają nie przechodzić (kontrola samego wzoru).
const orig: [string, string, number][] = [['#6b6b6b', '#040406', 3.84], ['#6d6d6d', '#0a0a0a', 3.83]];
for (const [fg, bg, want] of orig) {
  const r = ratio(fg, bg); const ok = Math.abs(r - want) < 0.03; if (!ok) fail++;
  out.push(`${ok ? 'OK  ' : 'FAIL'} kontrola wzoru: oryginał ${fg} na ${bg} = ${r.toFixed(2)}:1 (05 podaje ${want}:1)`);
}
console.log(out.join('\n')); console.log(`${out.length - fail}/${out.length} OK`);
process.exit(fail ? 1 : 0);
