// Czcionki warstwy tekstu dla testów w Node (@napi-rs/canvas). Podzbiory latin i latin-ext rejestrowane pod osobnymi nazwami
// i podawane jako lista: Skia w @napi-rs/canvas nie łączy plików jednej rodziny po unicode-range (sprawdzone: ż ł ą jako puste prostokąty).
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { canvasText, TEXT_FONTS } from '../src/index.ts';

const DIR = new URL('../node_modules/@fontsource/', import.meta.url).pathname;
const FILES: Record<string, string> = { 'geist-mono': 'geist-mono', geist: 'geist', playfair: 'playfair-display', bebas: 'bebas-neue' };
const stacks: Record<string, string> = {};
for (const f of TEXT_FONTS) {
  const names: string[] = [];
  for (const sub of ['latin', 'latin-ext']) for (const w of f.weights) {
    const name = `T-${f.id}-${sub}`; GlobalFonts.registerFromPath(`${DIR}${FILES[f.id]}/files/${FILES[f.id]}-${sub}-${w}-normal.woff2`, name);
    if (!names.includes(name)) names.push(name);
  }
  stacks[f.id] = names.map((n) => `"${n}"`).join(', ');
}
export const TEXT = canvasText((w, h) => createCanvas(w, h) as any, stacks);
