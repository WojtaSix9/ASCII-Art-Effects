// Fragmenty w pelnej rozdzielczosci do oceny okiem: node scripts/crops.ts <plik-wyjsciowy> "id|{json params}" ...
import { writeFileSync } from 'node:fs';
import { render } from '../src/index.ts';
import { testImage } from './make-test-image.ts';
import { GLYPHS, sheet } from './contact-sheet.ts';
const out = process.argv[2]; const src = testImage(900, 600); const items = process.argv.slice(3).map((a) => { const [id, js] = a.split('|'); const params = js ? JSON.parse(js) : {}; const full = render(src, { style: { id, params } }, { glyphs: GLYPHS }).img;
  const cw = 440, ch = 300, x0 = 120, y0 = 60; const d = new Uint8ClampedArray(cw * ch * 4); for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) for (let c = 0; c < 4; c++) d[(y * cw + x) * 4 + c] = full.data[((y + y0) * full.w + x + x0) * 4 + c];
  return { label: a.slice(0, 54), img: { w: cw, h: ch, data: d } }; });
writeFileSync(out, sheet(items, 2, 444, 304));
