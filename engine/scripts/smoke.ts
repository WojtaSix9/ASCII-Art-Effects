import { createCanvas } from '@napi-rs/canvas';
import { render, EFFECTS, canvasGlyphs } from '/home/claude/proj/ascii-effects/src/index.ts';
import { testImage } from '/home/claude/proj/ascii-effects/scripts/make-test-image.ts';
const glyphs = canvasGlyphs((w: number, h: number) => createCanvas(w, h), '"DejaVu Sans Mono"');
const img = testImage(600, 400);
for (const e of EFFECTS) { const t = Date.now(); try { const r = render(img, { style: { id: e.id } }, { glyphs }); console.log(e.id.padEnd(12), r.img.w + 'x' + r.img.h, Date.now() - t + 'ms', JSON.stringify(r.info)); } catch (err: any) { console.log(e.id, 'ERROR', err.message); } }
