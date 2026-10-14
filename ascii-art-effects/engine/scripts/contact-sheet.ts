// Arkusz kontaktowy: kazdy efekt (domyslne parametry) na obrazie testowym -> out/sheet.png. Uruchomienie: node scripts/contact-sheet.ts [id ...]
import { createCanvas, ImageData } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { render, EFFECTS, canvasGlyphs } from '../src/index.ts';
import { testImage } from './make-test-image.ts';
import { resize } from '../src/core/util.ts';
export const GLYPHS = canvasGlyphs((w: number, h: number) => createCanvas(w, h), '"DejaVu Sans Mono"');
export function toPng(img: { w: number; h: number; data: Uint8ClampedArray }): Buffer { const c = createCanvas(img.w, img.h); c.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h) as any, 0, 0); return c.toBuffer('image/png'); }
export function sheet(items: { label: string; img: { w: number; h: number; data: Uint8ClampedArray } }[], cols: number, tw: number, th: number): Buffer {
  const rows = Math.ceil(items.length / cols); const c = createCanvas(cols * tw, rows * (th + 22)); const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height); g.font = '14px "DejaVu Sans Mono"'; g.fillStyle = '#ddd';
  items.forEach((it, i) => { const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + 22); const t = resize(it.img as any, tw - 4, th - 2); const cc = createCanvas(t.w, t.h); cc.getContext('2d').putImageData(new ImageData(t.data, t.w, t.h) as any, 0, 0); g.drawImage(cc as any, x + 2, y + 20); g.fillText(it.label, x + 4, y + 14); });
  return c.toBuffer('image/png');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2); const src = testImage(900, 600); const list = [{ label: 'source', img: src }];
  for (const e of EFFECTS) if (!ids.length || ids.includes(e.id)) list.push({ label: e.id, img: render(src, { style: { id: e.id } }, { glyphs: GLYPHS }).img });
  writeFileSync('out/sheet.png', sheet(list, 4, 450, 300)); console.log('out/sheet.png', list.length);
}
