import { createCanvas, loadImage } from '@napi-rs/canvas'; import { writeFileSync } from 'node:fs'; import { render } from '../src/index.ts';
const im = await loadImage('../app/public/sample/photo-' + process.argv[3] + '.jpg'); const W = 600, H = Math.round(im.height * W / im.width);
const c = createCanvas(W, H); const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); const src = { w: W, h: H, data: new Uint8ClampedArray(x.getImageData(0, 0, W, H).data) };
const cases: any[] = JSON.parse(process.argv[4]); const out = createCanvas(W * 2, H * Math.ceil(cases.length / 2)); const o = out.getContext('2d');
cases.forEach(([id, p], i) => { const t0 = performance.now(); const r = render(src, { style: { id, params: p } }).img; console.log(id, (performance.now() - t0).toFixed(0), 'ms'); const d = o.createImageData(W, H); d.data.set(r.data); o.putImageData(d, (i % 2) * W, Math.floor(i / 2) * H); });
writeFileSync(process.argv[2], out.toBuffer('image/png'));
