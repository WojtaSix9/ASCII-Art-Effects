// Kształty znaków dla stylu „logo” strony /logo (etap 2, krok 8). Metoda z github.com/bas3line/ascii, site/src/lib/glyphs.ts
// @ 8fd792e (MIT, Copyright (c) 2026 bas3line; LICENSES/ascii.rest-MIT.txt): każdy znak z EDGE i FILL rysowany krojem IBM Plex Mono
// w komórce CW × CH px, linia bazowa na 0,79 wysokości, tusz mierzony w blokach GX × GY i przeskalowany tak, że najciemniejszy blok
// ze wszystkich = 1. Różnica: kontur z opentype.js rasteryzuje @napi-rs/canvas (Path2D), a nie sharp, więc liczby mogą różnić się
// od oryginału w dalszych miejscach po przecinku. Uruchomienie: node scripts/gen-logo-glyphs.ts → src/logo/glyphs.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createCanvas, Path2D } from '@napi-rs/canvas';
import opentype from 'opentype.js';
import { CH, CW, EDGE, FILL, GX, GY } from '../src/logo/logo.ts';

const req = createRequire(import.meta.url);
const file = readFileSync(req.resolve('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff'));
const font = opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const chars = [...new Set([...EDGE, FILL])];
const base = 0.79 * CH; const size = (1000 * CW) / 600;
const c = createCanvas(chars.length * CW, CH); const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#fff';
chars.forEach((ch, i) => g.fill(new Path2D(font.charToGlyph(ch).getPath(i * CW, base, size).toPathData(2))));
const data = g.getImageData(0, 0, c.width, c.height).data;
const glyphs = chars.map((ch, i) => {
  const v: number[] = [];
  for (let by = 0; by < GY; by++) for (let bx = 0; bx < GX; bx++) {
    let sum = 0, n = 0;
    for (let y = (by * CH) / GY; y < ((by + 1) * CH) / GY; y++) for (let x = (bx * CW) / GX; x < ((bx + 1) * CW) / GX; x++) { sum += data[(y * c.width + i * CW + x) * 4] / 255; n++; }
    v.push(sum / n);
  }
  return { ch, v };
});
const top = Math.max(...glyphs.flatMap((x) => x.v));
const out = glyphs.map((x) => ({ ch: x.ch, v: x.v.map((y) => +(y / top).toFixed(5)) }));
writeFileSync(new URL('../src/logo/glyphs.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(`${out.length} znaków`);
