// Etap 2, krok 4: moduł GIF (src/engine/gif.ts) w Node: rozkład opóźnień i struktura pliku odczytana parserem bloków GIF.
// Uruchomienie: node scripts/gif-check.ts
import { gifDelays, paletteFrames, flattenOnBlack, encodeGif, orderedDither } from '../src/engine/gif.ts';
import * as gifenc from 'gifenc';
const G = ((gifenc as any).GIFEncoder ? gifenc : (gifenc as any).default) as typeof gifenc;
import { render } from '../../engine/src/index.ts';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testImage } from '../../engine/scripts/make-test-image.ts';

const res: [string, boolean, string?][] = []; const t = (n: string, ok: boolean, info?: unknown) => res.push([n, ok, info === undefined ? undefined : JSON.stringify(info)]);

/** Parser bloków GIF89a (bez dekompresji LZW): ekran, paleta globalna, pętla NETSCAPE, opóźnienia GCE, ramki obrazu. */
function parseGif(b: Uint8Array) {
  const u16 = (o: number) => b[o] | (b[o + 1] << 8); let o = 6; const out = { sig: String.fromCharCode(...b.slice(0, 6)), w: u16(6), h: u16(8), gct: 0, loop: -1, delays: [] as number[], images: 0, localTables: 0, trailer: false };
  const f = b[10]; o = 13; if (f & 0x80) { out.gct = 1 << ((f & 7) + 1); o += 3 * out.gct; }
  const skipSub = () => { while (b[o]) o += b[o] + 1; o++; };
  while (o < b.length) {
    const c = b[o++];
    if (c === 0x3b) { out.trailer = o === b.length; break; }
    if (c === 0x21) { const l = b[o++];
      if (l === 0xf9) { out.delays.push(u16(o + 2)); o += b[o] + 1; skipSub(); }
      else if (l === 0xff) { const app = String.fromCharCode(...b.slice(o + 1, o + 12)); o += b[o] + 1; if (app === 'NETSCAPE2.0') out.loop = u16(o + 2); skipSub(); }
      else { o += 0; skipSub(); } continue; }
    if (c === 0x2c) { out.images++; const pf = b[o + 8]; o += 9; if (pf & 0x80) { out.localTables++; o += 3 * (1 << ((pf & 7) + 1)); } o++; skipSub(); continue; }
    throw new Error(`nieznany blok 0x${c.toString(16)} na ${o - 1}`);
  }
  return out;
}

// 1. rozkład opóźnień
const bad: string[] = [];
for (const fps of [12, 24, 25, 30]) for (let s2 = 2; s2 <= 20; s2++) { const s = s2 / 2; const n = Math.round(s * fps); const d = gifDelays(fps, n); const sum = d.reduce((a, b) => a + b, 0);
  if (sum !== Math.round((n * 100) / fps) || Math.max(...d.map((x) => Math.abs(x - 100 / fps))) > 1 || Math.min(...d) < 2) bad.push(`${fps}fps ${s}s sum ${sum}`); }
t('opóźnienia GIF: dla 12/24/25/30 fps i pętli 1–10 s suma = round(n·100/fps) (długość pętli dokładna), każde opóźnienie różni się od 100/fps najwyżej o 1 cs i ≥ 2 cs', bad.length === 0, bad.slice(0, 5));
t('opóźnienia GIF: 24 fps × 4 s = 96 klatek, 400 cs; wzór 4,4,5 (4,17 cs średnio)', gifDelays(24, 96).reduce((a, b) => a + b, 0) === 400 && gifDelays(24, 3).join() === '4,4,5', gifDelays(24, 6));
t('paleta: klatki próbki równo w pętli, bez powtórzeń (96 → 8 klatek, 3 → 3)', paletteFrames(96).join() === '0,12,24,36,48,60,72,84' && paletteFrames(3).join() === '0,1,2');
const fa = flattenOnBlack(new Uint8ClampedArray([200, 100, 50, 128, 10, 20, 30, 255, 99, 99, 99, 0]));
t('spłaszczenie alfy na czarnym: kolor × alfa, alfa 255; piksel nieprzezroczysty bez zmian', [...fa].join() === `${[200, 100, 50].map((v) => Math.round((v * 128) / 255)).join()},255,10,20,30,255,0,0,0,255`, [...fa]);

// 2. plik GIF z prawdziwych klatek silnika (RGB Split, ruch pulse)
const W = 120, H = 80, N = 24, FPS = 12; const src = testImage(W, H); let calls = 0;
const frame = (i: number) => { calls++; return new Uint8ClampedArray(render(src, { style: { id: 'rgbsplit' }, motion: { id: 'pulse' } }, { phase: i / N }).img.data); };
const prog: number[] = []; const bytes = await encodeGif(frame, N, W, H, FPS, (d) => prog.push(d)); const g = parseGif(bytes);
t(`plik GIF: GIF89a ${W}×${H}, paleta globalna 256, pętla w nieskończoność (NETSCAPE 0), ${N} ramek bez palet lokalnych, opóźnienia = gifDelays, poprawne zakończenie`,
  g.sig === 'GIF89a' && g.w === W && g.h === H && g.gct === 256 && g.loop === 0 && g.images === N && g.localTables === 0 && g.delays.join() === gifDelays(FPS, N).join() && g.trailer, { ...g, delays: g.delays.slice(0, 6) });
t(`koszt: ${N} klatek + ${paletteFrames(N).length} do palety = ${calls} renderów; postęp rośnie do końca`, calls === N + paletteFrames(N).length && prog[prog.length - 1] === calls && prog.every((v, i) => v === i + 1), { calls, size: bytes.length });
let cancelErr = ''; try { await encodeGif(frame, N, W, H, FPS, () => {}, () => true); } catch (e) { cancelErr = (e as Error).message; }
t('przerwanie: cancelled() → błąd CANCELLED przed końcem', cancelErr === 'CANCELLED', cancelErr);

// 3. dithering uporządkowany (Bayer 8×8)
const zero = () => new Uint8ClampedArray(8 * 8 * 4).fill(128); const a1 = orderedDither(zero(), 8, 8), a2 = orderedDither(zero(), 8, 8);
const offs = Array.from({ length: 64 }, (_, i) => a1[i * 4] - 128); const mean = offs.reduce((s, v) => s + v, 0) / 64;
t('dithering: wzór zależy tylko od pozycji (dwie klatki identyczne); 64 progi Bayera po zaokrągleniu przy amplitudzie 24 dają ≥ 24 różnych przesunięć; średnia ≈ 0, zakres ±12', a1.join() === a2.join() && new Set(offs).size >= 24 && Math.abs(mean) < 1 && Math.max(...offs.map(Math.abs)) <= 12, { mean, uniq: new Set(offs).size, max: Math.max(...offs) });
/* gradient 256×32 (szary), paleta 8 poziomów szarości: bez ditheringu pasma, z ditheringiem średnia w blokach 8×8 bliżej gradientu */
const GW = 256, GH = 32; const grad = () => { const d = new Uint8ClampedArray(GW * GH * 4); for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const i = (y * GW + x) * 4; d[i] = d[i + 1] = d[i + 2] = x; d[i + 3] = 255; } return d; };
const pal = Array.from({ length: 8 }, (_, k) => [k * 36, k * 36, k * 36]);
const blockErr = (dith: boolean) => { const src = grad(); const d = grad(); if (dith) orderedDither(d, GW, GH); const idx = G.applyPalette(d, pal); let e = 0, n = 0;
  for (let by = 0; by < GH; by += 8) for (let bx = 0; bx < GW; bx += 8) { let q = 0, s = 0; for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) { q += pal[idx[y * GW + x]][0]; s += src[(y * GW + x) * 4]; } e += Math.abs(q - s) / 64; n++; } return +(e / n).toFixed(2); };
const e0 = blockErr(false), e1 = blockErr(true);
t('dithering zmniejsza pasma: na gradiencie przy palecie 8 szarości błąd średniej w blokach 8×8 mniejszy niż bez ditheringu', e1 < e0, { bez: e0, z: e1 });
const plain = await encodeGif(frame, 6, W, H, FPS), dith = await encodeGif(frame, 6, W, H, FPS, () => {}, () => false, true); const gp = parseGif(plain), gd = parseGif(dith);
t('GIF z ditheringiem: ta sama struktura (6 ramek, paleta globalna, pętla); rozmiar zapisany do raportu', gd.images === 6 && gd.gct === 256 && gd.loop === 0 && gd.localTables === 0, { bez: plain.length, z: dith.length });

// 4. zapis różnicowy: po złożeniu klatek (dekoder GIF ffmpeg, z disposal i przezroczystością) obraz identyczny z pełnymi klatkami
//    tej samej palety; rozmiary obu do raportu. Przypadki: ruch na całym obrazie (RGB Split pulse) i ruch lokalny (CRT refresh).
const dir = mkdtempSync(join(tmpdir(), 'gifdelta-'));
const decode = (b: Uint8Array, name: string) => { const f = join(dir, name); writeFileSync(f, b); return execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 }); };
for (const [label, st] of [['RGB Split pulse', { style: { id: 'rgbsplit' }, motion: { id: 'pulse' } }], ['CRT refresh', { style: { id: 'crt' }, motion: { id: 'refresh' } }]] as const) {
  const fr = (i: number) => new Uint8ClampedArray(render(src, st as any, { phase: i / N }).img.data);
  const full = await encodeGif(fr, N, W, H, FPS, () => {}, () => false, false, false), del = await encodeGif(fr, N, W, H, FPS);
  const a = decode(full, 'full.gif'), b = decode(del, 'delta.gif'); const pd = parseGif(del);
  /* ile pikseli zmienia się między klatkami (po palecie): odczyt z pełnej wersji */
  const px = W * H * 3; let changed = 0; for (let k = 1; k < N; k++) for (let p = 0; p < W * H; p++) { const o = k * px + p * 3, q = (k - 1) * px + p * 3; if (a[o] !== a[q] || a[o + 1] !== a[q + 1] || a[o + 2] !== a[q + 2]) changed++; }
  t(`zapis różnicowy (${label}): ${N} klatek po złożeniu identyczne z pełnymi (ffmpeg), plik nie większy niż z pełnymi klatkami, struktura bez zmian (paleta globalna 256, ${N} ramek, pętla, opóźnienia)`,
    a.length === N * px && a.equals(b) && del.length <= full.length && pd.gct === 256 && pd.images === N && pd.loop === 0 && pd.localTables === 0 && pd.delays.join() === gifDelays(FPS, N).join(),
    { pełne: full.length, różnicowe: del.length, stosunek: +(del.length / full.length).toFixed(3), zmienionePiksele: +(changed / ((N - 1) * W * H)).toFixed(3) });
}

for (const [n, ok, info] of res) console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${info ? `  [${info}]` : ''}`);
console.log(`${res.filter((r) => r[1]).length}/${res.length} OK`); process.exit(res.every((r) => r[1]) ? 0 : 1);
