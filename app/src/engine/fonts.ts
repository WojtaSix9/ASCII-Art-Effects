// Ładuje Geist Mono 400 (wszystkie podzbiory @fontsource z ich unicode-range) do FontFaceSet bieżącego kontekstu.
// Działa w Workerze (self.fonts) i na stronie (document.fonts). Czcionka z npm (decyzja użytkownika, brief 00, sekcja 3).
import css from '@fontsource/geist-mono/400.css?raw';

const urls = import.meta.glob('/node_modules/@fontsource/geist-mono/files/geist-mono-*-400-normal.woff2', {
  query: '?url', import: 'default', eager: true,
}) as Record<string, string>;

export const GLYPH_FAMILY = 'Geist Mono';
export const GLYPH_STACK = '"Geist Mono", monospace';

export async function loadGlyphFont(set: FontFaceSet) {
  const t0 = performance.now(); const faces: FontFace[] = [];
  for (const block of css.split('@font-face').slice(1)) {
    const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(block)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
    const url = file && Object.entries(urls).find(([k]) => k.endsWith('/' + file))?.[1];
    if (!url || !range) continue;
    faces.push(new FontFace(GLYPH_FAMILY, `url(${url})`, { weight: '400', style: 'normal', unicodeRange: range }));
  }
  const loaded = await Promise.allSettled(faces.map(async (f) => { set.add(f); await f.load(); }));
  return { family: GLYPH_FAMILY, faces: faces.length, loaded: loaded.filter((r) => r.status === 'fulfilled').length, ms: Math.round(performance.now() - t0) };
}
