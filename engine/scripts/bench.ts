// Czas renderu na obrazie 1600x1067 (ok. 1,7 MP) i 1920x1080 dla efektow o domyslnych parametrach. Pomiar w piaskownicy: orientacyjny. Uruchomienie: node scripts/bench.ts
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { render, EFFECTS, POSTFX, canvasGlyphs } from '../src/index.ts';
import { testImage } from './make-test-image.ts';
const G = canvasGlyphs((w: number, h: number) => createCanvas(w, h), '"DejaVu Sans Mono"');
const src0 = testImage(1600, 1067); const rows: string[] = [`Obraz ${src0.w}x${src0.h}, mediana z 3 przebiegow (pierwszy przebieg wlicza rozgrzewke i cache masek znakow, odrzucony).`, 'Render "na zimno": kazdy pomiar na swiezej kopii zrodla (kopia poza pomiarem), wiec bez pamieci przeskalowanego zrodla i tla z kroku 6. W edytorze przy zmianie parametru stylu jest szybciej (app/reports).'];
let src = src0;
const fresh = () => { src = { w: src0.w, h: src0.h, data: new Uint8ClampedArray(src0.data) }; };
const med = (f: () => void) => { fresh(); f(); const t: number[] = []; for (let i = 0; i < 3; i++) { fresh(); const s = performance.now(); f(); t.push(performance.now() - s); } return t.sort((a, b) => a - b)[1]; };
for (const e of EFFECTS) rows.push(`${e.id.padEnd(12)} ${med(() => render(src, { style: { id: e.id } }, { glyphs: G })).toFixed(0).padStart(6)} ms`);
rows.push('--- post FX (na wyniku dots, parametry domyslne) ---');
for (const f of POSTFX) rows.push(`${f.id.padEnd(12)} ${med(() => render(src, { style: { id: 'pixel' }, postFx: { [f.id]: true } }, { glyphs: G })).toFixed(0).padStart(6)} ms (lacznie ze stylem pixel)`);
rows.push(`dither 15 alg.: ${med(() => { for (const a of ['bayer8', 'blueNoise', 'floyd']) render(src, { style: { id: 'dither', params: { algorithm: a, palette: 'pico8' } } }); }).toFixed(0)} ms (bayer8 + blueNoise + floyd lacznie)`);
console.log(rows.join('\n')); writeFileSync('reports/bench.txt', rows.join('\n') + '\n');
