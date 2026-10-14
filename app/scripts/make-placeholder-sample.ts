// Tymczasowe "zdjęcie robocze" (05, sekcja 4): syntetyczny obraz testowy silnika zapisany jako JPG 1600×1067.
// Spełnia wymagania z 05 (gradient, drobny detal, nasycone kolory, skrajne jasności, ostre krawędzie), ale NIE jest zdjęciem:
// do podmiany na własne lub CC0 (ten sam plik public/sample/photo.jpg). Wymaga engine/node_modules (@napi-rs/canvas).
// Uruchomienie (z app/): node scripts/make-placeholder-sample.ts
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { testImage } from '../../engine/scripts/make-test-image.ts';

const { createCanvas, ImageData } = createRequire(new URL('../../engine/package.json', import.meta.url))('@napi-rs/canvas');
const img = testImage(1600, 1067);
const c = createCanvas(img.w, img.h); c.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
const jpg: Buffer = c.toBuffer('image/jpeg', 85);
writeFileSync(new URL('../public/sample/photo.jpg', import.meta.url), jpg);
console.log(`public/sample/photo.jpg ${img.w}×${img.h}, ${(jpg.length / 1024).toFixed(0)} KB`);
