// Skróty SHA-1 renderów (wszystkie efekty, post FX, Lights, niedomyślne parametry; 2 obrazy × 2 skale): wzorzec „bajt w bajt”
// dla optymalizacji. Użycie: ENG=<katalog engine starej wersji> node scripts/hash-baseline.ts > przed.txt; node scripts/hash-baseline.ts > po.txt; diff przed.txt po.txt
// (bez ENG: bieżący katalog engine). Krok 6 briefu: 212 przypadków identycznych przed i po optymalizacji.
// Skróty SHA-1 renderów wszystkich efektów, post FX, Color i Lights na dwóch obrazach i 2 skalach: wzorzec "bajt w bajt" dla optymalizacji.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const { render, EFFECTS, POSTFX, canvasGlyphs } = await import((process.env.ENG ?? new URL('..', import.meta.url).pathname.replace(/\/$/, '')) + '/src/index.ts');
const { testImage } = await import((process.env.ENG ?? new URL('..', import.meta.url).pathname.replace(/\/$/, '')) + '/scripts/make-test-image.ts');
const { createCanvas } = createRequire(new URL('../package.json', import.meta.url))('@napi-rs/canvas');
const G = canvasGlyphs((w: number, h: number) => createCanvas(w, h), '"DejaVu Sans Mono"');
const out: string[] = [];
for (const [w, h] of [[300, 200], [457, 311]]) {
  const src = testImage(w, h);
  for (const scale of [1, 1.7]) {
    const H = (st: any) => createHash('sha1').update(render(src, st, { glyphs: G, scale }).img.data).digest('hex').slice(0, 12);
    for (const e of EFFECTS) out.push(`${w}x${h}@${scale} ${e.id} ${H({ style: { id: e.id } })}`);
    for (const e of ['characters', 'dots', 'cross', 'hexmosaic']) out.push(`${w}x${h}@${scale} ${e}+bg-original+cov60 ${H({ style: { id: e, params: e === 'hexmosaic' ? {} : { bgMode: 'original', coverage: 60, bgOpacity: 70 } } })}`);
    for (const cs of ['braille', 'katakana', 'math', 'blocks']) out.push(`${w}x${h}@${scale} characters/${cs} ${H({ style: { id: 'characters', params: { charSet: cs } } })}`);
    for (const f of POSTFX) out.push(`${w}x${h}@${scale} pixel+${f.id} ${H({ style: { id: 'pixel' }, postFx: { [f.id]: true } })}`);
    const extra: [string, any][] = [['cross', { rotation: 30, strokeThickness: 40 }], ['cross', { rotation: 67 }], ['diamond', { fill: 'outline', rotation: 20 }], ['diamond', { rotation: 45 }],
      ['dots', { dotShape: 'square', minDot: 20 }], ['dots', { dotShape: 'diamond', maxDot: 70 }], ['diagonal', { angle: 30, thickness: 90 }], ['diagonal', { angle: 135 }], ['lines', { orientation: 'vertical' }],
      ['hexmosaic', { orientation: 'flat', grout: 3 }], ['halftone', { shape: 'line', angle: 15, colorMode: 'image' }], ['halftone', { shape: 'square', invert: true }], ['lego', { palette: 'original', studHeight: 100 }]];
    for (const [id, params] of extra) out.push(`${w}x${h}@${scale} ${id}${JSON.stringify(params)} ${H({ style: { id, params } })}`);
    out.push(`${w}x${h}@${scale} dots+lights ${H({ style: { id: 'dots' }, lights: { lights: [{ x: 0.3, y: 0.4, radius: 40, intensity: 90, color: '#ff8a3d' }], ambient: 50 } })}`);
  }
}
console.log(out.join('\n'));
