// Czcionki znaków silnika (Characters), ładowane do FontFaceSet bieżącego kontekstu (self.fonts w Workerze).
// Czcionki z npm, OFL-1.1 (brief 00, sekcja 3). Każdy podzbiór @fontsource dostaje swój unicode-range, więc
// przeglądarka pobiera tylko te pliki, których znaki są potrzebne (ensureGlyphs).
//  - Geist Mono: główny krój, ładowany od razu (wszystkie podzbiory).
//  - Noto Sans Mono, tylko podzbiór greek: Σ Δ Ψ Ω z presetu Math (brak w Geist Mono).
//  - Noto Sans JP: półszerokie katakana z presetu Katakana (brak w Geist Mono), rozproszone po wielu podzbiorach.
// Braille, Dots i Geometric rysuje kod silnika (engine/src/core/glyphs-drawn.ts), nie czcionka.
import geistCss from '@fontsource/geist-mono/400.css?raw';
import notoMonoCss from '@fontsource/noto-sans-mono/400.css?raw';
import notoJpCss from '@fontsource/noto-sans-jp/400.css?raw';

const geistUrls = import.meta.glob('/node_modules/@fontsource/geist-mono/files/geist-mono-*-400-normal.woff2', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const notoMonoUrls = import.meta.glob('/node_modules/@fontsource/noto-sans-mono/files/noto-sans-mono-greek-400-normal.woff2', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const notoJpUrls = import.meta.glob('/node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-*-400-normal.woff2', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export const GLYPH_FONTS = [
  { family: 'Geist Mono', css: geistCss, urls: geistUrls, eager: true },
  { family: 'Noto Sans Mono', css: notoMonoCss, urls: notoMonoUrls, eager: false },
  { family: 'Noto Sans JP', css: notoJpCss, urls: notoJpUrls, eager: false },
] as const;
export const GLYPH_STACK = GLYPH_FONTS.map((f) => `"${f.family}"`).join(', ') + ', monospace';

function faces(def: (typeof GLYPH_FONTS)[number]) {
  const out: FontFace[] = [];
  for (const block of def.css.split('@font-face').slice(1)) {
    const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(block)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
    const url = file && Object.entries(def.urls).find(([k]) => k.endsWith('/' + file))?.[1];
    if (url && range) out.push(new FontFace(def.family, `url(${url})`, { weight: '400', style: 'normal', unicodeRange: range }));
  }
  return out;
}

/** Rejestruje wszystkie czcionki; Geist Mono ładuje od razu, pozostałe czekają na ensureGlyphs. */
export async function loadGlyphFonts(set: FontFaceSet) {
  const t0 = performance.now(); const report: { family: string; faces: number; loaded: number }[] = [];
  for (const def of GLYPH_FONTS) {
    const fs = faces(def); fs.forEach((f) => set.add(f));
    const res = def.eager ? await Promise.allSettled(fs.map((f) => f.load())) : [];
    report.push({ family: def.family, faces: fs.length, loaded: res.filter((r) => r.status === 'fulfilled').length });
  }
  return { fonts: report, ms: Math.round(performance.now() - t0) };
}

/** Pobiera podzbiory potrzebne do narysowania `text` (przed renderem, bo maski znaków są zapamiętywane na stałe). */
export async function ensureGlyphs(set: FontFaceSet, text: string) {
  if (text.trim()) await set.load(`16px ${GLYPH_STACK}`, text);
}
