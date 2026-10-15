// Oczekiwane skróty renderów z Node dla strony /dev/engine: przeglądarka ma dać te same bajty dla efektów,
// które nie rysują znaków czcionką (wszystkie poza Characters, Mixed i Specimen, który zależy od czcionki i rasteryzera).
// Uruchomienie: node scripts/gen-dev-fixtures.ts  →  src/dev/fixtures/engine-hashes.json
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { render, EFFECTS, POSTFX } from '../../engine/src/index.ts';
import { testImage } from '../../engine/scripts/make-test-image.ts';
import { HASH_CASES } from '../src/dev/hash-cases.ts';

const src = testImage(300, 200);
const out: Record<string, string> = {};
for (const c of HASH_CASES(EFFECTS.map((e) => e.id), POSTFX)) {
  out[c.name] = createHash('sha1').update(render(src, c.state).img.data).digest('hex');
}
writeFileSync(new URL('../src/dev/fixtures/engine-hashes.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`${Object.keys(out).length} skrótów`);
