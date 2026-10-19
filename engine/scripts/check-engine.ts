// Testy silnika efektow v1. Uruchomienie: node scripts/check-engine.ts  (wynik: reports/engine-check.txt)
import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { render, renderText, EFFECTS, POSTFX, COLOR_PARAMS, canvasGlyphs, getEffect, PALETTES } from '../src/index.ts';
import type { Img } from '../src/index.ts';
import { testImage } from './make-test-image.ts';
import { blur, resize, lum, parseColor, hash01, mulberry32, clamp, lerp } from '../src/core/util.ts';
import { blueNoise64, ALGORITHMS } from '../src/effects/dither.ts';
import { applyColor } from '../src/post/color.ts';
import { newImg, cloneImg } from '../src/core/types.ts';
import { resolveParams } from '../src/core/params.ts';
import { voronoi } from '../src/core/screen.ts';

const G = canvasGlyphs((w: number, h: number) => createCanvas(w, h), '"DejaVu Sans Mono"');
const res: [string, boolean, string][] = []; const ok = (n: string, c: boolean, d = '') => res.push([n, c, d]);
const sha = (i: Img) => createHash('sha1').update(i.data).digest('hex').slice(0, 10);
const uniform = (w: number, h: number, v: number): Img => newImg(w, h, [v, v, v, 255]);
const gradient = (w: number, h: number): Img => { const i = newImg(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = (x / (w - 1)) * 255, o = (y * w + x) * 4; i.data[o] = i.data[o + 1] = i.data[o + 2] = v; } return i; };
const meanLum = (i: Img) => { let s = 0; for (let p = 0; p < i.data.length; p += 4) s += lum(i.data[p], i.data[p + 1], i.data[p + 2]); return s / (i.data.length / 4); };
const psnr = (a: Img, b: Img) => { let se = 0, n = 0; for (let i = 0; i < a.data.length; i += 4) for (let c = 0; c < 3; c++) { const d = a.data[i + c] - b.data[i + c]; se += d * d; n++; } return se === 0 ? 99 : 10 * Math.log10(65025 / (se / n)); };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
const colorsOf = (i: Img) => { const s = new Set<number>(); for (let p = 0; p < i.data.length; p += 4) s.add(i.data[p] << 16 | i.data[p + 1] << 8 | i.data[p + 2]); return s.size; };
const uniq = (i: Img) => { const s = new Set<number>(); for (let p = 0; p < i.data.length; p += 4) s.add(i.data[p] << 16 | i.data[p + 1] << 8 | i.data[p + 2]); return s; };
const R = (src: Img, id: string, params: Record<string, any> = {}, extra: any = {}) => render(src, { style: { id, params }, ...extra }, { glyphs: G });
const SRC = testImage(300, 200);

// 1. rejestr i definicje parametrow
{
  const ids = EFFECTS.map((e) => e.id); let bad: string[] = [];
  for (const e of EFFECTS) for (const p of e.params) { if (p.kind === 'range' && !(p.default >= p.min! && p.default <= p.max! && p.min! < p.max!)) bad.push(`${e.id}.${p.id} range`); if (p.kind === 'select' && !p.options!.some((o) => o.value === p.default)) bad.push(`${e.id}.${p.id} select`); }
  ok(`rejestr: ${EFFECTS.length} efektow, unikalne id, domyslne parametry w zakresach`, new Set(ids).size === ids.length && bad.length === 0 && EFFECTS.length === 91, bad.join(', '));   // 18 Fazy 1 + 30 Fazy 2 + 43 Fazy 3 (krok 9)
  ok('rejestr: nazwy efektow zgodne z katalogiem (18 efektow Fazy 1 z pliku 02)', ['characters', 'block-chars', 'braille', 'dots', 'cross', 'diamond', 'lines', 'diagonal', 'pixel', 'mosaic', 'lego', 'hexmosaic', 'disco', 'halftone', 'posterize', 'duotone', 'gradientmap', 'dither'].every((x) => ids.includes(x)));
  ok('dither: 15 algorytmow i 15 palet', ALGORITHMS.length === 15 && Object.keys(PALETTES).length === 15);
}
// 2. kazdy efekt: wymiary, determinizm, alfa
{
  const rows: string[] = [];
  for (const e of EFFECTS) { const a = R(SRC, e.id), b = R(SRC, e.id); const alpha = (() => { for (let i = 3; i < a.img.data.length; i += 4) if (a.img.data[i] !== 255) return false; return true; })();
    ok(`${e.id}: wymiary zrodla, dwa renderowania identyczne, alfa 255`, a.img.w === 300 && a.img.h === 200 && sha(a.img) === sha(b.img) && alpha, sha(a.img)); }
}
// 3. walidacja parametrow
{
  const base = sha(R(SRC, 'dots', { cellSize: 80 }).img);
  ok('parametry: wartosc ponad zakres jest obcinana (cellSize 9999 = 80)', sha(R(SRC, 'dots', { cellSize: 9999 }).img) === base);
  ok('parametry: nieznany klucz, zla opcja select, NaN, zly kolor rzucaja blad', throws(() => R(SRC, 'dots', { nope: 1 })) && throws(() => R(SRC, 'dots', { dotShape: 'x' })) && throws(() => R(SRC, 'dots', { cellSize: NaN })) && throws(() => R(SRC, 'dots', { inkColor: 'red' })));
  ok('pipeline: nieznany efekt, skala poza 0,1..8, nieznany post FX rzucaja blad', throws(() => R(SRC, 'nie-ma')) && throws(() => render(SRC, { style: { id: 'dots' } }, { scale: 9 })) && throws(() => render(SRC, { style: { id: 'dots' }, postFx: { nope: true } })));
  ok('parametry: gradient wymaga >= 2 przystankow', throws(() => R(SRC, 'gradientmap', { preset: 'custom', stops: [{ pos: 0, color: '#000' }] })));
}
// 4. seed i coverage
{
  const W = uniform(200, 200, 255); const cfg = { cellSize: 10, colorMode: 'mono', inkColor: '#ffffff', bgMode: 'solid', bgColor: '#000000', minDot: 100, maxDot: 100 };
  const lit = (cov: number, seed: number) => { const o = R(W, 'dots', { ...cfg, coverage: cov, seed }).img; const s = new Set<number>(); for (let cy = 0; cy < 20; cy++) for (let cx = 0; cx < 20; cx++) if (o.data[((cy * 10 + 5) * 200 + cx * 10 + 5) * 4] > 128) s.add(cy * 20 + cx); return s; };
  const c100 = lit(100, 1), c80 = lit(80, 1), c50 = lit(50, 1), c0 = lit(0, 1), c50b = lit(50, 2);
  ok('coverage: 100% = 400 komorek, 0% = 0, malejaco', c100.size === 400 && c0.size === 0 && c80.size < c100.size && c50.size < c80.size, `100:${c100.size} 80:${c80.size} 50:${c50.size} 0:${c0.size}`);
  ok('coverage: deterministyczne wycinanie (komorki widoczne przy 50% to podzbior widocznych przy 80%)', [...c50].every((k) => c80.has(k)));
  ok('seed: ten sam seed = te same komorki, inny seed = inne', [...c50].join() === [...lit(50, 1)].join() && [...c50].join() !== [...c50b].join(), `${c50.size} vs ${c50b.size}`);
  ok('seed: dither whiteNoise zalezy od seeda, blueNoise nie', sha(R(SRC, 'dither', { algorithm: 'whiteNoise', seed: 1 }).img) !== sha(R(SRC, 'dither', { algorithm: 'whiteNoise', seed: 2 }).img) && sha(R(SRC, 'dither', { algorithm: 'blueNoise', seed: 1 }).img) === sha(R(SRC, 'dither', { algorithm: 'blueNoise', seed: 2 }).img));
}
// 5. skala eksportu: ta sama siatka, podobny wynik
{
  const S1 = testImage(240, 160); const lines: string[] = []; let allSame = true, minP = 99;
  for (const e of EFFECTS) { const a = render(S1, { style: { id: e.id } }, { glyphs: G, scale: 1 }), b = render(S1, { style: { id: e.id } }, { glyphs: G, scale: 2 }); const same = (a.info.cols === b.info.cols && a.info.rows === b.info.rows && a.info.cells === b.info.cells) && b.img.w === 480 && b.img.h === 320; if (!same) allSame = false;
    const p = psnr(resize(b.img, 240, 160), a.img); if (!['dither'].includes(e.id)) minP = Math.min(minP, p); lines.push(`${e.id}:${p.toFixed(0)}dB`); }
  ok(`skala 2x: wymiary x2 i identyczna liczba komorek (cols, rows, cells) dla wszystkich ${EFFECTS.length} efektow`, allSame);
  ok('skala 2x: obraz po zmniejszeniu podobny do renderu 1x (PSNR > 14 dB)', minP > 14, `min ${minP.toFixed(1)} dB; ${lines.join(' ')}`);
}
// 6. Characters i eksport tekstowy
{
  const ramp = '@#S08Xx+=-;:. '; const t = (v: number, p: any = {}) => renderText(uniform(60, 30, v), { style: { id: 'characters', params: { coverage: 100, ...p } } })!;
  const first = (s: string) => s[0];
  const idx = [0, 32, 64, 96, 128, 160, 192, 224, 255].map((v) => ramp.indexOf(first(t(v)))); const mono = idx.every((v, i) => i === 0 || v <= idx[i - 1]);
  ok('Characters: jasniejszy ton = gestszy znak (indeks w rampie nierosnacy), 0 -> spacja, 255 -> @', mono && first(t(0)) === ' ' && first(t(255)) === '@', idx.join(','));
  ok('Characters: invert odwraca mapowanie', first(t(0, { invert: true })) === '@' && first(t(255, { invert: true })) === ' ');
  const txt = renderText(SRC, { style: { id: 'characters' } })!; const info = R(SRC, 'characters').info; const ls = txt.trimEnd().split('\n');
  ok('Characters: tekst ma rows x cols z renderu, kazda linia cols znakow', ls.length === info.rows && ls.every((l) => l.length === info.cols), `${info.cols}x${info.rows}`);
  ok('Characters: wlasny ramp "ab" i preset binary', /^[ab]+$/.test(t(128, { charSet: 'custom', chars: 'ab' }).split('\n')[0]) && /^[10 ]+$/.test(t(128, { charSet: 'binary' }).split('\n')[0]));
  const all16 = Object.keys(getEffect('characters').params.find((p) => p.id === 'charSet')!.options!.map((o) => o.value)).length; ok('Characters: 16 presetow + custom', all16 === 17);
  // tekst zgodny z obrazem: komorka ze znakiem ma tusz, ze spacja nie
  const P = { colorMode: 'mono', inkColor: '#ffffff', bgMode: 'solid', bgColor: '#000000', cellSize: 10 }; const img = R(SRC, 'characters', P).img; const tx = renderText(SRC, { style: { id: 'characters', params: P } })!.trimEnd().split('\n'); let mism = 0, n = 0;
  for (let cy = 0; cy < tx.length; cy++) for (let cx = 0; cx < tx[cy].length; cx++) { let ink = 0; for (let y = cy * 10; y < Math.min(200, cy * 10 + 10); y++) for (let x = cx * 6; x < Math.min(300, cx * 6 + 6); x++) ink += img.data[(y * 300 + x) * 4] > 20 ? 1 : 0; n++; if ((tx[cy][cx] === ' ') !== (ink === 0)) mism++; }
  ok('Characters: tekst zgodny z obrazem (komorka pusta <=> spacja)', mism / n < 0.01, `${mism}/${n} niezgodnych`);
}
{
  const t = (id: string, v: number, p: any = {}) => renderText(uniform(60, 40, v), { style: { id, params: p } })!.split('\n')[0];
  ok('Block: czarny -> spacje, bialy -> pelne bloki (quarter), shaded: 5 poziomow rosnaco', /^ +$/.test(t('block-chars', 0)) && /^█+$/.test(t('block-chars', 255)) && ' ░▒▓█'.indexOf(t('block-chars', 128, { blockSet: 'shaded' })[0]) === 2);
  ok('Braille: czarny -> U+2800, bialy -> U+28FF (pelne), tekst w zakresie braille', /^⠀+$/.test(t('braille', 0)) && /^⣿+$/.test(t('braille', 255)) && [...renderText(SRC, { style: { id: 'braille' } })!.replace(/\n/g, '')].every((c) => c.charCodeAt(0) >= 0x2800 && c.charCodeAt(0) <= 0x28ff));
  ok('renderText: efekt bez wersji tekstowej zwraca null', renderText(SRC, { style: { id: 'dots' } }) === null);
}
// 7. Dither
{
  const g = gradient(256, 64); const rowsInfo: string[] = []; let worst = 0, worstId = ''; let allMono = true;
  for (const alg of ALGORITHMS) { const o = R(g, 'dither', { algorithm: alg, palette: 'mono' }).img; const u = uniq(o); if (!([...u].every((c) => c === 0 || c === 0xffffff))) allMono = false; const dev = Math.abs(meanLum(o) - meanLum(g)); rowsInfo.push(`${alg}:${dev.toFixed(3)}`); if (dev > worst) { worst = dev; worstId = alg; } }
  ok('dither mono: 15 algorytmow daje tylko czern i biel', allMono);
  ok('dither mono: sredni jasnosc zachowana (odchylenie < 0,05) na gradiencie, 15 algorytmow', worst < 0.05, `najgorszy ${worstId} ${worst.toFixed(3)}; ${rowsInfo.join(' ')}`);
  let sub = true; const bad: string[] = []; const small = testImage(96, 64);
  for (const pid of Object.keys(PALETTES)) { if (pid === 'original') continue; const pal = new Set(PALETTES[pid].colors!.map((c) => { const [r, gg, b] = parseColor(c); return r << 16 | gg << 8 | b; })); for (const alg of ALGORITHMS) { const u = uniq(R(small, 'dither', { algorithm: alg, palette: pid }).img); if (![...u].every((c) => pal.has(c))) { sub = false; bad.push(`${pid}/${alg}`); } } }
  ok('dither: 14 palet x 15 algorytmow (210 kombinacji): wynik uzywa wylacznie kolorow palety', sub, bad.slice(0, 5).join(' '));
  const orig = R(small, 'dither', { algorithm: 'floyd', palette: 'original', levels: 2 }).img; ok('dither: paleta original zachowuje odcienie (wiecej niz 2 kolory) i wymiary', uniq(orig).size > 2 && orig.w === 96);
  const fr = (v: number, alg: string) => { const o = R(uniform(64, 64, v), 'dither', { algorithm: alg, palette: 'mono' }).img; let w = 0; for (let i = 0; i < o.data.length; i += 4) if (o.data[i] > 128) w++; return w / (64 * 64); };
  const tones = [40, 100, 170, 230]; const tol: Record<string, number> = { bayer2: 0.13, atkinson: 0.13, linesH: 0.13, linesV: 0.13 }; const worstDev: string[] = []; let monoAll = true, devAll = true;
  for (const a of ALGORITHMS) { const f = tones.map((v) => fr(v, a)); const m = f.every((x, i) => i === 0 || x >= f[i - 1]); const d = Math.max(...f.map((x, i) => Math.abs(x - tones[i] / 255))); if (!m) monoAll = false; if (d >= (tol[a] ?? 0.1)) devAll = false; worstDev.push(`${a}:${d.toFixed(3)}`); }
  ok('dither: udzial bieli rosnie z tonem dla stalych szarosci (15 algorytmow)', monoAll);
  ok('dither: udzial bieli ~ ton/255 (+/- 0,1; 0,13 dla bayer2: 5 poziomow, atkinson: mniej rozpraszanego bledu, linesH/V: 8 faz wzoru), 15 algorytmow', devAll, worstDev.join(' '));
  ok('dither floyd: szarosc 50% daje ~50% bieli', Math.abs(fr(128, 'floyd') - 0.5) < 0.03, fr(128, 'floyd').toFixed(3));
  const b = blueNoise64(); const sorted = [...b].sort((x, y) => x - y); const perm = sorted.every((v, i) => Math.abs(v - (i + 0.5) / 4096) < 1e-6);
  const blockVar = (get: (x: number, y: number) => number) => { const c: number[] = []; for (let by = 0; by < 64; by += 8) for (let bx = 0; bx < 64; bx += 8) { let n = 0; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (get(bx + x, by + y) < 0.25) n++; c.push(n); } const m = c.reduce((a, v) => a + v, 0) / c.length; return c.reduce((a, v) => a + (v - m) ** 2, 0) / c.length; };
  const vb = blockVar((x, y) => b[y * 64 + x]), vw = blockVar((x, y) => hash01(x, y, 3));
  ok('szum niebieski: mapa 64x64 jest permutacja rang, wariancja gestosci w blokach 8x8 < 60% bialego szumu', perm && vb < 0.6 * vw, `perm=${perm} niebieski ${vb.toFixed(2)} bialy ${vw.toFixed(2)}`);
  const ps = R(small, 'dither', { algorithm: 'bayer4', pixelSize: 4 }).img; let blocksOk = true; for (let by = 0; by < 64; by += 4) for (let bx = 0; bx < 96; bx += 4) { const v = ps.data[(by * 96 + bx) * 4]; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ps.data[((by + y) * 96 + bx + x) * 4] !== v) blocksOk = false; }
  ok('dither pixelSize 4: wynik sklada sie z jednolitych blokow 4x4', blocksOk);
  ok('dither strength 0 = zrodlo, 100 != zrodlo', sha(R(small, 'dither', { strength: 0 }).img) === sha(small) && sha(R(small, 'dither', { strength: 100 }).img) !== sha(small));
}
// 8. efekty punktowe i kafelkowe
{
  const gp = (id: string, p: any, src = SRC) => R(src, id, p).img;
  const post = gp('posterize', { levels: 3 }); ok('Posterize 3 poziomy: kanaly tylko 0, 128, 255', [...post.data].every((v, i) => i % 4 === 3 || v === 0 || v === 128 || v === 255));
  const bw = newImg(20, 10, [0, 0, 0, 255]); for (let x = 10; x < 20; x++) for (let y = 0; y < 10; y++) { const o = (y * 20 + x) * 4; bw.data[o] = bw.data[o + 1] = bw.data[o + 2] = 255; }
  const du = gp('duotone', { shadowColor: '#102030', highlightColor: '#f0e0d0', contrast: 0 }, bw); ok('Duotone: czern -> kolor cieni, biel -> kolor swiatel (dokladnie)', du.data[0] === 0x10 && du.data[1] === 0x20 && du.data[2] === 0x30 && du.data[10 * 4] === 0xf0 && du.data[10 * 4 + 1] === 0xe0 && du.data[10 * 4 + 2] === 0xd0);
  const gm = gp('gradientmap', { preset: 'mono' }, gradient(256, 4)); let dev = 0; for (let x = 0; x < 256; x++) dev = Math.max(dev, Math.abs(gm.data[x * 4] - x)); ok('Gradient Map preset mono = mapa tozsamosciowa na gradiencie (+/-1)', dev <= 1, `max ${dev}`);
  const gc = gp('gradientmap', { preset: 'custom', stops: [{ pos: 0, color: '#ff0000' }, { pos: 1, color: '#0000ff' }] }, bw); ok('Gradient Map custom czerwony->niebieski: czern = czerwony, biel = niebieski', gm && gc.data[0] === 255 && gc.data[2] === 0 && gc.data[10 * 4] === 0 && gc.data[10 * 4 + 2] === 255);
  const px = gp('pixel', { blockSize: 12, levels: 32, coverage: 100 }); let uni = true; for (let by = 0; by < 192; by += 12) for (let bx = 0; bx < 288; bx += 12) { const v = px.data[(by * 300 + bx) * 4]; for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (px.data[((by + y) * 300 + bx + x) * 4] !== v) uni = false; }
  ok('Pixel Art: blok 12x12 = jeden kolor', uni);
  const mo = gp('mosaic', { tileSize: 10, grout: 0, tileJitter: 0 }); let uni2 = true; for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (mo.data[(y * 300 + x) * 4] !== mo.data[0]) uni2 = false; ok('Mosaic: kafel bez spoiny = jeden kolor; spoina rysuje kolor spoiny', uni2 && gp('mosaic', { tileSize: 10, grout: 2, groutColor: '#ff0000' }).data[0] === 255);
  const hx = R(SRC, 'hexmosaic', { size: 10 }); const expect = (300 * 200) / (2.598 * 100); ok('Hex Mosaic: liczba komorek ~ pole / (2,598 R^2) (+/- 20%)', Math.abs((hx.info.cells as number) / expect - 1) < 0.2, `${hx.info.cells} vs ${expect.toFixed(0)}`);
  const chroma = (i: Img) => { let s = 0; for (let p = 0; p < i.data.length; p += 4) s += Math.max(i.data[p], i.data[p + 1], i.data[p + 2]) - Math.min(i.data[p], i.data[p + 1], i.data[p + 2]); return s; };
  ok('Disco: wieksza saturacja = wieksze nasycenie kolorow', chroma(gp('disco', { saturation: 400 })) > chroma(gp('disco', { saturation: 100 })));
  ok('Halftone: ciemniejszy obszar = wiecej tuszu (czarny > szary > bialy)', (() => { const ink = (v: number) => { const o = gp('halftone', { colorMode: 'mono', inkColor: '#000000', paperColor: '#ffffff' }, uniform(120, 120, v)); return 1 - meanLum(o); }; const a = ink(30), b = ink(128), c = ink(240); return a > b && b > c; })());
  ok('Halftone: ksztalty dot, line, square roznia sie i zachowuja wymiary', new Set(['dot', 'line', 'square'].map((s) => sha(gp('halftone', { shape: s })))).size === 3);
  const lt = (p: any) => meanLum(gp('lego', { coverage: 100, palette: 'original', ...p }, uniform(64, 64, 128))); ok('LEGO: studHeight 100 rozni sie od 0', Math.abs(lt({ studHeight: 100 }) - lt({ studHeight: 0 })) > 0.001);
}
// 9. tlo (backdrop)
{
  const base = { coverage: 0, cellSize: 10 }; const bgc = (m: string, extra: any = {}) => R(SRC, 'dots', { ...base, bgMode: m, ...extra }).img;
  ok('backdrop solid + coverage 0: caly obraz = kolor tla', uniq(bgc('solid', { bgColor: '#102030' })).size === 1 && bgc('solid', { bgColor: '#102030' }).data[0] === 0x10);
  ok('backdrop original (100%): = zrodlo; none: alfa 0 wszedzie', sha(bgc('original', { bgOpacity: 100 })) === sha(SRC) && [...bgc('none').data].filter((v, i) => i % 4 === 3).every((v) => v === 0));
  { const q = psnr(bgc('blur', { bgBlur: 8, bgOpacity: 100 }), blur(SRC, 8)); ok('backdrop blur: szybkie rozmycie bliskie pelnemu (PSNR > 35 dB; prog dobrany po pomiarze 36,5 dB), opacity 0 = kolor tla', q > 35 && uniq(bgc('blur', { bgOpacity: 0 })).size === 1, q.toFixed(1) + ' dB'); }
}
// 10. post FX
{
  const base = testImage(160, 100); const rp = (id: string, p: any, scale = 1) => { const src = { w: base.w, h: base.h, data: new Uint8ClampedArray(base.data) }; return POSTFX.find((f) => f.id === id)!.apply(src, resolveParams(POSTFX.find((f) => f.id === id)!.params, p), scale, 1); };
  const neutral: Record<string, any> = { advBlur: { amount: 0 }, vignette: { intensity: 0 }, scanLines: { intensity: 0 }, bloom: { intensity: 0 }, crtCurve: { intensity: 0 }, glitch: { intensity: 0 }, filmGrain: { intensity: 0 }, filmDust: { density: 0 }, sharpen: { amount: 0 }, noise: { amount: 0 } };
  ok('post FX: wartosci neutralne zostawiaja obraz bez zmian', Object.entries(neutral).every(([id, p]) => sha(rp(id, p)) === sha(base)), Object.entries(neutral).filter(([id, p]) => sha(rp(id, p)) !== sha(base)).map(([id]) => id).join(','));
  const FRAME = POSTFX.filter((f) => !f.glyphOnly);   // charBloom/charChroma nie sa przebiegiem po klatce: sekcja 17
  ok(`post FX: ${POSTFX.length} efektow (${FRAME.length} po klatce), kazdy po klatce zmienia obraz przy parametrach domyslnych i zachowuje wymiary`, POSTFX.length === 16 && FRAME.length === 14 && FRAME.every((f) => { const o = rp(f.id, {}); return o.w === 160 && o.h === 100 && sha(o) !== sha(base); }), FRAME.filter((f) => sha(rp(f.id, {})) === sha(base)).map((f) => f.id).join(','));
  ok('post FX: powtarzalnosc i zaleznosc od seeda (glitch, filmGrain, filmDust, noise)', ['glitch', 'filmGrain', 'filmDust', 'noise'].every((id) => sha(rp(id, { seed: 1 })) === sha(rp(id, { seed: 1 })) && sha(rp(id, { seed: 1 })) !== sha(rp(id, { seed: 2 }))));
  const pz = rp('pixelate', { size: 8 }, 2); let u = true; for (let by = 0; by < 96; by += 16) for (let bx = 0; bx < 144; bx += 16) { const v = pz.data[(by * 160 + bx) * 4]; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (pz.data[((by + y) * 160 + bx + x) * 4] !== v) u = false; }
  ok('post FX: wartosci w px skaluja sie ze skala (pixelate 8 px przy 2x = bloki 16 px)', u);
  const a = render(SRC, { style: { id: 'dots' }, postFx: { vignette: true, noise: true, scanLines: true } }, { glyphs: G }), b = render(SRC, { style: { id: 'dots' }, postFx: { scanLines: true, noise: true, vignette: true } }, { glyphs: G });
  ok('post FX: kolejnosc stala, niezalezna od kolejnosci wlaczania', sha(a.img) === sha(b.img));
  const vg = rp('vignette', { intensity: 100, size: 20, feather: 40 }); ok('vignette: rogi ciemniejsze niz srodek', lum(vg.data[0], vg.data[1], vg.data[2]) < lum(vg.data[(50 * 160 + 80) * 4], vg.data[(50 * 160 + 80) * 4 + 1], vg.data[(50 * 160 + 80) * 4 + 2]));
  ok('chromatic i RGB split przesuwaja kanaly R i B, zostawiaja G', ['chromatic', 'rgbSplit'].every((id) => { const o = rp(id, { offset: 6 }); let g = 0, r = 0; for (let i = 0; i < o.data.length; i += 4) { g += o.data[i + 1] !== base.data[i + 1] ? 1 : 0; r += o.data[i] !== base.data[i] ? 1 : 0; } return g === 0 && r > 0; }));
}
// 11. Color
{
  const s = testImage(100, 60); const a = (p: any) => applyColor({ w: s.w, h: s.h, data: new Uint8ClampedArray(s.data) }, resolveParams(COLOR_PARAMS, p));
  const nid = { w: 4, h: 4, data: new Uint8ClampedArray(64) }; ok('Color: ustawienia neutralne zwracaja ten sam obiekt (bez kopiowania)', applyColor(nid, resolveParams(COLOR_PARAMS, {})) === nid);
  const bw = a({ preset: 'bw' }); ok('Color B&W: r = g = b', [...bw.data].every((v, i) => i % 4 > 2 || (i % 4 === 0 ? v === bw.data[i + 1] && v === bw.data[i + 2] : true)));
  const sat0 = a({ saturation: 0 }); ok('Color saturation 0: szarosc rowna luminancji (+/-1)', (() => { let d = 0; for (let i = 0; i < s.data.length; i += 4) d = Math.max(d, Math.abs(sat0.data[i] - lum(s.data[i], s.data[i + 1], s.data[i + 2]) * 255)); return d <= 1.5; })());
  const inv2 = applyColor(applyColor({ w: s.w, h: s.h, data: new Uint8ClampedArray(s.data) }, resolveParams(COLOR_PARAMS, { invertImage: true })), resolveParams(COLOR_PARAMS, { invertImage: true })); ok('Color: dwukrotne odwrocenie = oryginal', sha(inv2) === sha(s));
  const h2 = applyColor(a({ hue: 180 }), resolveParams(COLOR_PARAMS, { hue: 180 })); ok('Color hue 180 dwa razy ~ oryginal (PSNR > 35 dB; macierz przyblizona)', psnr(h2, s) > 35, psnr(h2, s).toFixed(1) + ' dB');
  ok('Color: 8 presetow zmienia obraz, wartosci w zakresie 0..255', ['bw', 'sepia', 'warm', 'cool', 'vintage', 'fade', 'cyber'].every((p) => sha(a({ preset: p })) !== sha(s)));
  ok('Color tint: opacity 100 + multiply czerni czerwony kanal gdy tint = #00ffff', (() => { const t = a({ tint: '#00ffff', tintOpacity: 100, blend: 'multiply' }); return [...t.data].every((v, i) => i % 4 !== 0 || v === 0); })());
}
// 12. rejestr efektow (effects.json) zgodny z silnikiem
{
  const { readFileSync } = await import('node:fs'); const J = JSON.parse(readFileSync('src/data/effects.json', 'utf8')) as any[]; const ready = J.filter((x) => x.status === 'ready');
  ok('effects.json: 91 efektow, 10 kategorii, unikalne id, faza 1 = 18', J.length === 91 && new Set(J.map((x) => x.id)).size === 91 && new Set(J.map((x) => x.category)).size === 10 && J.filter((x) => x.phase === 1).length === 18);
  ok('effects.json: status ready <=> efekt jest w silniku, kategoria zgodna z definicja silnika', ready.length === EFFECTS.length && EFFECTS.every((e) => { const j = J.find((x) => x.id === e.id); return j && j.status === 'ready' && j.category === e.category && j.engine === e.engine; }), EFFECTS.filter((e) => { const j = J.find((x) => x.id === e.id); return !(j && j.category === e.category && j.engine === e.engine); }).map((e) => e.id).join(','));
  ok(`effects.json: faza kazdego z ${EFFECTS.length} efektow silnika zgodna z rejestrem; cala Faza 1 (18) gotowa`, EFFECTS.every((e) => J.find((x) => x.id === e.id)?.phase === e.phase) && J.filter((x) => x.phase === 1).every((x) => x.status === 'ready'));
}
// 13. Znaki rysowane kodem (Braille, Dots, Geometric): bez czcionki, zgodne z rampą gęstości
{
  const { drawnGlyphMask, isDrawnGlyph, CHARSETS: CS } = await import('../src/index.ts');
  const { brailleDot } = await import('../src/core/glyphs-drawn.ts');
  const SIZES: [number, number][] = [[6, 10], [12, 20], [24, 40]];   // komorka Characters przy cellSize 10 i skali 1, 2, 4
  // a) Braille: kropka widoczna w srodku dokladnie dla ustawionych bitow, dla wszystkich 256 znakow
  let bad: string[] = [];
  for (const [w, h] of SIZES) for (let bits = 0; bits < 256; bits++) {
    const m = drawnGlyphMask(String.fromCodePoint(0x2800 + bits), w, h)!; const { xs, ys } = brailleDot(w, h);
    const order: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]];
    order.forEach(([c, r], i) => { const v = m[Math.floor(ys[r]) * w + Math.floor(xs[c])]; if ((v >= 128) !== !!(bits & (1 << i))) bad.push(`${w}x${h}:${bits}.${i}`); });
  }
  ok('Braille rysowany: 256 znakow x 3 rozmiary, kropka widoczna <=> bit ustawiony', bad.length === 0, bad.slice(0, 5).join(','));
  // b) pole tuszu nierosnace wzdluz rampy (rampy sa uporzadkowane wg gestosci, plik 01 sekcja 4)
  const ink = (ch: string, w: number, h: number) => drawnGlyphMask(ch, w, h)!.reduce((a, v) => a + v, 0);
  const mono: string[] = [];
  // Braille: wlasnosc to liczba kropek (rowne liczby kropek roznia sie polem tylko przez probkowanie siatki).
  const dots = (c: string) => { let n = c.codePointAt(0)! - 0x2800, k = 0; while (n) { k += n & 1; n >>= 1; } return k; };
  const br = [...CS.braille.ramp].filter(isDrawnGlyph).map(dots);
  for (let i = 1; i < br.length; i++) if (br[i] > br[i - 1]) mono.push(`braille: liczba kropek rosnie na pozycji ${i}`);
  for (const id of ['dots', 'geometric']) for (const [w, h] of SIZES.slice(1)) {
    const drawn = [...CS[id].ramp].filter(isDrawnGlyph); const a = drawn.map((c) => ink(c, w, h));
    // Bez tolerancji: pary lustrzane (▲▼, △▽) maja w pomiarze identyczne pole (0,00%, ponizej), wiec rownosc jest dopuszczalna, wzrost nie.
    for (let i = 1; i < a.length; i++) if (a[i] > a[i - 1]) mono.push(`${id} ${w}x${h}: ${drawn[i - 1]}=${a[i - 1]} < ${drawn[i]}=${a[i]}`);
  }
  ok('Znaki rysowane: gestosc nierosnaca wzdluz rampy (braille: liczba kropek; dots, geometric: pole tuszu przy 12x20 i 24x40)', mono.length === 0, mono.join('; '));
  const pairs = [['▲', '▼'], ['△', '▽']].map(([x, y]) => Math.abs(ink(x, 24, 40) - ink(y, 24, 40)) / ink(x, 24, 40));
  ok('Pary lustrzane ▲▼ i △▽: identyczne pole tuszu', pairs.every((d) => d === 0), pairs.map((d) => (d * 100).toFixed(2) + '%').join(', '));
  // c) zbior znakow rysowanych: dokladnie Braille + brakujace w Geist Mono znaki Dots i Geometric
  const expect = '●◕◑◔○∙◆◼▲▼◇△▽';
  ok('isDrawnGlyph: Braille U+2800-28FF i ●◕◑◔○∙◆◼▲▼◇△▽; nie A, ·, █, Σ, ﾊ', [...expect].every(isDrawnGlyph) && isDrawnGlyph('⠀') && isDrawnGlyph('⣿') && !['A', '·', '.', '█', 'Σ', 'ﾊ', '@'].some(isDrawnGlyph));
  // d) Characters z presetem braille nie dotyka czcionki: kanwa, ktora rzuca wyjatkiem, nie jest wolana
  const noFont = canvasGlyphs(() => { throw new Error('font canvas used'); }, 'x');
  ok('Characters + preset braille: render bez czcionki (dostawca kanwy rzuca wyjatkiem, nie jest wolany)', !throws(() => render(SRC, { style: { id: 'characters', params: { charSet: 'braille' } } }, { glyphs: noFont })));
}
// 14. Lights (plik 07): oswietlenie zrodla przed stylem
{
  const { applyLights } = await import('../src/index.ts');
  const G0 = uniform(200, 100, 100);   // szary obraz: latwo mierzyc jasnosc
  const L1 = (o: Record<string, any> = {}) => ({ x: 0.5, y: 0.5, radius: 20, intensity: 80, color: '#ffffff', ...o });
  const lumAt = (i: Img, x: number, y: number) => lum(i.data[(y * i.w + x) * 4], i.data[(y * i.w + x) * 4 + 1], i.data[(y * i.w + x) * 4 + 2]);
  const R0 = R(SRC, 'characters');
  ok('Lights: brak swiatel / pusta lista / intensity 0 -> obraz bajt w bajt bez zmian',
    sha(render(SRC, { style: { id: 'characters' }, lights: { lights: [] } }, { glyphs: G }).img) === sha(R0.img)
    && sha(render(SRC, { style: { id: 'characters' }, lights: { lights: [L1({ intensity: 0 })] } }, { glyphs: G }).img) === sha(R0.img));
  const lit = applyLights(G0, { lights: [L1()] });
  ok('Lights: srodek rozjasniony, rog bez zmian (poza zasiegiem), jasnosc nie maleje nigdzie',
    lumAt(lit, 100, 50) > lumAt(G0, 100, 50) + 0.2 && lumAt(lit, 2, 2) === lumAt(G0, 2, 2) && [...lit.data].every((v, i) => i % 4 === 3 || v >= G0.data[i]));
  const changed = (i: Img) => { let n = 0; for (let p = 0; p < i.data.length; p += 4) if (i.data[p] !== G0.data[p]) n++; return n; };
  const c10 = changed(applyLights(G0, { lights: [L1({ radius: 10 })] })), c20 = changed(lit), c40 = changed(applyLights(G0, { lights: [L1({ radius: 40 })] }));
  ok('Lights: wiekszy radius rozjasnia wiekszy obszar (10 < 20 < 40)', c10 < c20 && c20 < c40, `${c10} ${c20} ${c40}`);
  const red = applyLights(G0, { lights: [L1({ color: '#ff0000' })] }); const o = (50 * 200 + 100) * 4;
  ok('Lights: czerwone swiatlo podnosi kanal R, nie zmienia G i B (screen nie przyciemnia)', red.data[o] > 200 && red.data[o + 1] === 100 && red.data[o + 2] === 100, [...red.data.slice(o, o + 3)].join(','));
  const dim = applyLights(G0, { lights: [L1()], ambient: 50 });
  ok('Lights: Ambient 50 przyciemnia obszar poza swiatlem o polowe, Ambient 100 go nie zmienia', dim.data[(2 * 200 + 2) * 4] === 50 && lit.data[(2 * 200 + 2) * 4] === 100, String(dim.data[(2 * 200 + 2) * 4]));
  ok('Lights: Ambient 0 bez swiatel = czarny obraz', applyLights(G0, { lights: [], ambient: 0 }).data.every((v, i) => i % 4 === 3 || v === 0));
  ok('Lights: wiecej niz 4 swiatla i zly kolor -> blad', throws(() => applyLights(G0, { lights: [L1(), L1(), L1(), L1(), L1()] })) && throws(() => applyLights(G0, { lights: [L1({ color: 'zly' })] })));
  // Struktura: w Characters swiatlo daje gestsze znaki (eksport tekstowy: wiecej znakow z poczatku rampy w oswietlonym obszarze)
  const ramp = '@#S08Xx+=-;:. '; const dens = (t: string) => { const rows = t.split('\n').filter(Boolean); const mid = rows.slice(rows.length / 3, (2 * rows.length) / 3).map((r) => r.slice(r.length / 3, (2 * r.length) / 3)).join(''); return [...mid].reduce((a, c) => a + (ramp.length - 1 - Math.max(0, ramp.indexOf(c))), 0) / mid.length; };
  const t0 = dens(renderText(SRC, { style: { id: 'characters' } })!), t1 = dens(renderText(SRC, { style: { id: 'characters' }, lights: { lights: [L1({ radius: 30 })] } })!);
  ok('Lights: struktura - Characters w oswietlonym srodku ma gestsze znaki (eksport tekstowy)', t1 > t0 + 1, `${t0.toFixed(2)} -> ${t1.toFixed(2)}`);
  ok('Lights: Dither ignoruje swiatla (jak w oryginale)', sha(R(SRC, 'dither').img) === sha(render(SRC, { style: { id: 'dither' }, lights: { lights: [L1()] } }).img));
  // Niezaleznosc od skali: pole swiatla przy skali 2 po zmniejszeniu ~ pole przy skali 1
  const g1 = applyLights(uniform(300, 200, 90), { lights: [L1({ x: 0.3 }), L1({ x: 0.7, color: '#4080ff', radius: 35 })], ambient: 60 });
  const g2 = resize(applyLights(uniform(600, 400, 90), { lights: [L1({ x: 0.3 }), L1({ x: 0.7, color: '#4080ff', radius: 35 })], ambient: 60 }), 300, 200);
  const ps = psnr(g1, g2);
  ok('Lights: niezaleznosc od skali - skala 2 po zmniejszeniu vs skala 1, PSNR >= 40 dB', ps >= 40, ps.toFixed(1) + ' dB');
}
// 15. Krok 6: pamiec podreczna zrodla i tla nie zmienia wyniku (sekwencja na tym samym zrodle = rendery "na zimno")
{
  const seq: [any, number][] = [
    [{ style: { id: 'dots' } }, 1], [{ style: { id: 'dots', params: { bgBlur: 20 } } }, 1], [{ style: { id: 'dots', params: { bgBlur: 20, bgOpacity: 70 } } }, 1],
    [{ style: { id: 'dots', params: { bgMode: 'original' } } }, 1], [{ style: { id: 'dots' } }, 1.5], [{ style: { id: 'cross' } }, 1.5],
    [{ style: { id: 'dots' }, lights: { lights: [{ x: 0.5, y: 0.5, radius: 30, intensity: 80, color: '#ffffff' }] } }, 1.5],
    [{ style: { id: 'dots' } }, 1.5], [{ style: { id: 'pixel' }, postFx: { vignette: true }, color: { preset: 'sepia' } }, 1], [{ style: { id: 'pixel' } }, 1],
    [{ style: { id: 'lego', params: { bgColor: '#ff0000', bgMode: 'solid' } } }, 1], [{ style: { id: 'characters', params: { bgOpacity: 10 } } }, 1],
  ];
  const warm = seq.map(([st, sc]) => sha(render(SRC, st, { glyphs: G, scale: sc }).img));
  const cold = seq.map(([st, sc]) => sha(render(cloneImg(SRC), st, { glyphs: G, scale: sc }).img));
  const bad = seq.map((_, i) => i).filter((i) => warm[i] !== cold[i]);
  ok('Krok 6: pamiec zrodla i tla - 12 renderow na tym samym zrodle (zmiany tla, skali, swiatel, post FX) = rendery na swiezej kopii', bad.length === 0, bad.join(','));
  const before = new Uint8ClampedArray(SRC.data); render(SRC, { style: { id: 'posterize', params: { levels: 32 } }, postFx: { noise: true }, color: { preset: 'bw' } }); render(SRC, { style: { id: 'pixel' }, postFx: { filmDust: true } });
  ok('Krok 6: render nie zmienia obrazu zrodlowego (post FX i Color dzialaja na kopii)', before.every((v, i) => v === SRC.data[i]));
}
// 16. Krok 7: Photo Filter, Gradient Map w Color, Levels, Curves
{
  const { curveLut, levelsLut } = await import('../src/post/grade.ts');
  const ramp = gradient(256, 4); const col = (c: Record<string, any>) => applyColor(cloneImg(ramp), resolveParams(COLOR_PARAMS, c));
  const colour = testImage(160, 100); const colC = (c: Record<string, any>) => applyColor(cloneImg(colour), resolveParams(COLOR_PARAMS, c));
  ok('Color: nowe parametry domyslne = bez zmian (bajt w bajt)', sha(col({})) === sha(ramp) && sha(colC({ photoDensity: 0, photoFilter: 'warm' })) === sha(colour) && sha(colC({ gradientMap: 'heat', gradientAmount: 0 })) === sha(colour));
  // Photo Filter
  const meanCh = (i: Img, c: number) => { let s = 0; for (let p = c; p < i.data.length; p += 4) s += i.data[p]; return s / (i.data.length / 4); };
  const warm = colC({ photoFilter: 'warm', photoDensity: 60, photoPreserve: false }), cool = colC({ photoFilter: 'cool', photoDensity: 60, photoPreserve: false });
  ok('Photo Filter: Warming podnosi R/B, Cooling obniza R/B', meanCh(warm, 0) / meanCh(warm, 2) > meanCh(colour, 0) / meanCh(colour, 2) && meanCh(cool, 0) / meanCh(cool, 2) < meanCh(colour, 0) / meanCh(colour, 2));
  const kept = colC({ photoFilter: 'blue', photoDensity: 50, photoPreserve: true }); let worst = 0;
  for (let p = 0; p < kept.data.length; p += 4) { const a = lum(colour.data[p], colour.data[p + 1], colour.data[p + 2]), b = lum(kept.data[p], kept.data[p + 1], kept.data[p + 2]); worst = Math.max(worst, Math.abs(a - b)); }
  // Prog: zaokraglenie kazdego kanalu do 8 bit to najwyzej 0,5/255; wagi luminancji sumuja sie do 1, wiec |dY| <= 0,00196 -> 0,003.
  ok('Photo Filter: „Preserve luminosity” zachowuje jasnosc kazdego piksela (|dY| <= 0,003 = zaokraglenie 8 bit), takze dla Blue', worst <= 0.003, worst.toFixed(4));
  // Gradient Map w Color
  const gm = col({ gradientMap: 'mono', gradientAmount: 100 }); const { GRADIENT_PRESETS, gradientLut } = await import('../src/effects/pixel.ts'); const lutM = gradientLut(GRADIENT_PRESETS.mono);
  ok('Color/Gradient Map: ramp szarosci 0..255 -> dokladnie kolory gradientu (amount 100)', [0, 64, 128, 200, 255].every((v) => { const o = v * 4; const j = Math.round(lum(ramp.data[o], ramp.data[o + 1], ramp.data[o + 2]) * 255) * 3; return gm.data[o] === lutM[j] && gm.data[o + 1] === lutM[j + 1] && gm.data[o + 2] === lutM[j + 2]; }));
  // Levels
  const at = (i: Img, x: number, c = 0) => i.data[x * 4 + c];
  const L1 = col({ levelsInBlack: 50, levelsInWhite: 200 });
  ok('Levels: wejscie 50..200 -> 50 i mniej = 0, 200 i wiecej = 255, srodek liniowo', at(L1, 30) === 0 && at(L1, 50) === 0 && at(L1, 200) === 255 && at(L1, 240) === 255 && Math.abs(at(L1, 125) - 128) <= 1, `${at(L1, 125)}`);
  const L2 = col({ levelsOutBlack: 40, levelsOutWhite: 220 });
  ok('Levels: wyjscie 40..220 -> 0 = 40, 255 = 220', at(L2, 0) === 40 && at(L2, 255) === 220);
  const L3 = col({ levelsGamma: 2 }), L4 = col({ levelsGamma: 0.5 });
  ok('Levels: gamma 2 rozjasnia srodek, 0,5 przyciemnia, konce bez zmian', at(L3, 128) > 160 && at(L4, 128) < 90 && at(L3, 0) === 0 && at(L3, 255) === 255, `${at(L3, 128)} ${at(L4, 128)}`);
  const L5 = col({ levelsChannel: 'r', levelsInWhite: 128 });
  ok('Levels: kanal R zmienia tylko R', at(L5, 100, 0) > 190 && at(L5, 100, 1) === 100 && at(L5, 100, 2) === 100);
  ok('Levels: monotoniczne dla 200 losowych ustawien', (() => { const rnd = mulberry32(5); for (let k = 0; k < 200; k++) { const ib = Math.floor(rnd() * 200), iw = ib + 1 + Math.floor(rnd() * (254 - ib)); const lut = levelsLut({ channel: 'rgb', inBlack: ib, inWhite: iw, gamma: 0.1 + rnd() * 9, outBlack: Math.floor(rnd() * 100), outWhite: 155 + Math.floor(rnd() * 100) }); for (let v = 1; v < 256; v++) if (lut[v] < lut[v - 1]) return false; } return true; })());
  // Curves
  const pts: [number, number][] = [[0, 0], [0.25, 0.6], [0.5, 0.62], [1, 1]]; const cl = curveLut(pts);
  const passes = pts.every(([x, y]) => Math.abs(cl[Math.round(x * 255)] - y * 255) <= 1);
  let overshoot = 0; for (let i = 0; i < pts.length - 1; i++) { const lo = Math.round(pts[i][1] * 255), hi = Math.round(pts[i + 1][1] * 255); for (let v = Math.ceil(pts[i][0] * 255); v <= Math.floor(pts[i + 1][0] * 255); v++) overshoot = Math.max(overshoot, Math.min(lo, hi) - cl[v], cl[v] - Math.max(lo, hi)); }
  let mono = true; for (let v = 1; v < 256; v++) if (cl[v] < cl[v - 1]) mono = false;
  ok('Curves: krzywa przechodzi przez punkty, monotoniczna, bez przestrzelenia miedzy punktami (Fritsch-Carlson)', passes && mono && overshoot <= 1, `overshoot ${overshoot}`);
  const C1 = col({ curves: { rgb: [[0, 0], [1, 1]], r: [[0, 1], [1, 0]], g: [[0, 0], [1, 1]], b: [[0, 0], [1, 1]] } });
  ok('Curves: krzywa kanalu R (odwrocona) zmienia tylko R', at(C1, 0, 0) === 255 && at(C1, 255, 0) === 0 && at(C1, 77, 1) === 77 && at(C1, 77, 2) === 77);
  const C2 = col({ levelsInWhite: 128, curves: { rgb: [[0, 0], [0.5, 0.25], [1, 1]], r: [[0, 0], [1, 1]], g: [[0, 0], [1, 1]], b: [[0, 0], [1, 1]] } });
  const exp2 = curveLut([[0, 0], [0.5, 0.25], [1, 1]])[levelsLut({ channel: 'rgb', inBlack: 0, inWhite: 128, gamma: 1, outBlack: 0, outWhite: 255 })[64]];
  ok('Kolejnosc: Levels, potem Curves (plik 01, sekcja 8.9)', at(C2, 64) === exp2, `${at(C2, 64)} vs ${exp2}`);
  ok('Curves: zle punkty -> blad (x nierosnace, poza 0..1, 1 punkt, 17 punktow)', [[[0.5, 0], [0.4, 1]], [[0, 0], [1, 1.2]], [[0, 0]], Array.from({ length: 17 }, (_, i) => [i / 16, i / 16])].every((bad) => throws(() => resolveParams(COLOR_PARAMS, { curves: { rgb: bad } }))));
}
// 17. Krok 7.2: Character Bloom, Character Chromatic (per glif) i Halftone jako post FX
{
  const { GLYPH_STYLES } = await import('../src/index.ts');
  const ST = (id: string, params: any = {}, postFx: any = {}, scale = 1, src = SRC) => render(src, { style: { id, params }, postFx }, { glyphs: G, scale }).img;
  const BOTH = { charBloom: { intensity: 80 }, charChroma: { offset: 4 } };
  ok('glyph FX: wylaczone (false) i Bloom 0 = bajt w bajt jak bez nich (Characters, Block, Braille)', [...GLYPH_STYLES].every((id) => { const b = sha(ST(id)); return sha(ST(id, {}, { charBloom: false, charChroma: false })) === b && sha(ST(id, {}, { charBloom: { intensity: 0 } })) === b; }));
  ok('glyph FX: w stylach bez glifow nic nie zmieniaja (wszystkie pozostale efekty)', EFFECTS.filter((e) => !GLYPH_STYLES.has(e.id)).every((e) => sha(ST(e.id)) === sha(ST(e.id, {}, BOTH))), EFFECTS.filter((e) => !GLYPH_STYLES.has(e.id) && sha(ST(e.id)) !== sha(ST(e.id, {}, BOTH))).map((e) => e.id).join(','));
  ok('glyph FX: kazdy styl glifowy reaguje na Bloom i na Chroma osobno', [...GLYPH_STYLES].every((id) => { const b = sha(ST(id)); return sha(ST(id, {}, { charBloom: true })) !== b && sha(ST(id, {}, { charChroma: true })) !== b; }));
  ok('glyph FX: bez znakow (coverage 0) tlo zostaje bajt w bajt - efekty dotycza tylko glifow', ['blur', 'solid', 'original'].every((bg) => sha(ST('characters', { coverage: 0, bgMode: bg })) === sha(ST('characters', { coverage: 0, bgMode: bg }, BOTH))));
  // Chroma: biały tusz na czarnym tle -> R(x) = G(x - dx), B(x) = G(x + dx), dx = round(offset * skala)
  const chromaShift = (scale: number) => { const o = ST('characters', { colorMode: 'mono', inkColor: '#ffffff', bgMode: 'solid', bgColor: '#000000' }, { charChroma: { offset: 3 } }, scale); const dx = Math.round(3 * scale); let bad = 0, n = 0;
    for (let y = 0; y < o.h; y++) for (let x = dx; x < o.w - dx; x++) { const i = (y * o.w + x) * 4; if (Math.abs(o.data[i] - o.data[i - dx * 4 + 1]) > 1 || Math.abs(o.data[i + 2] - o.data[i + dx * 4 + 1]) > 1) bad++; if (o.data[i + 1]) n++; } return { bad, n }; };
  const c1 = chromaShift(1), c2 = chromaShift(2);
  ok('Character Chromatic: R przesuniete o +offset, B o -offset wzgledem G (dokladnie, +-1), przy skali 1 i 2 (offset w px rosnie ze skala)', c1.bad === 0 && c2.bad === 0 && c1.n > 1000, `zle ${c1.bad}/${c2.bad}, piksele tuszu ${c1.n}`);
  // Bloom: tylko rozjasnia (screen), rosnie z intensywnoscia, zasieg rosnie z komorka (skala)
  const mono = { colorMode: 'mono', inkColor: '#ffffff', bgMode: 'solid', bgColor: '#000000' };
  const b0 = ST('characters', mono), b50 = ST('characters', mono, { charBloom: { intensity: 50 } }), b100 = ST('characters', mono, { charBloom: { intensity: 100 } });
  let darker = 0; for (let i = 0; i < b0.data.length; i += 4) for (let c = 0; c < 3; c++) if (b50.data[i + c] < b0.data[i + c] || b100.data[i + c] < b50.data[i + c]) darker++;
  ok('Character Bloom: zaden piksel nie ciemnieje; srednia jasnosc 0 < 50 < 100', darker === 0 && meanLum(b0) < meanLum(b50) && meanLum(b50) < meanLum(b100), `${meanLum(b0).toFixed(3)} ${meanLum(b50).toFixed(3)} ${meanLum(b100).toFixed(3)}`);
  const glowFrac = (scale: number) => { const S = testImage(240, 160); const sp = { ...mono, coverage: 8, cellSize: 14 }; const a = ST('characters', sp, {}, scale, S), b = ST('characters', sp, { charBloom: { intensity: 60 } }, scale, S); let n = 0; for (let i = 0; i < a.data.length; i += 4) if (lum(b.data[i], b.data[i + 1], b.data[i + 2]) - lum(a.data[i], a.data[i + 1], a.data[i + 2]) > 4 / 255) n++; return n / (a.data.length / 4); };
  const f1 = glowFrac(1), f2 = glowFrac(2);
  ok('Character Bloom: udzial pikseli objetych poswiata podobny przy skali 1 i 2 (rzadkie znaki, coverage 8; roznica < 20%; promien liczony od komorki)', Math.abs(f2 - f1) < 0.2 * f1, `${(f1 * 100).toFixed(1)}% vs ${(f2 * 100).toFixed(1)}%`);
  // Halftone (post FX): pole ksztaltu = ton, wiec srednia jasnosc zachowana; mono = wiecej tuszu w ciemnych; px skaluja sie
  const HT = (img: Img, p: any, scale = 1) => POSTFX.find((f) => f.id === 'halftone')!.apply(cloneImg(img), resolveParams(POSTFX.find((f) => f.id === 'halftone')!.params, p), scale, 1);
  let worst = 0; const wl: string[] = [];
  for (const shape of ['dots', 'squares', 'lines']) for (const colour of ['source', 'mono']) for (const v of [25, 64, 128, 190, 230]) { const o = HT(uniform(120, 120, v), { size: 6, shape, colour }); const e = Math.abs(meanLum(o) - lum(v, v, v)); if (e > worst) { worst = e; wl.push(`${shape}/${colour}/${v}:${e.toFixed(3)}`); } }
  ok('Halftone: na jednolitej szarosci srednia jasnosc zachowana (|blad| <= 0,03) dla 3 ksztaltow, 2 trybow, 5 tonow', worst <= 0.03, `max ${worst.toFixed(3)} ${wl.slice(-1)}`);
  const ramp = (v: number) => meanLum(HT(uniform(60, 60, v), { colour: 'mono' }));
  ok('Halftone: ton monotoniczny (0..255 co 15, kazdy ksztalt)', ['dots', 'squares', 'lines'].every((shape) => { let prev = -1; for (let v = 0; v <= 255; v += 15) { const m = meanLum(HT(uniform(60, 60, v), { shape, colour: 'mono' })); if (m < prev - 1e-6) return false; prev = m; } return true; }) && ramp(0) < 0.02 && ramp(255) > 0.98);
  const red = HT(newImg(60, 60, [200, 40, 40, 255]), {}); let hueOk = true; for (let i = 0; i < red.data.length; i += 4) if (red.data[i] > 20 && (Math.abs(red.data[i + 1] / red.data[i] - 0.2) > 0.02 || red.data[i + 1] !== red.data[i + 2])) hueOk = false;
  ok('Halftone colour source: odcien komorki zachowany (G/R = 0,2 +-0,02, G = B)', hueOk);
  const ht1 = HT(testImage(240, 160), { size: 6 }), ht2 = resize(HT(testImage(480, 320), { size: 6 }, 2), 240, 160);
  ok('Halftone: rozmiar w px skaluje sie (skala 2 po zmniejszeniu ~ skala 1, PSNR > 20 dB)', psnr(ht1, ht2) > 20, psnr(ht1, ht2).toFixed(1) + ' dB');
}
// 18. Krok 7.3: kadr (crop) stosowany przed wszystkim innym
{
  const { cropRect } = await import('../src/index.ts');
  const B = testImage(300, 200); const st = (id: string, extra: any = {}) => ({ style: { id }, ...extra });
  const cut = (img: Img, c: { x: number; y: number; w: number; h: number }) => { const r = cropRect(img.w, img.h, c); const o = newImg(r.sw, r.sh); for (let y = 0; y < r.sh; y++) for (let x = 0; x < r.sw; x++) for (let k = 0; k < 4; k++) o.data[(y * r.sw + x) * 4 + k] = img.data[((r.sy + y) * img.w + r.sx + x) * 4 + k]; return o; };
  const C = { x: 0.13, y: 0.21, w: 0.55, h: 0.6 };
  const styles = ['characters', 'braille', 'dots', 'pixel', 'halftone', 'lego', 'dither'];
  ok('kadr: brak kadru i kadr 0,0,1,1 = bajt w bajt to samo', styles.every((id) => { const a = sha(render(B, st(id), { glyphs: G }).img); return sha(render(B, st(id, { crop: { x: 0, y: 0, w: 1, h: 1 } }), { glyphs: G }).img) === a; }));
  const same = (scale: number, extra: any = {}) => styles.filter((id) => sha(render(B, st(id, { ...extra, crop: C }), { glyphs: G, scale }).img) !== sha(render(cut(B, C), st(id, extra), { glyphs: G, scale }).img));
  const bad1 = same(1), bad2 = same(2);
  ok('kadr: render z kadrem = render wycietego zrodla, bajt w bajt (7 stylow, skala 1 i 2)', bad1.length === 0 && bad2.length === 0, [...bad1, ...bad2].join(','));
  const lit = { lights: { lights: [{ x: 0.3, y: 0.4, radius: 40, intensity: 90, color: '#ffcc88' }], ambient: 60 }, postFx: { vignette: true, charBloom: true }, color: { preset: 'sepia' } };
  const bad3 = same(1, lit);
  ok('kadr: swiatla (pozycje wzgledem kadru), post FX i Color dzialaja na wycietym obrazie', bad3.length === 0, bad3.join(','));
  const r = render(B, st('pixel', { crop: C }), { scale: 2 }).img; const cr = cropRect(300, 200, C);
  ok('kadr: wymiary wyniku = kadr w px x skala', r.w === Math.round(cr.sw * 2) && r.h === Math.round(cr.sh * 2) && cr.sw === 165 && cr.sh === 120, `${r.w}x${r.h} z ${cr.sw}x${cr.sh}`);
  ok('kadr: wartosci spoza 0..1, zerowa szerokosc, NaN -> blad', [{ x: -0.1, y: 0, w: 0.5, h: 0.5 }, { x: 0.6, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0, w: 0, h: 0.5 }, { x: 0, y: 0, w: NaN, h: 1 }].every((c) => throws(() => render(B, st('pixel', { crop: c })))));
  const tiny = render(B, st('characters', { crop: { x: 0.5, y: 0.5, w: 0.001, h: 0.001 } }), { glyphs: G }).img;
  ok('kadr: bardzo maly kadr daje co najmniej 1x1 px i nie rzuca bledu', tiny.w >= 1 && tiny.h >= 1);
  // pamiec podreczna: sekwencja kadrow na tym samym zrodle = rendery "na zimno"
  const seq = [C, undefined, { x: 0.5, y: 0, w: 0.5, h: 1 }, C].map((c) => sha(render(B, st('dots', { crop: c })).img));
  const cold = [C, undefined, { x: 0.5, y: 0, w: 0.5, h: 1 }, C].map((c) => sha(render(cloneImg(B), st('dots', { crop: c })).img));
  ok('kadr: zmiana kadru na tym samym zrodle nie korzysta z nieaktualnej pamieci podrecznej', seq.join() === cold.join() && seq[0] !== seq[1]);
  const txt = renderText(B, st('characters', { crop: C }), { glyphs: G })!, txtCut = renderText(cut(B, C), st('characters'), { glyphs: G })!;
  ok('kadr: eksport tekstowy tez uwzglednia kadr', txt === txtCut && txt !== renderText(B, st('characters'), { glyphs: G }));
}
// 19. Krok 7.4: warstwa tekstu (plik 08), rysowana na koncu, bez gradingu
{
  const { TEXT } = await import('./text-fonts.ts'); const { cropRect } = await import('../src/index.ts');
  const B = testImage(300, 200); const RT = (extra: any, scale = 1, src = B) => render(src, { style: { id: 'pixel' }, ...extra }, { text: TEXT, scale });
  const base = sha(RT({}).img);
  ok('tekst: brak napisow, pusty tekst, same spacje, krycie 0 = bajt w bajt bez warstwy', [{ text: [] }, { text: [{ text: '' }] }, { text: [{ text: '   \n ' }] }, { text: [{ text: 'X', opacity: 0 }] }].every((e) => sha(RT(e).img) === base));
  ok('tekst: napis zmienia obraz; bez dostawcy tekstu blad; 5 napisow blad', sha(RT({ text: [{}] }).img) !== base && throws(() => render(B, { style: { id: 'pixel' }, text: [{}] })) && throws(() => RT({ text: [{}, {}, {}, {}, {}] })));
  // grading i post FX nie dzialaja na napis: pelne krycie warstwy -> dokladnie kolor napisu
  const lay = TEXT(300, 200, [resolveParams((await import('../src/index.ts')).TEXT_PARAMS, { text: 'TEST ąę', size: 20, color: '#ffcc00', y: 50 })]).data;
  const gr = RT({ text: [{ text: 'TEST ąę', size: 20, color: '#ffcc00', y: 50 }], color: { preset: 'bw', hue: 180, invertImage: true, curves: { rgb: [[0, 1], [1, 0]], r: [[0, 0], [1, 1]], g: [[0, 0], [1, 1]], b: [[0, 0], [1, 1]] } }, postFx: { vignette: { intensity: 100 }, noise: true } }).img;
  let full = 0, bad = 0; for (let i = 0; i < lay.length; i += 4) if (lay[i + 3] === 255) { full++; if (gr.data[i] !== 255 || gr.data[i + 1] !== 204 || gr.data[i + 2] !== 0) bad++; }
  ok('tekst: Color (B&W, hue, invert, Curves) i post FX nie zmieniaja pikseli napisu (pelne krycie = dokladnie #ffcc00)', full > 300 && bad === 0, `${bad}/${full}`);
  // pozycja, wyrownanie, rozmiar (pokrycie warstwy, nie prostokat z metryk)
  const cov = (img: Img, ref: Img) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const i = (y * img.w + x) * 4; if (img.data[i] !== ref.data[i] || img.data[i + 1] !== ref.data[i + 1] || img.data[i + 2] !== ref.data[i + 2]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } } return { x0: x0 / img.w, y0: y0 / img.h, x1: (x1 + 1) / img.w, y1: (y1 + 1) / img.h }; };
  const ref1 = RT({}).img; const one = (t: any, scale = 1) => cov(RT({ text: [t] }, scale).img, scale === 1 ? ref1 : RT({}, scale).img);
  const T0 = { text: 'HAMBURG', size: 15, x: 40, y: 30, font: 'geist' }; const fs = 0.15 * 200;
  const c1 = one(T0), c2 = one(T0, 2);
  const dmax = Math.max(Math.abs(c1.x0 - c2.x0) * 300, Math.abs(c1.x1 - c2.x1) * 300, Math.abs(c1.y0 - c2.y0) * 200, Math.abs(c1.y1 - c2.y1) * 200);
  ok('tekst: skala 2 - zasieg napisu w ulamkach ramki taki sam jak w skali 1 (+-1 px w skali 1)', dmax <= 1 + 1e-9, dmax.toFixed(2) + ' px');
  ok('tekst: wyrownanie do srodka - srodek napisu w x (+-0,1 rozmiaru), wielkie litery - srodek pionowy w y (+-0,15 rozmiaru)', Math.abs((c1.x0 + c1.x1) / 2 * 300 - 120) <= 0.1 * fs && Math.abs((c1.y0 + c1.y1) / 2 * 200 - 60) <= 0.15 * fs, `${((c1.x0 + c1.x1) / 2 * 300).toFixed(1)}, ${((c1.y0 + c1.y1) / 2 * 200).toFixed(1)}`);
  const cl = one({ ...T0, align: 'left' }), cr = one({ ...T0, align: 'right' });
  ok('tekst: do lewej zaczyna sie w x, do prawej konczy w x (+-0,1 rozmiaru)', Math.abs(cl.x0 * 300 - 120) <= 0.1 * fs && Math.abs(cr.x1 * 300 - 120) <= 0.1 * fs, `${(cl.x0 * 300).toFixed(1)} ${(cr.x1 * 300).toFixed(1)}`);
  // liniowosc: rowne przyrosty wysokosci co 10 jednostek (stala nadwyzka antyaliasingu sie skraca; przy rozmiarze 10 hinting przycina litery)
  const hh = [20, 30, 40].map((sz) => { const c = one({ ...T0, text: 'HAM', size: sz, x: 50, y: 50 }); /* krótki: przy 40 HAMBURG wychodzi poza ramkę */ return Math.round((c.y1 - c.y0) * 200); });
  ok('tekst: wysokosc liter rosnie liniowo z rozmiarem (przyrosty 20->30 i 30->40 rowne +-1 px, ok. 0,7 rozmiaru)', hh[0] < hh[1] && Math.abs((hh[2] - hh[1]) - (hh[1] - hh[0])) <= 1 && Math.abs((hh[2] - hh[1]) - 0.7 * 20) <= 3, hh.join(' '));
  const co = one({ ...T0, outline: 10 }), cs = one({ ...T0, shadow: 80 });
  ok('tekst: obrys i cien poszerzaja zasieg napisu', co.x0 < c1.x0 && co.y1 > c1.y1 && cs.y1 > c1.y1);
  // kadr: polozenie wzgledem kadru
  const C = { x: 0.2, y: 0.1, w: 0.6, h: 0.7 }; const r = cropRect(300, 200, C); const cut = newImg(r.sw, r.sh); for (let y = 0; y < r.sh; y++) for (let x = 0; x < r.sw; x++) for (let k = 0; k < 4; k++) cut.data[(y * r.sw + x) * 4 + k] = B.data[((r.sy + y) * 300 + r.sx + x) * 4 + k];
  ok('tekst: z kadrem = jak na wycietym zdjeciu (bajt w bajt), napis wzgledem kadru', sha(RT({ crop: C, text: [T0] }).img) === sha(RT({ text: [T0] }, 1, cut).img));
  // polskie znaki: kazdy krój ma glif (szerokosc inna niz znaku spoza czcionki)
  const { TEXT_FONTS } = await import('../src/index.ts');
  const polish = TEXT_FONTS.every((f) => { const a = one({ text: 'ąęłżźćńśó', font: f.id, size: 12, y: 50 }), b = one({ text: 'aelzzcnso', font: f.id, size: 12, y: 50 }); return a.x1 - a.x0 > 0.5 * (b.x1 - b.x0) && a.y0 < b.y0; });
  ok('tekst: polskie znaki we wszystkich 4 krojach (znaki z ogonkami/kreskami siegaja wyzej niz bez)', polish);
  ok('tekst: prostokaty napisow w wyniku (do edytora), null dla pustego', (() => { const o = RT({ text: [T0, { text: '' }] }); return o.textBoxes?.length === 2 && !!o.textBoxes[0] && o.textBoxes[1] === null; })());
}
// 20. Krok 9: znieksztalcenia (plik 02, sekcja 5)
{
  const W = 200, H = 160; const mk = (f: (x: number, y: number) => number) => { const i = newImg(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = Math.round(f(x + 0.5, y + 0.5)); const o = (y * W + x) * 4; i.data[o] = i.data[o + 1] = i.data[o + 2] = v; } return i; };
  const D = (src: Img, id: string, p: any = {}) => render(src, { style: { id, params: p } }).img;
  const S = testImage(W, H);
  ok('znieksztalcenia: amount 0 = obraz bez zmian, bajt w bajt (Pinch, Spherize, Twirl, ZigZag, Ripple, Shear)', ['pinch', 'spherize', 'twirl', 'zigzag', 'ripple', 'shear'].every((id) => sha(D(S, id, { amount: 0 })) === sha(S)));
  const outside = ['pinch', 'spherize', 'twirl', 'ripple'].filter((id) => { const o = D(S, id, { amount: id === 'twirl' ? 250 : 100, radius: 60 }); const R = 0.6 * 80; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x + 0.5 - 100, y + 0.5 - 80) > R + 0.01) { const i = (y * W + x) * 4; if (o.data[i] !== S.data[i] || o.data[i + 1] !== S.data[i + 1]) return true; } return false; });
  ok('znieksztalcenia: poza promieniem piksele bez zmian (Pinch, Spherize, Twirl, Ripple)', outside.length === 0, outside.join(','));
  // obraz zalezny tylko od kata: odwzorowania promieniowe (Pinch, Spherize, Ripple) go nie zmieniaja; zalezny tylko od odleglosci: Twirl go nie zmienia
  const ang = mk((x, y) => 128 + 100 * Math.sin(3 * Math.atan2(y - 80, x - 100))), rad = mk((x, y) => 128 + 100 * Math.sin(Math.hypot(x - 100, y - 80) / 6));
  const inner = (a: Img, b: Img) => { let se = 0, n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = Math.hypot(x + 0.5 - 100, y + 0.5 - 80); if (r < 6) continue; const d = a.data[(y * W + x) * 4] - b.data[(y * W + x) * 4]; se += d * d; n++; } return se === 0 ? 99 : 10 * Math.log10(65025 / (se / n)); };
  const pr = ['pinch', 'spherize', 'ripple'].map((id) => [id, inner(D(ang, id, { amount: 100 }), ang)] as const), pt = inner(D(rad, 'twirl', { amount: 250 }), rad);
  ok('znieksztalcenia: Pinch, Spherize, Ripple zachowuja kierunek (obraz katowy bez zmian), Twirl zachowuje odleglosc (obraz promieniowy bez zmian), PSNR > 30 dB', pr.every(([, v]) => v > 30) && pt > 30, pr.map(([i, v]) => `${i} ${v.toFixed(1)}`).join(' ') + ` twirl ${pt.toFixed(1)}`);
  const rows = mk((x, y) => 128 + 100 * Math.sin(y / 3));
  ok('ZigZag i Shear przesuwaja tylko w poziomie: obraz stały w wierszach bez zmian (bajt w bajt)', sha(D(rows, 'zigzag', { amount: 100 })) === sha(rows) && sha(D(rows, 'shear', { amount: 100 })) === sha(rows));
  // kropka w srodku: Spherize + i Pinch − powiekszaja, Spherize − i Pinch + zmniejszaja
  const dot = mk((x, y) => (Math.hypot(x - 100, y - 80) < 12 ? 255 : 0)); const area = (i: Img) => { let n = 0; for (let k = 0; k < i.data.length; k += 4) n += i.data[k] / 255; return n; }; const a0 = area(dot);
  const ar = { sp: area(D(dot, 'spherize', { amount: 100 })), sm: area(D(dot, 'spherize', { amount: -100 })), pp: area(D(dot, 'pinch', { amount: 100 })), pm: area(D(dot, 'pinch', { amount: -100 })) };
  ok('Spherize > 0 i Pinch < 0 powiekszaja srodek, Spherize < 0 i Pinch > 0 go zmniejszaja (pole kropki)', ar.sp > a0 * 1.3 && ar.pm > a0 * 1.3 && ar.sm < a0 / 1.3 && ar.pp < a0 / 1.3, `${a0.toFixed(0)}: ${Object.entries(ar).map(([k, v]) => k + ' ' + v.toFixed(0)).join(', ')}`);
  // Polar: toPolar, potem toRect, odtwarza obraz w pierscieniu 0,2–0,9 promienia
  const sq = testImage(160, 160); const back = D(D(sq, 'polar', { mode: 'toPolar' }), 'polar', { mode: 'toRect' });
  // zlozenie to tozsamosc w calym prostokacie; wiersz y trafia na okrag o promieniu y/h, wiec wiersze z obwodem < szerokosc (y/h < 160/(2π·80) ≈ 0,32) traca probki
  let se = 0, n = 0; for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) { const r = (y + 0.5) / 160; if (r < 0.35 || r > 0.95) continue; for (let c = 0; c < 3; c++) { const d = back.data[(y * 160 + x) * 4 + c] - sq.data[(y * 160 + x) * 4 + c]; se += d * d; n++; } }
  const pp = 10 * Math.log10(65025 / (se / n));
  ok('Polar: prostokatne -> biegunowe -> prostokatne odtwarza obraz w wierszach 0,35–0,95 wysokosci (obwod >= szerokosc; PSNR > 20 dB)', pp > 20, pp.toFixed(1) + ' dB');
  const z1 = D(rows.w ? mk((x) => 128 + 100 * Math.sin(x / 2)) : rows, 'zigzag', { amount: 100, wavelength: 20 }); let rowShift = 0; for (let y = 0; y < H; y++) { let d = 0; for (let x = 0; x < W; x++) d += Math.abs(z1.data[(y * W + x) * 4] - z1.data[x * 4]); rowShift = Math.max(rowShift, d); }
  ok('ZigZag: wiersze przesuniete wzgledem siebie (obraz pionowych pasow sie zmienia)', rowShift > 1000);
}
// 21. Krok 9: rozmycia (plik 02, sekcja 6)
{
  const W = 200, H = 160; const mk = (f: (x: number, y: number) => number) => { const i = newImg(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = Math.round(f(x + 0.5, y + 0.5)); const o = (y * W + x) * 4; i.data[o] = i.data[o + 1] = i.data[o + 2] = v; } return i; };
  const D = (src: Img, id: string, p: any = {}, scale = 1) => render(src, { style: { id, params: p } }, { scale }).img;
  const S = testImage(W, H); const varL = (i: Img) => { const m = meanLum(i); let v = 0; for (let k = 0; k < i.data.length; k += 4) v += (lum(i.data[k], i.data[k + 1], i.data[k + 2]) - m) ** 2; return v / (i.data.length / 4); };
  ok('rozmycia: wartosc 0 = obraz bez zmian, bajt w bajt (Gaussian radius 0, Motion length 0, Radial amount 0, Tilt-Shift blur 0 i nasycenie 0)', sha(D(S, 'gaussianblur', { radius: 0 })) === sha(S) && sha(D(S, 'motionblur', { length: 0 })) === sha(S) && sha(D(S, 'radialblur', { amount: 0 })) === sha(S) && sha(D(S, 'tiltshift', { blurAmount: 0, saturationBoost: 0 })) === sha(S));
  const flat = uniform(W, H, 137);
  ok('rozmycia: jednolity obraz bez zmian (4 efekty, nasycenie Tilt-Shift nie dziala na szarosc)', ['gaussianblur', 'motionblur', 'radialblur', 'tiltshift'].every((id) => sha(D(flat, id)) === sha(flat)));
  const v = [0, 2, 6, 15].map((r) => varL(D(S, 'gaussianblur', { radius: r }))); const dm = Math.abs(meanLum(D(S, 'gaussianblur', { radius: 15 })) - meanLum(S));
  ok('Gaussian: wariancja jasnosci maleje z promieniem, srednia zachowana (+-0,005)', v[0] > v[1] && v[1] > v[2] && v[2] > v[3] && dm <= 0.005, v.map((x) => x.toFixed(4)).join(' ') + ` dm ${dm.toFixed(4)}`);
  // szerokosc rozmycia ~ sigma: profil krawedzi 10–90% ma ok. 2,56 sigma (dla gaussa)
  const edge = mk((x) => (x < 100 ? 0 : 255)); const e = D(edge, 'gaussianblur', { radius: 10 }); const row = [...Array(W)].map((_, x) => e.data[(80 * W + x) * 4] / 255);
  const w1090 = row.filter((t) => t > 0.1 && t < 0.9).length;
  ok('Gaussian: szerokosc krawedzi 10–90% ok. 2,56 x radius (+-20%)', Math.abs(w1090 / (2.56 * 10) - 1) <= 0.2, `${w1090} px`);
  const e2 = D(edge, 'gaussianblur', { radius: 10 }, 2); const w2 = [...Array(2 * W)].map((_, x) => e2.data[(160 * 2 * W + x) * 4] / 255).filter((t) => t > 0.1 && t < 0.9).length;
  ok('Gaussian: promien w px skaluje sie z eksportem (szerokosc krawedzi przy skali 2 = 2x, +-10%)', Math.abs(w2 / (2 * w1090) - 1) <= 0.1, `${w1090} -> ${w2} px`);
  const rows = mk((x, y) => 128 + 100 * Math.sin(y / 3)), cols = mk((x) => 128 + 100 * Math.sin(x / 3));
  ok('Motion: kat 0 nie zmienia obrazu stalego w wierszach, rozmywa obraz staly w kolumnach; kat 90 odwrotnie', sha(D(rows, 'motionblur', { angle: 0, length: 40 })) === sha(rows) && varL(D(cols, 'motionblur', { angle: 0, length: 40 })) < varL(cols) / 4 && sha(D(cols, 'motionblur', { angle: 90, length: 40 })) === sha(cols));
  const ang = mk((x, y) => 128 + 100 * Math.sin(3 * Math.atan2(y - 80, x - 100))), rad = mk((x, y) => 128 + 100 * Math.sin(Math.hypot(x - 100, y - 80) / 6));
  // porownanie w kole r < 70 (krotszy bok 160): luk spinu z dalszych punktow wychodzi poza obraz, a tam probki maja kolor brzegu
  const ps = (a: Img, b: Img) => { let se = 0, n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (Math.hypot(x + 0.5 - 100, y + 0.5 - 80) >= 70) continue; for (let c = 0; c < 3; c++) { const d = a.data[(y * W + x) * 4 + c] - b.data[(y * W + x) * 4 + c]; se += d * d; n++; } } return se === 0 ? 99 : 10 * Math.log10(65025 / (se / n)); };
  const pz = ps(D(ang, 'radialblur', { type: 'zoom', amount: 100 }), ang), pspin = ps(D(rad, 'radialblur', { type: 'spin', amount: 100 }), rad);
  const zr = ps(D(rad, 'radialblur', { type: 'zoom', amount: 100 }), rad), sa = ps(D(ang, 'radialblur', { type: 'spin', amount: 100 }), ang);
  ok('Radial: zoom nie zmienia obrazu katowego, spin obrazu promieniowego (PSNR > 35 dB); zoom rozmywa promieniowy, spin katowy (< 30 dB)', pz > 35 && pspin > 35 && zr < 30 && sa < 30, `${pz.toFixed(1)} ${pspin.toFixed(1)} | ${zr.toFixed(1)} ${sa.toFixed(1)}`);
  // Tilt-Shift: pas ostrosci bez zmian (bez nasycenia), daleko od pasa rozmyte
  const tsh = D(cols, 'tiltshift', { focusPosition: 50, focusWidth: 20, blurAmount: 100, saturationBoost: 0 }); let band = 0; for (let y = 0; y < H; y++) { if (Math.abs(y + 0.5 - 80) > 0.1 * H - 1) continue; for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (tsh.data[i] !== cols.data[i] || tsh.data[i + 1] !== cols.data[i + 1]) band++; } }
  const strip = (i: Img, y0: number, y1: number) => { const o = newImg(W, y1 - y0); o.data.set(i.data.subarray(y0 * W * 4, y1 * W * 4)); return o; };
  ok('Tilt-Shift: piksele w pasie ostrosci bez zmian; gorny brzeg rozmyty (pionowe pasy co ok. 19 px: wariancja < polowy)', band === 0 && varL(strip(tsh, 0, 20)) < varL(strip(cols, 0, 20)) / 2, `zmienione w pasie: ${band}`);
  const sat = (i: Img) => { let s = 0; for (let k = 0; k < i.data.length; k += 4) s += Math.max(i.data[k], i.data[k + 1], i.data[k + 2]) - Math.min(i.data[k], i.data[k + 1], i.data[k + 2]); return s; };
  ok('Tilt-Shift: podbicie nasycenia zwieksza nasycenie', sat(D(S, 'tiltshift', { saturationBoost: 60 })) > sat(D(S, 'tiltshift', { saturationBoost: 0 })) * 1.2);
  const strobe = D(mk((x) => (Math.abs(x - 100) < 2 ? 255 : 0)), 'motionblur', { angle: 0, length: 60, samples: 4 }); const peaks = [...Array(W)].map((_, x) => strobe.data[(80 * W + x) * 4]); const runs = peaks.reduce((n, v, x) => n + (v > 20 && (x === 0 || peaks[x - 1] <= 20) ? 1 : 0), 0);
  ok('Motion: Samples 4 przy dlugosci 60 px daje 4 osobne kopie waskiej linii (slad schodkowy)', runs === 4, `${runs}`);
  const ml = D(mk((x) => (Math.abs(x + 0.5 - 100.5) < 1 ? 255 : 0)), 'motionblur', { angle: 0, length: 40 }); const span = [...Array(W)].filter((_, x) => ml.data[(80 * W + x) * 4] > 0).length;
  ok('Motion: slad waskiej linii ma dlugosc = length (40 px +-3)', Math.abs(span - 40) <= 3, `${span} px`);
  const m1 = D(cols, 'motionblur', { angle: 0, length: 20 }), m2 = resize(D(cols, 'motionblur', { angle: 0, length: 20 }, 2), 200, 160);
  ok('Motion: dlugosc w px skaluje sie z eksportem (skala 2 po zmniejszeniu ~ skala 1, PSNR > 30 dB)', psnr(m1, m2) > 30, psnr(m1, m2).toFixed(1) + ' dB');
}
// 22. Krok 9: glitch i sygnal, swiatlo (RGB Split, Scanline, CRT, Thermal, Edge Glow, Aberration)
{
  const W = 200, H = 160; const D = (src: Img, id: string, p: any = {}, scale = 1) => render(src, { style: { id, params: p } }, { scale }).img; const S = testImage(W, H);
  const ch = (i: Img, c: number) => sha({ w: i.w, h: i.h, data: i.data.filter((_, k) => k % 4 === c) } as Img);
  const rs = D(S, 'rgbsplit', { offset: 5, angle: 0 }); let shiftOk = true; for (let y = 0; y < H; y++) for (let x = 5; x < W - 5; x++) { const i = (y * W + x) * 4; if (rs.data[i] !== S.data[i - 20] || rs.data[i + 2] !== S.data[i + 20 + 2]) shiftOk = false; }
  ok('RGB Split: R = zrodlo przesuniete o +5 px, B o −5 px (dokladnie), G bez zmian; perChannel rusza tez G', shiftOk && ch(rs, 1) === ch(S, 1) && ch(D(S, 'rgbsplit', { perChannel: true }), 1) !== ch(S, 1));
  // Scanline: przyciemnienie sredniej = intensity · T/(T+spacing); roll 50% = wzor przesuniety o pol okresu
  const g = uniform(W, H, 200); const sl = D(g, 'scanline', { spacing: 3, thickness: 2, intensity: 60 }); const exp = 1 - 0.6 * 2 / 5; const got = meanLum(sl) / meanLum(g);
  ok('Scanline: srednia jasnosc = 1 − intensity·T/(T+spacing) (0,76 ±0,005); intensity 0 = bez zmian', Math.abs(got - exp) <= 0.005 && sha(D(g, 'scanline', { intensity: 0 })) === sha(g), got.toFixed(4));
  const rowL = (i: Img) => [...Array(i.h)].map((_, y) => i.data[y * i.w * 4]); const r0 = rowL(D(g, 'scanline', { spacing: 6, thickness: 4, roll: 0 })), r5 = rowL(D(g, 'scanline', { spacing: 6, thickness: 4, roll: 50 }));
  ok('Scanline: roll 50% przesuwa wzor o pol okresu (5 wierszy)', r5.slice(0, 140).every((v, y) => v === r0[y + 5]));
  const s1 = meanLum(D(g, 'scanline', { spacing: 1.5 * 2, thickness: 1 })), s2 = meanLum(D(g, 'scanline', { spacing: 3, thickness: 1 }, 1.7));
  ok('Scanline: przy skali 1,7 (pasy ulamkowe) srednie przyciemnienie takie samo jak przy 1 (+-0,003)', Math.abs(s1 - s2) <= 0.003, `${s1.toFixed(4)} ${s2.toFixed(4)}`);
  // CRT
  const crt0 = D(S, 'crt', { curvature: 0, scanlines: 0, phosphorMask: 0, bloom: 0, flicker: 0 });
  ok('CRT: wszystko 0 = obraz bez zmian; zakrzywienie czerni narozniki; seed zmienia migotanie', sha(crt0) === sha(S) && D(S, 'crt', { curvature: 100 }).data.slice(0, 3).every((v) => v === 0) && sha(D(S, 'crt', { seed: 1 })) !== sha(D(S, 'crt', { seed: 2 })));
  const pm = D(g, 'crt', { curvature: 0, scanlines: 0, bloom: 0, flicker: 0, phosphorMask: 100 }); const col = (x: number) => [0, 1, 2].map((c) => pm.data[(50 * W + x) * 4 + c]);
  ok('CRT: maska luminoforu - kolumny 0, 1, 2 z dominujacym R, G, B (okres 3 px)', [0, 1, 2, 3, 4, 5].every((x) => { const v = col(x); const m = Math.max(...v); return v[x % 3] === m && v.filter((q) => q === m).length === 1; }));
  // Thermal: bez szumu i celownika kazdy piksel ma kolor z palety; white-hot monotoniczny
  const { THERMAL_PALETTES, paletteLut } = await import('../src/effects/signal.ts');
  const th = D(S, 'thermal', { noise: 0, crosshair: false }); const lut = paletteLut(THERMAL_PALETTES.ironbow); const set = new Set<number>(); for (let i = 0; i < 256; i++) set.add(lut[i * 3] << 16 | lut[i * 3 + 1] << 8 | lut[i * 3 + 2]);
  let off = 0; for (let i = 0; i < th.data.length; i += 4) if (!set.has(th.data[i] << 16 | th.data[i + 1] << 8 | th.data[i + 2])) off++;
  const ramp = D(gradient(W, H), 'thermal', { palette: 'whitehot', noise: 0, crosshair: false, contrast: 0 }); let mono = true; for (let x = 1; x < W; x++) if (ramp.data[(80 * W + x) * 4] < ramp.data[(80 * W + x - 1) * 4]) mono = false;
  ok('Thermal: kazdy piksel w kolorze palety (0 poza); white-hot rosnie z jasnoscia; celownik bialy 5 px od srodka', off === 0 && mono && D(S, 'thermal', { crosshair: true }).data.slice(((80 * W) + 100 + 5) * 4, ((80 * W) + 100 + 5) * 4 + 3)   /* ramie 6% krotszego boku = 9,6 px */.every((v) => v === 255), `${off}`);
  // Edge Glow: obraz bez krawedzi -> tylko przyciemnienie; krawedz swieci, daleko od niej tylko przyciemnienie
  const ef = D(g, 'edgeglow', { sourceDim: 50 }); ok('Edge Glow: jednolity obraz -> tylko przyciemnienie (200 -> 100); sourceDim 0 i brak krawedzi = bez zmian', ef.data[0] === 100 && sha(D(g, 'edgeglow', { sourceDim: 0 })) === sha(g));
  const step = newImg(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; const v = x < 100 ? 40 : 200; step.data[o] = step.data[o + 1] = step.data[o + 2] = v; }
  const eg = D(step, 'edgeglow', { sourceDim: 50, glowRadius: 4, colorMode: 'single', glowColor: '#00ff00' }); const at = (x: number) => eg.data[(80 * W + x) * 4 + 1];
  ok('Edge Glow: przy krawedzi zielona poswiata, 40 px dalej tylko przyciemnienie (100)', at(100) > 200 && at(140) === 100 && at(60) === 20, `${at(100)} ${at(140)} ${at(60)}`);
  const e1 = D(step, 'edgeglow', { threshold: 60 }), e2 = resize(D(step, 'edgeglow', { threshold: 60 }, 2), W, H);
  ok('Edge Glow: sila krawedzi niezalezna od skali (prog 60%: skala 2 po zmniejszeniu ~ skala 1, PSNR > 25 dB)', psnr(e1, e2) > 25, psnr(e1, e2).toFixed(1) + ' dB');
  // Aberration
  ok('Aberration: wszystko 0 = bez zmian; strength nie rusza G; winieta przyciemnia rog wzgledem srodka', sha(D(S, 'lens', { strength: 0, barrel: 0, fringe: 0, vignette: 0 })) === sha(S) && ch(D(S, 'lens', { strength: 100, fringe: 0 }), 1) === ch(D(S, 'lens', { strength: 0, fringe: 0 }), 1)
    && (() => { const v = D(g, 'lens', { strength: 0, barrel: 0, fringe: 0, vignette: 100 }); return v.data[0] < v.data[(80 * W + 100) * 4] * 0.5; })());
  // obraz w drobne pasy pionowe (gladki gradient obrazu testowego w rogu nie zmienia sie przy przesunieciu o ok. 2 px)
  const stripes = newImg(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; stripes.data[o] = stripes.data[o + 1] = stripes.data[o + 2] = 128 + 100 * Math.sin((x + 0.5) / 1.5); }
  const ab = D(stripes, 'lens', { strength: 100, radial: 100, barrel: 0, fringe: 0, vignette: 0 }); const cpx = (80 * W + 100) * 4; const S0 = stripes;
  ok('Aberration radialna: srodek obrazu bez przesuniecia kanalow (R, B jak zrodlo +-1), rog przesuniety', Math.abs(ab.data[cpx] - S0.data[cpx]) <= 1 && Math.abs(ab.data[cpx + 2] - S0.data[cpx + 2]) <= 1 && Math.abs(ab.data[(5 * W + 5) * 4] - S0.data[(5 * W + 5) * 4]) > 10);
}
// 23. Krok 9: druk (Risograph, CMYK Drops, Comic, Crosshatch, Sketch, Stippling, Pointillize)
{
  const W = 160, H = 120; const R = (src: Img, id: string, p: any = {}, scale = 1) => render(src, { style: { id, params: p } }, { scale });
  const D = (src: Img, id: string, p: any = {}, scale = 1) => R(src, id, p, scale).img; const flat = (r: number, g: number, b: number) => newImg(W, H, [r, g, b, 255]);
  const allEq = (i: Img, c: number[]) => { for (let k = 0; k < i.data.length; k += 4) if (i.data[k] !== c[0] || i.data[k + 1] !== c[1] || i.data[k + 2] !== c[2]) return false; return true; };
  const mono = (id: string, p: any = {}) => { const m = [230, 180, 130, 80, 30].map((v) => meanLum(D(flat(v, v, v), id, p))); return { ok: m.every((v, i) => i === 0 || v < m[i - 1]), m }; };
  const white = flat(255, 255, 255);
  ok('druk: biel daje sam papier, bajt w bajt (Risograph, CMYK Drops, Crosshatch, Stippling)', allEq(D(white, 'risograph'), parseColor('#f2ede4')) && allEq(D(white, 'halftonecmyk'), parseColor('#f7f3ea')) && allEq(D(white, 'crosshatch'), parseColor('#f6f2e8')) && allEq(D(white, 'stippling'), parseColor('#f4f1ea')));
  const mons = ['risograph', 'halftonecmyk', 'crosshatch', 'sketch', 'stippling'].map((id) => [id, mono(id, id === 'sketch' ? { paperTexture: 0 } : {})] as const);
  // Sketch: swiatla celowo bez kresek (jak szkic olowkiem), wiec dla niego: nie jasniej i wyraznie ciemniej w czerni
  const skm = mono('sketch', { paperTexture: 0 }).m; const skOk = skm.every((v, i) => i === 0 || v <= skm[i - 1] + 1e-9) && skm[4] < skm[0] - 0.1;
  ok('druk: ciemniejsza szarosc = ciemniejszy wynik (5 tonow; Sketch: nie jasniej i o > 0,1 ciemniej w czerni)', mons.every(([id, r]) => (id === 'sketch' ? skOk : r.ok)), mons.filter(([, r]) => !r.ok).map(([id, r]) => id + ' ' + r.m.map((v) => v.toFixed(3)).join('/')).join('; '));
  // Risograph: obraz w kolorze farby 2 drukuje sie prawie tylko farba 2
  const rb = D(flat(0, 120, 191), 'risograph', { grain: 0 }); let pink = 0; for (let k = 0; k < rb.data.length; k += 4) if (rb.data[k] > rb.data[k + 2] + 30) pink++;
  ok('Risograph: obraz w kolorze farby 2 (niebieskiej) prawie bez farby 1 (rozowe piksele < 2%)', pink / (W * H) < 0.02, `${(100 * pink / (W * H)).toFixed(2)}%`);
  // CMYK: czysty cyjan -> tylko farba C (kazdy piksel lezy na odcinku papier -> papier x cyjan)
  const cy = D(flat(0, 255, 255), 'halftonecmyk'); const P = parseColor('#f7f3ea'), C = parseColor('#00aeef'); let off = 0;
  for (let k = 0; k < cy.data.length; k += 4) { const t = (P[0] - cy.data[k]) / Math.max(1, P[0] - P[0] * C[0] / P[0]); for (const c of [1, 2]) { const e = P[c] * lerp(1, C[c] / P[c], clamp(t, 0, 1)); if (Math.abs(cy.data[k + c] - e) > 3) { off++; break; } } }
  ok('CMYK Drops: czysty cyjan drukuje sie tylko farba C (piksele na odcinku papier–cyjan, +-3)', off === 0, `${off}`);
  ok('CMYK Drops: jasna szarosc ponizej minDot = sam papier; czern bardzo ciemna', allEq(D(flat(250, 250, 250), 'halftonecmyk', { minDot: 10 }), P) && meanLum(D(flat(0, 0, 0), 'halftonecmyk')) < 0.2);
  // Comic: plaski jasny kolor -> dokladnie kolor po posteryzacji; kontur tylko przy krawedzi; ciemne plaskie pole -> kropki Ben-Day
  const lv = 4, q = (v: number) => Math.round((v / 255) * (lv - 1)) * (255 / (lv - 1));
  ok('Comic: plaski jasny kolor (bez krawedzi i cieni) = kolor po posteryzacji do 4 poziomow, bajt w bajt', allEq(D(flat(200, 150, 240), 'comic', { levels: lv }), [q(200), q(150), q(240)].map(Math.round)));
  const step = newImg(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; const v = x < 80 ? 150 : 250; step.data[o] = step.data[o + 1] = step.data[o + 2] = v; }
  const cm = D(step, 'comic', { outlineThickness: 3 }); const inkX: number[] = []; for (let x = 0; x < W; x++) { const o = (60 * W + x) * 4; if (cm.data[o] < 40) inkX.push(x); }
  ok('Comic: kontur tylko przy krawedzi (czarne piksele w odleglosci <= 4 px od x = 80) i jest', inkX.length >= 2 && inkX.every((x) => Math.abs(x - 79.5) <= 4.5), inkX.join(','));
  const dk = D(flat(60, 60, 60), 'comic'); let inkPx = 0; for (let k = 0; k < dk.data.length; k += 4) if (dk.data[k] === 17) inkPx++;
  ok('Comic: ciemne pole dostaje kropki Ben-Day (czesc pikseli w kolorze tuszu)', inkPx > W * H * 0.1 && inkPx < W * H * 0.9, `${inkPx}`);
  ok('Crosshatch: wiecej warstw = wiecej tuszu w czerni', meanLum(D(flat(0, 0, 0), 'crosshatch', { layers: 4 })) < meanLum(D(flat(0, 0, 0), 'crosshatch', { layers: 2 })));
  const sk = D(white, 'sketch'); let skMin = 255; for (let k = 0; k < sk.data.length; k += 4) skMin = Math.min(skMin, sk.data[k]);
  ok('Sketch: biala kartka bez krawedzi - tylko faktura papieru (piksele >= 247·0,9), bez kresek', skMin >= Math.floor(247 * 0.9), `${skMin}`);
  const ske = D(step, 'sketch', { hatchDensity: 0, paperTexture: 0 }); const skx: number[] = []; for (let x = 0; x < W; x++) if (ske.data[(60 * W + x) * 4] < 200) skx.push(x);
  ok('Sketch: linia tylko przy krawedzi (|x − 80| <= 3)', skx.length >= 1 && skx.every((x) => Math.abs(x - 79.5) <= 3.5), skx.join(','));
  // Stippling i Pointillize: punkty we wspolrzednych zrodla
  const S = testImage(W, H); const n1 = R(S, 'stippling').info.dots as number, n2 = R(S, 'stippling', {}, 2).info.dots as number;
  ok('Stippling: liczba kropek przy skali 2 jak przy 1 (+-2%); seed i rozklad zmieniaja wynik', Math.abs(n2 / n1 - 1) <= 0.02 && sha(D(S, 'stippling', { seed: 1 })) !== sha(D(S, 'stippling', { seed: 2 })) && sha(D(S, 'stippling', { distribution: 'weighted' })) !== sha(D(S, 'stippling')), `${n1} / ${n2}`);
  const cnt = [200, 120, 40].map((v) => R(flat(v, v, v), 'stippling', { distribution: 'random' }).info.dots as number);
  ok('Stippling: ciemniej = wiecej kropek (biel 0)', R(white, 'stippling').info.dots === 0 && cnt[0] < cnt[1] && cnt[1] < cnt[2], cnt.join(' '));
  const pc = [235, 120, 40], bg = parseColor('#f4f1ea'); const pt = D(flat(pc[0], pc[1], pc[2]), 'pointillize'); let bad = 0;
  for (let k = 0; k < pt.data.length; k += 4) { const t = (pt.data[k + 1] - bg[1]) / (pc[1] - bg[1]); for (const c of [0, 2]) if (Math.abs(pt.data[k + c] - lerp(bg[c], pc[c], clamp(t, 0, 1))) > 3) { bad++; break; } }
  ok('Pointillize: plaski kolor -> kazdy piksel miedzy tlem a tym kolorem (+-3); liczba plamek przy skali 2 identyczna', bad === 0 && R(S, 'pointillize').info.dots === R(S, 'pointillize', {}, 2).info.dots, `${bad}`);
}
// 24. Krok 9: reszta Fazy 2 (ASCII Studio, LED Matrix, Low Poly, Truchet, Smudge)
{
  const W = 160, H = 120; const R = (src: Img, id: string, p: any = {}, scale = 1) => render(src, { style: { id, params: p } }, { scale, glyphs: G });
  const D = (src: Img, id: string, p: any = {}, scale = 1) => R(src, id, p, scale).img; const flat = (r: number, g: number, b: number) => newImg(W, H, [r, g, b, 255]); const S = testImage(W, H);
  const colors = (i: Img) => { const s = new Set<number>(); for (let k = 0; k < i.data.length; k += 4) s.add(i.data[k] << 16 | i.data[k + 1] << 8 | i.data[k + 2]); return s; };
  // ASCII Studio
  const pal = new Set(PALETTES.cyberpunk.colors!.map((c) => { const [r, g, b] = parseColor(c); return r << 16 | g << 8 | b; }));
  const st = D(S, 'asciiStudio', { shape: 'square', mix: 0 }); const stc = [...colors(st)];
  ok('ASCII Studio: kwadraty na pelna komorke (mix 0) -> kazdy piksel w kolorze palety', stc.every((c) => pal.has(c)), `${stc.filter((c) => !pal.has(c)).length} spoza`);
  const gs = D(gradient(W, H), 'asciiStudio', { shape: 'square', mix: 0 }); const colL = (x: number) => lum(gs.data[(60 * W + x) * 4], gs.data[(60 * W + x) * 4 + 1], gs.data[(60 * W + x) * 4 + 2]); let up = true; for (let x = 10; x < W; x += 10) if (colL(x) < colL(x - 10) - 1e-9) up = false;
  ok('ASCII Studio: paleta wg jasnosci - jasniejszy ton = nie ciemniejszy kolor (gradient)', up && colL(155) > colL(5));
  ok('ASCII Studio: seed zmienia wynik (poziomy i gamma), ten sam seed - ten sam; krycie 0 = samo tlo', sha(D(S, 'asciiStudio', { seed: 1 })) === sha(D(S, 'asciiStudio', { seed: 1 })) && sha(D(S, 'asciiStudio', { seed: 1 })) !== sha(D(S, 'asciiStudio', { seed: 4 })) && colors(D(S, 'asciiStudio', { opacity: 0 })).size === 1);
  ok('ASCII Studio: tryb znakow dziala (dostawca glifow) i rozni sie od ksztaltow', sha(D(S, 'asciiStudio', { glyph: 'characters' })) !== sha(D(S, 'asciiStudio')));
  // LED Matrix
  const lm = [40, 120, 220].map((v) => meanLum(D(flat(v, v, v), 'ledmatrix', { glow: 0 })));
  ok('LED Matrix: jasniejszy obraz = jasniejszy panel; czern = tylko zgaszone diody (wartosc 15)', lm[0] < lm[1] && lm[1] < lm[2] && Math.max(...D(flat(0, 0, 0), 'ledmatrix', { glow: 0 }).data.filter((_, k) => k % 4 !== 3)) === 15, lm.map((v) => v.toFixed(3)).join(' '));
  const lsol = D(flat(200, 200, 200), 'ledmatrix', { colorMode: 'solid', ledColor: '#ffb000', glow: 0 }); let hue = true; for (let k = 0; k < lsol.data.length; k += 4) { const r = lsol.data[k], g = lsol.data[k + 1], b = lsol.data[k + 2]; if (r > 40 && (Math.abs(g / r - 176 / 255) > 0.03 || b > 15)) hue = false; }
  ok('LED Matrix solid: zapalone diody w kolorze ledColor (proporcja G/R +-0,03)', hue);
  const rgb = D(flat(255, 0, 0), 'ledmatrix', { ledType: 'stripe', glow: 0 }); let gOn = 0; for (let k = 0; k < rgb.data.length; k += 4) if (rgb.data[k + 1] > 15 || rgb.data[k + 2] > 15) gOn++;
  ok('LED Matrix RGB stripe: czerwony obraz zapala tylko paski R', gOn === 0, `${gOn}`);
  // Low Poly
  const lp = D(flat(30, 160, 90), 'lowpoly'); ok('Low Poly: plaski kolor -> caly obraz w tym kolorze (kazdy piksel nalezy do trojkata)', colors(lp).size === 1 && lp.data[0] === 30 && lp.data[1] === 160);
  const t1 = R(S, 'lowpoly', { distribution: 'random' }).info.triangles as number, t2 = R(S, 'lowpoly', { distribution: 'random' }, 2).info.triangles as number;
  ok('Low Poly: trojkatow ok. 2x punktow (600 -> 1000–1300), przy skali 2 tyle samo', t1 >= 1000 && t1 <= 1300 && t1 === t2, `${t1} / ${t2}`);
  const { delaunay } = await import('../src/effects/phase2.ts'); const rr = mulberry32(3); const pp = Float64Array.from({ length: 400 }, () => rr()); const tt = delaunay(pp); let emptyCirc = true;
  for (let k = 0; k < tt.length && emptyCirc; k += 3) { const [a, b, c] = [tt[k], tt[k + 1], tt[k + 2]].map((i) => [pp[2 * i], pp[2 * i + 1]]); const D2 = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / D2, uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / D2; const r2 = (a[0] - ux) ** 2 + (a[1] - uy) ** 2; for (let i = 0; i < 200; i++) if ((pp[2 * i] - ux) ** 2 + (pp[2 * i + 1] - uy) ** 2 < r2 - 1e-9) { emptyCirc = false; break; } }
  ok('Low Poly: triangulacja Delaunaya - zaden punkt nie lezy wewnatrz okregu opisanego (200 losowych punktow)', emptyCirc && tt.length / 3 > 350);
  // Truchet
  const tr = D(flat(120, 120, 120), 'truchet', { colors: 'mono' }); const bg = parseColor('#101010'), fg = parseColor('#f2efe6'); let trBad = 0; for (let k = 0; k < tr.data.length; k += 4) { const t = (tr.data[k] - bg[0]) / (fg[0] - bg[0]); for (const c of [1, 2]) if (Math.abs(tr.data[k + c] - lerp(bg[c], fg[c], clamp(t, 0, 1))) > 3) { trBad++; break; } }
  const ink = (v: number) => meanLum(D(flat(v, v, v), 'truchet', { colors: 'mono' }));
  ok('Truchet: dwa kolory -> piksele miedzy tlem a linia; ciemniejszy obraz = grubsze linie (wiecej jasnego koloru linii)', trBad === 0 && ink(40) > ink(200), `${trBad} ${ink(40).toFixed(3)} ${ink(200).toFixed(3)}`);
  // Smudge
  const rows = newImg(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; rows.data[o] = rows.data[o + 1] = rows.data[o + 2] = 128 + 100 * Math.sin(y / 3); }
  const step = newImg(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; const v = x < 80 ? 30 : 230; step.data[o] = step.data[o + 1] = step.data[o + 2] = v; }
  const sm = D(step, 'smudge', { angle: 0, length: 30, noise: 0 }); let leftSame = true; for (let y = 0; y < H; y++) for (let x = 0; x < 80; x++) if (sm.data[(y * W + x) * 4] !== 30) leftSame = false;
  ok('Smudge: strength 0 = bez zmian; obraz staly wzdluz kierunku bez zmian; slad tylko za krawedzia (lewa strona nietknieta, prawa przyciemniona)', sha(D(S, 'smudge', { strength: 0 })) === sha(S) && sha(D(rows, 'smudge', { angle: 0 })) === sha(rows) && leftSame && sm.data[(60 * W + 85) * 4] < 200 && sm.data[(60 * W + 150) * 4] === 230);
}
// 25. Krok 9: Voxel (`3d`)
{
  const W = 180, H = 140; const R = (src: Img, p: any = {}, scale = 1) => render(src, { style: { id: '3d', params: p } }, { scale });
  const flat = newImg(W, H, [200, 120, 60, 255]); const sh = (k: number) => [200, 120, 60].map((v) => Math.round(v * k));
  const vx = R(flat, { outline: 0, cubeSize: 14 }).img; const cnt = [0, 0, 0]; let other = 0; const fc = [sh(1), sh(0.78), sh(0.52)];
  for (let k = 0; k < vx.data.length; k += 4) { const j = fc.findIndex((c) => Math.abs(vx.data[k] - c[0]) <= 1 && Math.abs(vx.data[k + 1] - c[1]) <= 1 && Math.abs(vx.data[k + 2] - c[2]) <= 1); if (j < 0) other++; else cnt[j]++; }
  const tot = cnt[0] + cnt[1] + cnt[2];
  ok('Voxel: plaski kolor -> ponad 90% pikseli w jednym z 3 odcieni scian (gora 100%, jasna 78%, ciemna 52%)', tot / (W * H) > 0.9, `${(100 * tot / (W * H)).toFixed(1)}%`);
  ok('Voxel: kazda sciana zajmuje ok. 1/3 powierzchni (+-0,04) - poprawna geometria izometryczna', cnt.every((c) => Math.abs(c / tot - 1 / 3) <= 0.04), cnt.map((c) => (c / tot).toFixed(3)).join(' '));
  // odwrocenie swiatla: lewa i prawa sciana zamieniaja odcienie, gora bez zmian
  const vf = R(flat, { outline: 0, lightFlip: true, cubeSize: 14 }).img; const at = (i: Img, x: number, y: number) => [...i.data.slice((y * W + x) * 4, (y * W + x) * 4 + 3)];
  // srodek szescianu (i=1, j=2) przy cubeSize 14: cx = √3·14, cy = 2·21 = 42; punkty po lewej i prawej ponizej srodka
  const cx = Math.round(Math.sqrt(3) * 14), cy = 42; const lN = at(vx, cx - 5, cy + 5), rN = at(vx, cx + 5, cy + 5), lF = at(vf, cx - 5, cy + 5), rF = at(vf, cx + 5, cy + 5);
  ok('Voxel: lightFlip zamienia jasna i ciemna sciane (lewa <-> prawa)', lN.join() === rF.join() && rN.join() === lF.join() && lN.join() !== rN.join(), `${lN} ${rN} | ${lF} ${rF}`);
  ok('Voxel: topShade 0 -> gorne sciany czarne (punkt nad srodkiem szescianu)', at(R(flat, { outline: 0, topShade: 0, cubeSize: 14 }).img, cx, cy - 6).every((v) => v === 0));
  const sp = R(flat, { spacing: 6, outline: 0 }).img; let bg = 0; for (let k = 0; k < sp.data.length; k += 4) if (sp.data[k] === 0 && sp.data[k + 1] === 0) bg++;
  ok('Voxel: odstep > 0 odslania tlo (czarne), odstep 0 nie', bg > W * H * 0.05 && (() => { let z = 0; for (let k = 0; k < vx.data.length; k += 4) if (vx.data[k] === 0 && vx.data[k + 1] === 0) z++; return z === 0; })(), `${bg}`);
  const S = testImage(W, H); ok('Voxel: liczba szescianow przy skali 2 taka sama jak przy 1; obrys przyciemnia', R(S).info.cubes === R(S, {}, 2).info.cubes && meanLum(R(S, { outline: 2 }).img) < meanLum(R(S, { outline: 0 }).img), `${R(S).info.cubes} / ${R(S, {}, 2).info.cubes}`);
}
// 26. Krok 9, Faza 3: swiatlo i kolor (po jednej kluczowej wlasnosci na efekt)
{
  const W = 160, H = 120; const D = (src: Img, id: string, p: any = {}) => render(src, { style: { id, params: p } }).img; const flat = newImg(W, H, [180, 110, 60, 255]); const S = testImage(W, H);
  ok('Faza 3 swiatlo: plaski obraz bez zmian (Anaglyph, Prism, Kaleidoscope, Warpbloom bez poswiaty, Light Wind z progiem 100%)', ['anaglyph', 'prism', 'starburst'].every((id) => sha(D(flat, id)) === sha(flat)) && sha(D(flat, 'warpbloom', { bloomIntensity: 0 })) === sha(flat) && sha(D(flat, 'lightwind', { threshold: 100 })) === sha(flat));
  const ag = D(S, 'anaglyph', { separation: 0 }); ok('Anaglyph: separacja 0 = obraz bez zmian; separacja > 0 rozsuwa R wzgledem G', sha(ag) === sha(S) && sha(D(S, 'anaglyph')) !== sha(S));
  ok('Kaleidoscope: piksele symetryczne wzgledem osi sektora maja ten sam kolor (8 sektorow, os 22,5°)', (() => { const k = D(S, 'starburst', { segments: 8 }); let bad = 0; for (let r = 10; r < 55; r += 5) for (const t of [5, 12, 18]) { const a1 = (22.5 - t) * Math.PI / 180, a2 = (22.5 + t) * Math.PI / 180; const p1 = (Math.round(60 + r * Math.sin(a1) - 0.5) * W + Math.round(80 + r * Math.cos(a1) - 0.5)) * 4, p2 = (Math.round(60 + r * Math.sin(a2) - 0.5) * W + Math.round(80 + r * Math.cos(a2) - 0.5)) * 4; if (Math.abs(k.data[p1] - k.data[p2]) > 40) bad++; } return bad <= 2; })());
  const lw = D(newImg(W, H, [0, 0, 0, 255]).data.fill(255, 0, 20 * W * 4) && (() => { const i = newImg(W, H, [0, 0, 0, 255]); for (let k = 0; k < 20 * W * 4; k++) if (k % 4 !== 3) i.data[k] = 255; return i; })(), 'lightwind', { angle: 90, length: 60, threshold: 50 });
  ok('Light Wind (kat 90°): smuga w dol od jasnego pasa slabnie z odlegloscia', lw.data[(30 * W + 80) * 4] > lw.data[(60 * W + 80) * 4] && lw.data[(60 * W + 80) * 4] > lw.data[(110 * W + 80) * 4] && lw.data[(30 * W + 80) * 4] > 0, `${lw.data[(30 * W + 80) * 4]} ${lw.data[(60 * W + 80) * 4]} ${lw.data[(110 * W + 80) * 4]}`);
  const r1 = render(S, { style: { id: 'dreamdust' } }), r2 = render(S, { style: { id: 'dreamdust' } }, { scale: 2 });
  ok('Dreamdust: deterministyczny (ten sam seed = ten sam obraz), liczba czastek przy skali 2 jak przy 1, tylko rozjasnia', sha(r1.img) === sha(D(S, 'dreamdust')) && r1.info.particles === r2.info.particles && sha(D(S, 'dreamdust', { seed: 2 })) !== sha(r1.img) && meanLum(r1.img) >= meanLum(S));
}
// 27. Krok 9, Faza 3: glitch i sygnal (po jednej kluczowej wlasnosci na efekt)
{
  const W = 160, H = 120; const D = (src: Img, id: string, p: any = {}) => render(src, { style: { id, params: p } }).img; const S = testImage(W, H); const flat = newImg(W, H, [90, 140, 200, 255]);
  const ps = D(S, 'pixelsort', { thresholdLow: 0, thresholdHigh: 100 }); let perm = true, sorted = true;
  for (let y = 0; y < H; y++) { const a: string[] = [], b: string[] = []; let prev = -1; for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; a.push(S.data.slice(i, i + 4).join()); b.push(ps.data.slice(i, i + 4).join()); const L = lum(ps.data[i], ps.data[i + 1], ps.data[i + 2]); if (L < prev - 1e-9) sorted = false; prev = L; } if (a.sort().join('|') !== b.sort().join('|')) perm = false; }
  ok('Pixel Sort: kazdy wiersz to permutacja pikseli zrodla; przy progach 0–100% wiersz posortowany rosnaco', perm && sorted);
  ok('Digital Distortion i Datamosh: intensywnosc/rozmaz 0 = bez zmian; Datamosh nie zmienia plaskiego obrazu; seed zmienia glitch', sha(D(S, 'glitch', { intensity: 0 })) === sha(S) && sha(D(S, 'datamosh', { smearAmount: 0 })) === sha(S) && sha(D(flat, 'datamosh')) === sha(flat) && sha(D(S, 'glitch', { seed: 1 })) !== sha(D(S, 'glitch', { seed: 2 })));
  const lf = D(S, 'lofi', { colorBits: 1, noise: 0, tracking: 0, compressionArtifacts: 0 }); ok('Lofi: 1 bit koloru (bez szumu, tasmy, kompresji) -> kazdy kanal 0 albo 255', lf.data.every((v, k) => k % 4 === 3 || v === 0 || v === 255));
  const fo = D(flat, 'forensics', { mode: 'noise', overlayLabels: false }); ok('Forensics: plaski obraz w trybie szumu -> jednolita mapa (kolor zera mapy)', colorsOf(fo) === 1);
  const bc = D(newImg(W, H, [200, 200, 200, 255]), 'beacon', { pingSpeed: 50, dotSize: 4 }); const sp = 0.5 * 0.5 * Math.min(W, H); const at = (r: number) => { let m = 0; for (let x = Math.round(80 + r - 2); x <= Math.round(80 + r + 2); x++) m = Math.max(m, bc.data[(60 * W + x) * 4]); return m; };
  ok('Beacon: kropki na pierscieniu jasniejsze niz w polowie miedzy pierscieniami', at(sp) > at(sp * 1.5), `${at(sp)} ${at(sp * 1.5)}`);
}
// 28. Krok 9, Faza 3: druk (po jednej kluczowej wlasnosci na efekt)
{
  const W = 160, H = 120; const D = (src: Img, id: string, p: any = {}) => render(src, { style: { id, params: p } }).img; const S = testImage(W, H); const g = (v: number) => newImg(W, H, [v, v, v, 255]);
  const allC = (i: Img, c: number[]) => { for (let k = 0; k < i.data.length; k += 4) if (i.data[k] !== c[0] || i.data[k + 1] !== c[1] || i.data[k + 2] !== c[2]) return false; return true; };
  ok('Engraving i Cyanotype: biel = sam papier (bez sladow linii); Cyanotype: czern = blekit pruski', allC(D(g(255), 'engraving'), parseColor('#f3ecdc')) && allC(D(g(255), 'blueprint', { grain: 0, paperStain: 0 }), [238, 242, 244]) && allC(D(g(0), 'blueprint', { grain: 0, paperStain: 0 }), [13, 43, 94]));
  ok('Warhol: 2×2 i 3 poziomy -> najwyzej 12 kolorow; Woodblock bez konturu i faktur -> najwyzej colorCount kolorow', colorsOf(D(S, 'warhol', { grid: '2', levels: 3 })) <= 12 && colorsOf(D(S, 'ukiyoe', { outline: 0, woodGrain: 0, paperTexture: 0, colorCount: 5 })) <= 5);
  const mz = [200, 140, 80].map((v) => meanLum(D(g(v), 'mezzotint'))); const en = [220, 140, 60].map((v) => meanLum(D(g(v), 'engraving')));
  ok('Mezzotint i Engraving: ciemniejsza szarosc = ciemniejszy wynik', mz[0] > mz[1] && mz[1] > mz[2] && en[0] > en[1] && en[1] > en[2], `${mz.map((v) => v.toFixed(3))} | ${en.map((v) => v.toFixed(3))}`);
}
// 29. Krok 9, Faza 3: geometryczne (po jednej kluczowej wlasnosci na efekt)
{
  const W = 160, H = 120; const D = (src: Img, id: string, p: any = {}) => render(src, { style: { id, params: p } }).img; const S = testImage(W, H); const g = (v: number) => newImg(W, H, [v, v, v, 255]);
  ok('Lattice: czarny obraz (wezly i krawedzie o rozmiarze 0) -> samo tlo', colorsOf(D(g(0), 'lattice', { bgColor: '#102030' })) === 1 && sha(D(g(0), 'lattice', { bgColor: '#102030' })) === sha(newImg(W, H, [16, 32, 48, 255])));
  const ramp = newImg(W, H, [0, 0, 0, 255]); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; ramp.data[i] = ramp.data[i + 1] = ramp.data[i + 2] = Math.round((x / (W - 1)) * 255); }
  const tp = D(ramp, 'topography', { lineCount: 10, smoothing: 0, colorRamp: 'mono', lineColor: '#ff0000', thickness: 1.5 }); let runs = 0, inR = false; for (let x = 0; x < W; x++) { const i = (60 * W + x) * 4; const red = tp.data[i] > tp.data[i + 1] + 80; if (red && !inR) runs++; inR = red; }
  ok('Topography: rampa jasnosci 0–1 i 10 linii -> 9–11 izolinii w wierszu; plaski obraz bez linii', runs >= 9 && runs <= 11 && colorsOf(D(g(100), 'topography', { lineColor: '#ff0000' })) === 1, `${runs}`);
  const ng = D(S, 'neongrid', { perspective: true, glow: 0 }); let above = true; for (let y = 0; y < H * 0.4 - 1; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; for (let q = 0; q < 3; q++) if (Math.abs(ng.data[i + q] - S.data[i + q] * 0.25) > 1) above = false; }
  ok('Neon Grid: nad horyzontem (perspektywa, bez poswiaty) przyciemnione zrodlo; jasniejszy obraz = jasniejsze linie', above && meanLum(D(g(220), 'neongrid')) > meanLum(D(g(60), 'neongrid')));
  const sc = D(g(120), 'schematic', { annotationDensity: 0, gridSpacing: 40 }); let per = true; for (let y = 0; y < H; y++) for (let x = 0; x < W - 40; x++) if (sc.data[(y * W + x) * 4] !== sc.data[(y * W + x + 40) * 4]) per = false;
  ok('Schematic: plaski obraz bez adnotacji -> sama siatka, okresowa co gridSpacing; seed zmienia adnotacje', per && sha(D(S, 'schematic', { seed: 1 })) !== sha(D(S, 'schematic', { seed: 2 })));
  const dr = D(S, 'droste', { scaleRatio: 50, rotation: 0 }); let frame = true; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const m = Math.max(Math.abs(x + 0.5 - W / 2) / (W / 2), Math.abs(y + 0.5 - H / 2) / (H / 2)); if (m >= 0.5) { const i = (y * W + x) * 4; if (dr.data[i] !== S.data[i] || dr.data[i + 1] !== S.data[i + 1]) frame = false; } }
  const pin = (x: number, y: number) => dr.data[(y * W + x) * 4]; const src = (x: number, y: number) => S.data[(y * W + x) * 4];
  ok('Droste: rama poza 1. poziomem bez zmian; piksel 1. poziomu = zrodlo 2× dalej od srodka (bez obrotu); plaski obraz bez zmian', frame && Math.abs(pin(60, 40) - src(40, 20)) <= 12 && Math.abs(pin(100, 75) - src(120, 90)) <= 12 && sha(D(g(90), 'droste')) === sha(g(90)), `${pin(60, 40)}/${src(40, 20)} ${pin(100, 75)}/${src(120, 90)}`);
  const sq = g(0); for (let y = 40; y < 80; y++) for (let x = 60; x < 100; x++) sq.data.fill(255, (y * W + x) * 4, (y * W + x) * 4 + 3); const iso = (p: any) => D(sq, 'isoextrude', { outline: false, bgColor: '#000000', ...p });
  const diff = (a: Img, b: Img) => { let n = 0; for (let k = 0; k < a.data.length; k += 4) if (Math.abs(a.data[k] - b.data[k]) > 8) n++; return n; };
  const dH = diff(iso({ shading: 100 }), iso({ shading: 0 })), d0 = diff(iso({ shading: 100, maxHeight: 0 }), iso({ shading: 0, maxHeight: 0 }));
  ok('Iso Extrude: cieniowanie zmienia tylko sciany boczne -> przy wysokosci 0 (brak scian) obraz prawie ten sam, przy 150% wyraznie inny', dH > 300 && d0 < dH / 20, `${dH} ${d0}`);
}
// 30. Krok 9, Faza 3: Mixed, Specimen, Forms, Flow Field (po jednej kluczowej wlasnosci na efekt)
{
  const W = 160, H = 128; const R = (src: Img, id: string, p: any = {}, scale = 1) => render(src, { style: { id, params: p } }, { glyphs: G, scale }); const D = (src: Img, id: string, p: any = {}) => R(src, id, p).img; const S = testImage(W, H); const g = (v: number) => newImg(W, H, [v, v, v, 255]);
  const same = { shadowSet: 'standard', midSet: 'standard', highlightSet: 'standard' };
  ok('Mixed: trzy razy ten sam zestaw = Characters z tym zestawem (obraz i tekst); rozne zestawy -> inny obraz', sha(D(S, 'mixed', same)) === sha(D(S, 'characters', { charSet: 'standard' })) && renderText(S, { style: { id: 'mixed', params: same } }) === renderText(S, { style: { id: 'characters', params: { charSet: 'standard' } } }) && sha(D(S, 'mixed')) !== sha(D(S, 'characters')));
  const sp1 = R(S, 'specimen'), sp2 = R(S, 'specimen', {}, 2); const wt = (k: number) => meanLum(D(g(255), 'specimen', { weightRange: k, bgMode: 'solid', bgColor: '#000000' }));
  ok('Specimen: uklad rzedow przy skali 2 taki sam jak przy 1; czarny obraz i sam tekst ze spacji -> brak znakow; wieksza waga -> wiecej tuszu', sp1.info.rows === sp2.info.rows && sp1.info.glyphs === sp2.info.glyphs && R(g(0), 'specimen').info.glyphs === 0 && R(S, 'specimen', { textSource: '   ' }).info.glyphs === 0 && wt(100) > wt(0) * 1.3, `${sp1.info.rows}/${sp2.info.rows} ${wt(0).toFixed(3)} ${wt(100).toFixed(3)}`);
  const cov = (f: string) => meanLum(D(g(255), 'forms', { formType: f, size: 100, shading: 0, colorMode: 'mono', inkColor: '#ffffff', bgColor: '#000000' }));
  ok('Forms: pole bryly bez cieniowania = geometria (kula pi/4, kostka-szesciokat 3*sqrt3/8 komorki); czarny obraz -> samo tlo', Math.abs(cov('sphere') - Math.PI / 4) < 0.02 && Math.abs(cov('cube') - 3 * Math.sqrt(3) / 8) < 0.02 && colorsOf(D(g(0), 'forms')) === 1, `${cov('sphere').toFixed(3)} ${cov('cube').toFixed(3)}`);
  const ramp = newImg(W, H, [0, 0, 0, 255]); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ramp.data.fill(Math.round(40 + (x / (W - 1)) * 200), (y * W + x) * 4, (y * W + x) * 4 + 3);
  const ff = D(ramp, 'flowfield', { noiseScale: 0, lineCount: 300 }); let ex = 0, ey = 0; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = (y * W + x) * 4; ex += Math.abs(ff.data[i + 4] - ff.data[i - 4]); ey += Math.abs(ff.data[i + W * 4] - ff.data[i - W * 4]); }
  ok('Flow Field: rampa pozioma bez szumu -> linie wzdluz izolinii (pionowe): zmiennosc w poziomie >> w pionie; seed zmienia uklad, ten sam seed nie', ex > 4 * ey && sha(D(S, 'flowfield', { seed: 1 })) !== sha(D(S, 'flowfield', { seed: 2 })) && sha(D(S, 'flowfield')) === sha(D(S, 'flowfield')), `${ex} ${ey}`);
}
// 31. Krok 9, Faza 3: szklo (po jednej kluczowej wlasnosci na efekt)
{
  const W = 160, H = 120; const D = (src: Img, id: string, p: any = {}) => render(src, { style: { id, params: p } }).img; const S = testImage(W, H); const flat = newImg(W, H, [180, 110, 60, 255]);
  ok('Szklo: parametry zerowe = obraz bez zmian (Frosted bez rozmycia/ziarna z biala tinta, Shatter bez przesuniecia/obrotu/pekniec, Vitrine bez odbicia i ramy, Fluted bez refrakcji i cienia)',
    sha(D(S, 'frostedglass', { blur: 0, frostGrain: 0, tint: '#ffffff' })) === sha(S) && sha(D(S, 'frostedglass', { opacity: 0 })) === sha(S) && sha(D(S, 'shatter', { displacement: 0, rotation: 0, crackLines: 0 })) === sha(S)
    && sha(D(S, 'vitrine', { reflection: 0, frame: 0, tint: '#ffffff' })) === sha(S) && sha(D(S, 'flutedglass', { refractionStrength: 0, shading: 0 })) === sha(S) && sha(D(flat, 'flutedglass', { shading: 0 })) === sha(flat));
  const tg = D(S, 'stainedglass', { leadThickness: 0, backlight: 0, cellCount: 60 }); const TV = voronoi(W, H, Math.sqrt((W * H) / 60), 0.85, 1 * 13 + 1); const first = new Map<number, string>(); let flatPanes = true;
  for (let q = 0; q < W * H; q++) { const c = tg.data.slice(q * 4, q * 4 + 3).join(); const f = first.get(TV.id[q]); if (f === undefined) first.set(TV.id[q], c); else if (f !== c) flatPanes = false; }
  ok('Tinted Glass: bez olowiu i podswietlenia kazda szyba (komorka Voronoi, seed 1) ma jeden kolor; rozne szyby rozne kolory', flatPanes && colorsOf(tg) > first.size * 0.8, `${first.size} szyb, ${colorsOf(tg)} kolorow`);
  const vr = newImg(W, H, [0, 0, 0, 255]); for (let y = 0; y < H; y++) vr.data.fill(Math.round((y / (H - 1)) * 255), y * W * 4, (y + 1) * W * 4); for (let k = 3; k < vr.data.length; k += 4) vr.data[k] = 255;
  const go = D(vr, 'glassorb', { backgroundBlur: 0, highlight: 0, radius: 40 }); const at = (x: number, y: number) => go.data[(y * W + x) * 4];
  let outside = true; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x + 0.5 - 80, y + 0.5 - 60) > 49 && go.data[(y * W + x) * 4] !== vr.data[(y * W + x) * 4]) outside = false;
  ok('Glass Orb: poza kula bez zmian (bez rozmycia tla); w kuli obraz odwrocony (rampa pionowa: nad srodkiem jasniej niz pod)', outside && at(80, 40) > at(80, 80), `${at(80, 40)} ${at(80, 80)}`);
  const lg = (t: string, seed = 1) => sha(D(S, 'liquidglass', { texture: t, seed }));
  ok('Liquid Glass: 10 tekstur daje 10 roznych obrazow; seed zmienia tekstury losowe (hammered), nie zmienia regularnych (cross)', new Set(['cross', 'hammered', 'diamond', 'hexagon', 'ripple', 'crackle', 'chevron', 'seedy', 'pixel', 'jello'].map((t) => lg(t))).size === 10 && lg('hammered', 1) !== lg('hammered', 2) && lg('cross', 1) === lg('cross', 2));
}
// 32. Krok 9, Faza 3: material i faktura (po jednej kluczowej wlasnosci na efekt)
{
  const W = 160, H = 120; const D = (src: Img, id: string, p: any = {}) => render(src, { style: { id, params: p } }).img; const S = testImage(W, H); const flat = newImg(W, H, [180, 110, 60, 255]);
  ok('Material: parametry zerowe = bez zmian (Waves bez amplitudy, Emboss w kolorze obrazu na plaskim, Oil Paint bez impasto/odblasku na plaskim)', sha(D(S, 'waves', { amplitude: 0 })) === sha(S) && sha(D(flat, 'emboss', { baseColorMode: 'image' })) === sha(flat) && sha(D(flat, 'oilpaint', { impasto: 0, specular: 0 })) === sha(flat));
  ok('Material: plaski obraz -> jednolity wynik (Emboss szary 128, Chrome, Thin-Film bez szumu, Molten bez plyniecia, Watercolor bialy bez papieru = kolor papieru)', (() => { const e = D(flat, 'emboss'); return colorsOf(e) === 1 && e.data[0] === 128; })() && colorsOf(D(flat, 'chrome')) === 1 && colorsOf(D(flat, 'thinfilm', { noise: 0 })) === 1 && colorsOf(D(flat, 'molten', { flow: 0 })) === 1
    && (() => { const wc = D(newImg(W, H, [255, 255, 255, 255]), 'watercolor', { paperGrain: 0 }); return colorsOf(wc) === 1 && [0, 1, 2].every((q) => Math.abs(wc.data[q] - parseColor('#f6f1e6')[q]) <= 1); })());
  const cr = D(S, 'crystallize', { bevelShading: 0, edge: 0 }); const CV = voronoi(W, H, 18, 0.9, 1 * 19 + 2); const first = new Map<number, string>(); let flatCells = true;
  for (let q = 0; q < W * H; q++) { const c = cr.data.slice(q * 4, q * 4 + 3).join(); const f = first.get(CV.id[q]); if (f === undefined) first.set(CV.id[q], c); else if (f !== c) flatCells = false; }
  ok('Crystallize: bez fazy i krawedzi kazdy krysztal (komorka Voronoi) ma jeden kolor', flatCells, `${first.size} komorek`);
  const mb = D(S, 'marble', { contrast: 100 }), mb0 = D(S, 'marble', { contrast: 0 }); ok('Marble: wieksza wartosc "Image contrast" -> wynik bardziej skorelowany z jasnoscia obrazu', (() => { const corr = (a: Img) => { let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; const n = W * H; for (let q = 0; q < n; q++) { const x = lum(S.data[q * 4], S.data[q * 4 + 1], S.data[q * 4 + 2]), y = lum(a.data[q * 4], a.data[q * 4 + 1], a.data[q * 4 + 2]); sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; } return (sxy / n - (sx / n) * (sy / n)) / Math.sqrt((sxx / n - (sx / n) ** 2) * (syy / n - (sy / n) ** 2)); }; return corr(mb) > corr(mb0) + 0.2; })());
}
// 33. Etap 2, krok 2: model animacji (faza φ, rejestr ruchów) na przykładzie RGB Split „pulse”
{
  const { readFileSync } = await import('node:fs'); const J = JSON.parse(readFileSync('src/data/effects.json', 'utf8')) as any[];
  const badM: string[] = []; for (const e of EFFECTS) { const ms = e.motions ?? []; if (new Set(ms.map((m) => m.id)).size !== ms.length) badM.push(`${e.id} dup`); for (const m of ms) for (const p of m.params) if (p.kind === 'range' && !(p.default >= p.min! && p.default <= p.max!)) badM.push(`${e.id}.${m.id}.${p.id}`); }
  ok('ruchy: unikalne id w efekcie, domyślne parametry w zakresach; effects.json animated/motions zgodne z rejestrem', badM.length === 0 && EFFECTS.every((e) => { const j = J.find((x) => x.id === e.id); return j.animated === !!e.motions?.length && JSON.stringify(j.motions) === JSON.stringify((e.motions ?? []).map((m) => ({ id: m.id, name: m.name }))); }), badM.join(', '));
  ok('ruchy: nieznany ruch i faza nieskończona rzucają błąd', (() => { try { render(SRC, { style: { id: 'rgbsplit' }, motion: { id: 'nope' } }); return false; } catch { /* ok */ } try { render(SRC, { style: { id: 'rgbsplit' }, motion: { id: 'pulse' } }, { phase: NaN }); return false; } catch { return true; } })());
  const RS = (img: Img, phase?: number, mp: any = {}, scale = 1, sp: any = {}) => render(img, { style: { id: 'rgbsplit', params: sp }, ...(phase === undefined ? {} : { motion: { id: 'pulse', params: mp } }) }, { phase, scale }).img;
  const S = testImage(160, 120); const st = sha(RS(S));
  ok('RGB Split pulse: φ = 0 (jawnie i domyślnie) = obraz statyczny bit w bit; ta sama φ = ten sam obraz', sha(RS(S, 0)) === st && sha(render(S, { style: { id: 'rgbsplit' }, motion: { id: 'pulse' } }).img) === st && sha(RS(S, 0.37)) === sha(RS(S, 0.37)));
  ok('RGB Split pulse: okresowość: φ = 1, 2 i 3 (speed 3) = φ = 0 bit w bit', sha(RS(S, 1)) === st && sha(RS(S, 2)) === st && sha(RS(S, 1, { speed: 3 })) === st);
  const md = (a: Img, b: Img) => { let m = 0; for (let k = 0; k < a.data.length; k++) m = Math.max(m, Math.abs(a.data[k] - b.data[k])); return m; };
  const per = [0.1, 0.25, 0.5, 0.8].map((f) => md(RS(S, f, { speed: 2 }), RS(S, f + 1, { speed: 2 })));
  ok('RGB Split pulse: φ i φ + 1 (speed 2, 4 fazy) bit w bit (próg 0 = pomiar; dopuszczałem ±1 na różnice cos w ostatnich bitach, nie wystąpiły)', Math.max(...per) === 0, `max różnica: ${per.join(', ')}`);
  const line = newImg(160, 40, [0, 0, 0, 255]); for (let y = 0; y < 40; y++) line.data.fill(255, (y * 160 + 80) * 4, (y * 160 + 80) * 4 + 3);
  const peak = (img: Img, c: number) => { let b = 0, bx = -1; for (let x = 0; x < img.w; x++) { const v = img.data[(20 * img.w + x) * 4 + c]; if (v > b) { b = v; bx = x; } } return bx; };
  const at = (f: number, sc = 1) => { const o = RS(line, f, { intensity: 60 }, sc); return [peak(o, 0), peak(o, 1), peak(o, 2)]; };
  const a0 = at(0), a5 = at(0.5), a25 = at(0.25), s2 = at(0.5, 2);
  ok('RGB Split pulse: przesunięcie R/B zgodne ze wzorem: φ 0 → ±10 px, φ 0,5 → ±4 px, φ 0,25 → ±7 px; G na miejscu; @2x → ±8 px', a0.join() === '90,80,70' && a5.join() === '84,80,76' && a25.join() === '87,80,73' && s2[1] >= 160 && s2[1] <= 161 && s2[0] - s2[1] === 8 && s2[1] - s2[2] === 8, `${a0} | ${a5} | ${a25} | @2x ${s2}`);
  ok('RGB Split pulse: intensity 0 = brak ruchu (każda faza = obraz statyczny)', [0.2, 0.5, 0.9].every((f) => sha(RS(S, f, { intensity: 0 })) === st));
  ok('RGB Split pulse: 32 fazy z [0, 1): wymiary i alfa jak w źródle', Array.from({ length: 32 }, (_, i) => RS(S, i / 32)).every((o) => o.w === 160 && o.h === 120 && o.data.every((v, k) => k % 4 !== 3 || v === S.data[k])));
}
// 34. Etap 2, Tier A: własności wspólne dla każdego ruchu w rejestrze + po jednej własności na efekt
{
  const S = testImage(160, 120); const W = 160, H = 120;
  const R = (img: Img, id: string, mid: string | null, phase?: number, mp: any = {}, scale = 1, sp: any = {}) => render(img, { style: { id, params: sp }, ...(mid ? { motion: { id: mid, params: mp } } : {}) }, { phase, scale, glyphs: G });
  const md = (a: Img, b: Img) => { let m = 0; for (let k = 0; k < a.data.length; k++) m = Math.max(m, Math.abs(a.data[k] - b.data[k])); return m; };
  const rows: string[] = []; const bad: string[] = []; const perDiff: Record<string, number> = {};
  for (const e of EFFECTS) for (const m of e.motions ?? []) {
    const key = `${e.id}.${m.id}`; const st = R(S, e.id, null).img; const z = R(S, e.id, m.id, 0).img; const q = R(S, e.id, m.id, 0.25).img;
    if (sha(z) !== sha(st)) bad.push(`${key}: φ0≠statyczny`);
    perDiff[key] = Math.max(...[0.1, 0.25, 0.6].map((f) => md(R(S, e.id, m.id, f).img, R(S, e.id, m.id, f + 1).img)));
    if (sha(R(S, e.id, m.id, 1).img) !== sha(st)) bad.push(`${key}: φ1≠φ0`);
    if (sha(q) === sha(st)) bad.push(`${key}: brak ruchu przy φ 0,25`);
    if (sha(R(S, e.id, m.id, 0.37).img) !== sha(R(S, e.id, m.id, 0.37).img)) bad.push(`${key}: niedeterministyczny`);
    if (!q.data.every((v, k) => k % 4 !== 3 || v === S.data[k]) || q.w !== W || q.h !== H) bad.push(`${key}: alfa/wymiary`);
    if (m.params.some((p) => p.id === 'speed') && sha(R(S, e.id, m.id, 0.5, { speed: 2 }).img) !== sha(st)) bad.push(`${key}: speed 2 → φ 0,5 ≠ statyczny`);
    const i1 = R(S, e.id, m.id, 0.3).info, i2 = R(S, e.id, m.id, 0.3, {}, 2).info; if (JSON.stringify(i1) !== JSON.stringify(i2)) bad.push(`${key}: komórki @2x ≠ @1x ${JSON.stringify(i1)} ${JSON.stringify(i2)}`);
    rows.push(key);
  }
  ok(`ruchy (${rows.length}): φ 0 = statyczny bit w bit; φ 1 = φ 0; φ 0,25 ≠ statyczny (ruch jest); determinizm; alfa i wymiary; speed 2 → okres 1/2; komórki @2x = @1x`, bad.length === 0, bad.join('; ') || rows.join(', '));
  ok('ruchy: φ i φ + 1 (fazy 0,1 / 0,25 / 0,6) bit w bit dla każdego ruchu (próg 0 = pomiar)', Object.values(perDiff).every((v) => v === 0), JSON.stringify(perDiff));
  const flat = newImg(W, H, [200, 200, 200, 255]); const rowsOf = (img: Img) => Array.from({ length: H }, (_, y) => img.data[(y * W + 5) * 4]);
  const sc0 = rowsOf(R(flat, 'scanline', null).img), sc1 = rowsOf(R(flat, 'scanline', 'roll', 0.2).img);   /* okres 3 + 2 = 5 px, φ 0,2 = 1 px */
  ok('Scanline roll: φ 0,2 przy okresie 5 px = wzór przesunięty o 1 wiersz (wiersz y = statyczny y + 1)', sc1.slice(0, H - 1).every((v, y) => v === sc0[y + 1]) && sc1.join() !== sc0.join());
  ok('Twirl oscillate (100%): φ 0,5 = statyczny Twirl z amount −120 (bit w bit)', sha(R(S, 'twirl', 'oscillate', 0.5).img) === sha(R(S, 'twirl', null, undefined, {}, 1, { amount: -120 }).img));
  const red = newImg(W, H, [255, 0, 0, 255]); const dr = R(red, 'disco', 'hue', 1 / 3).img.data; const gray = newImg(W, H, [120, 120, 120, 255]);
  ok('Disco hue: szarość bez zmian w każdej fazie; czerwień po 1/3 cyklu (120°) → zieleń', [0.2, 0.5, 0.8].every((f) => sha(R(gray, 'disco', 'hue', f).img) === sha(R(gray, 'disco', null).img)) && dr[1] > 200 && dr[0] < 40 && dr[2] < 40, `${dr[0]},${dr[1]},${dr[2]}`);
  const pz = R(S, 'pixel', 'breathe', 0.5).info, p0 = R(S, 'pixel', null).info;
  ok('Pixel Art breathe (50%): φ 0,5 → blok 12 → 6 px: 27×20 komórek zamiast 14×10', pz.cols === 27 && pz.rows === 20 && p0.cols === 14 && p0.rows === 10, `${JSON.stringify(pz)} ${JSON.stringify(p0)}`);
  const fg = (f?: number) => R(newImg(W, H, [150, 150, 150, 255]), 'flutedglass', f === undefined ? null : 'slide', f, {}, 1, { fluteWidth: 24 }).img; const fa = fg(1 / 3), fb = fg();
  ok('Fluted Glass slide: żłobki (soczewki) przesuwają się, obraz nie: na płaskim obrazie wzór cieniowania po 1/3 pętli = statyczny przesunięty o 8 px (1/3 z 24 px)', (() => { for (let y = 0; y < H; y += 7) for (let x = 0; x < W - 8; x++) if (fa.data[(y * W + x) * 4] !== fb.data[(y * W + x + 8) * 4]) return false; return sha(fa) !== sha(fb); })());
}
// 35. Etap 2, krok 6: glint i scan rodziny ASCII (zachowanie wg ascii.rest, logo-file.ts)
{
  const W = 160, H = 120; const S = testImage(W, H); const st = (id: string, mid?: string, phase?: number, mp: any = {}) => renderText(S, { style: { id }, ...(mid ? { motion: { id: mid, params: mp } } : {}) }, { phase, glyphs: G })!.split('\n');
  const img = (id: string, mid?: string, phase?: number, mp: any = {}) => render(S, { style: { id }, ...(mid ? { motion: { id: mid, params: mp } } : {}) }, { phase, glyphs: G }).img;
  const base = st('characters'); const cw = 6, ch = 10;
  ok('glint/scan: eksport tekstowy przy φ 0 = statyczny (Characters, Block, Braille, Mixed); w przerwie między przejściami (φ 0,75 przy pass 50%) obraz i tekst = statyczne', ['characters', 'block-chars', 'braille', 'mixed'].every((id) => st(id, 'glint', 0).join() === st(id).join() && st(id, 'scan', 0).join() === st(id).join() && st(id, 'scan', 0.75).join() === st(id).join()) && sha(img('dots', 'glint', 0.75)) === sha(img('dots')));
  /* glint w połowie przejścia (φ 0,25 przy pass 50% → f 0,5): środek pasu `at` wg wzoru z grid.ts */
  const half = 5 * cw, at = -half + (W + 0.45 * H + 2 * half) * 0.5; const g = st('characters', 'glint', 0.25); const changed: [number, number, string][] = [];
  for (let y = 0; y < base.length; y++) for (let x = 0; x < base[y].length; x++) if (g[y][x] !== base[y][x]) changed.push([x, y, g[y][x]]);
  const inBand = changed.every(([x, y]) => Math.abs((x + 0.5) * cw + 0.45 * (y + 0.5) * ch - at) < half);
  ok('glint (Characters): zmienione znaki tylko na „/”, tylko w ukośnym pasie (|x + 0,45·y − środek| < połowa szerokości), nigdy w miejscu spacji; pas niepusty', changed.length > 5 && changed.every(([x, y, c]) => c === '/' && base[y][x] !== ' ') && inBand, `${changed.length} zmian`);
  const sc = st('characters', 'scan', 0.25); const row = -2 + (base.length - 1 + 2 + 5) * 0.5; const NZ = '#$%&*+<=>?@[]{}'; let headInk = 0, headCh = 0, bad = 0;
  for (let y = 0; y < base.length; y++) for (let x = 0; x < base[y].length; x++) { const d = row - y; const head = d >= 0 && d < 2; if (head && base[y][x] !== ' ') { headInk++; if (sc[y][x] !== base[y][x]) headCh++; } if (sc[y][x] !== base[y][x] && (!head || !NZ.includes(sc[y][x]))) bad++; }
  ok('scan (Characters): zmiany tylko w 2 wierszach głowy i tylko na znaki szumu #$%&*+<=>?@[]{}; zmieniona część znaków głowy ≈ 3/4 (0,55–0,95)', bad === 0 && headInk > 10 && headCh / headInk > 0.55 && headCh / headInk < 0.95, `${headCh}/${headInk}`);
  ok('scan: szum zmienia się w czasie (12 tików na przejście): φ 0,25 i φ 0,27 mają inny szum lub inną linię', st('characters', 'scan', 0.25).join() !== st('characters', 'scan', 0.27).join());
  /* piksele: glint rozjaśnia tylko w pasie; poza pasem obraz identyczny (Dots, kształty rysowane) */
  const d0 = img('dots'), d1 = img('dots', 'glint', 0.25); let out = 0, inn = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const cx = Math.floor(x / 10), cy = Math.floor(y / 10); const dist = Math.abs((cx + 0.5) * 10 + 0.45 * (cy + 0.5) * 10 - (-50 + (W + 0.45 * H + 100) * 0.5)); const i = (y * W + x) * 4; const diff = d0.data[i] !== d1.data[i] || d0.data[i + 1] !== d1.data[i + 1]; if (diff) { if (dist >= 50) out++; else inn++; } }
  ok('glint (Dots, kształty): piksele zmieniają się tylko w komórkach pasu (komórka 10 px, połowa szerokości 5 komórek), w pasie są zmiany', out === 0 && inn > 100, `poza ${out}, w pasie ${inn}`);
  const mono = (phase?: number) => render(S, { style: { id: 'characters', params: { colorMode: 'mono', inkColor: '#808080', bgMode: 'solid', bgColor: '#000000' } }, ...(phase === undefined ? {} : { motion: { id: 'glint' } }) }, { phase, glyphs: G }).img;
  const m0 = mono(), m1 = mono(0.25); const g1 = renderText(S, { style: { id: 'characters', params: { colorMode: 'mono', inkColor: '#808080' } }, motion: { id: 'glint' } }, { phase: 0.25, glyphs: G })!.split('\n');
  const ratios: number[] = []; for (let cy = 0; cy < base.length; cy++) for (let cx = 0; cx < base[cy].length; cx++) { if (g1[cy][cx] !== base[cy][cx] || base[cy][cx] === ' ') continue;
    let a0 = 0, a1 = 0; for (let y = cy * ch; y < Math.min(H, (cy + 1) * ch); y++) for (let x = cx * cw; x < Math.min(W, (cx + 1) * cw); x++) { a0 = Math.max(a0, m0.data[(y * W + x) * 4]); a1 = Math.max(a1, m1.data[(y * W + x) * 4]); } if (a0 > 60) ratios.push(a1 / a0); }
  const ok3 = ratios.every((r) => [1, 172 / 128, 217 / 128].some((k) => Math.abs(r - k) < 0.03));
  ok('glint rozjaśnia kolor tuszu (tusz #808080, ten sam znak w komórce): jasność × 1, × 172/128 (35%) albo × 217/128 (70%); są komórki rozjaśnione', ok3 && ratios.some((r) => r > 1.3) && ratios.some((r) => r > 1.6), `${ratios.length} komórek, ${[...new Set(ratios.map((r) => r.toFixed(2)))].join(' ')}`);
  let thrown = ''; try { render(S, { style: { id: 'dots' }, motion: { id: 'glint' } }, { phase: 0.25 }); } catch (e) { thrown = (e as Error).message; }
  ok('glint/scan bez dostawcy glifów: czytelny błąd (zamiana na znaki wymaga czcionki)', thrown.includes('glyph provider'), thrown);
}
// 36. Etap 2, krok 6C: eksport TS (piece ascii.rest). Plik zapisany do katalogu tymczasowego i zaimportowany (Node usuwa typy).
{
  const { pieceGrid, pieceSource, pieceBadChars, PIECE_START, renderCells } = await import('../src/index.ts');
  const { mkdtempSync, writeFileSync: wf } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'piece-')); const S6 = testImage(600, 400); const LOOP = 4, N = 60;
  const hex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  for (const [id, m, p] of [['characters', 'glint', { speed: 1, pass: 50, width: 5 }], ['characters', 'scan', { speed: 2, pass: 40 }], ['block-chars', 'glint', { speed: 1, pass: 50, width: 5 }]] as const) {
    const motion = { id: m, params: p }; const g = pieceGrid(S6, { style: { id }, motion });
    const r = pieceSource(g.base, { name: `${id} ${m}`, note: 'a test picture', motion: { id: m, p: { ...p } }, loop: LOOP, fps: 30 });
    const f = join(dir, `${r.slug}.ts`); wf(f, r.code); const mod = await import(f); const frame = mod.default({}); const meta = mod.meta; const n = meta.palette.length / 6;
    let badText = 0, badLevel = 0, badInk = 0, moving = 0; const color = new Uint8Array(meta.cols * meta.rows);
    const base = g.base; const B = (i: number) => [base.rgb[i * 3], base.rgb[i * 3 + 1], base.rgb[i * 3 + 2]];
    for (let k = 0; k < N; k++) {
      const e = renderCells(S6, { ...g.state, motion }, { phase: k / N })!; const txt = frame(PIECE_START + (k * LOOP) / N, { color });
      if (txt !== e.text.join('\n')) badText++; if (e.text.join('\n') !== base.text.join('\n')) moving++;
      for (let i = 0; i < meta.cols * meta.rows; i++) {
        if (base.text[Math.floor(i / meta.cols)][i % meta.cols] === ' ') continue;
        /* poziom z silnika: kolor komórki w fazie k = baza rozjaśniona o 0, 35% albo 70%. Silnik rozjaśnia średnią przed zaokrągleniem,
           a baza w CellGrid jest już zaokrąglona, więc ±1 (różnica zaokrągleń, nie próg dobrany do wyniku). Biel pasuje do każdego
           poziomu, więc poziom pliku ma być jednym z pasujących */
        const lvs = [0, 1, 2].filter((l) => B(i).every((v, j) => Math.abs(v + (255 - v) * [0, 0.35, 0.7][l] - e.rgb[i * 3 + j]) <= 1));
        const c = color[i] - 3 * n; const lv = Math.floor(c / n); if (!lvs.includes(lv)) badLevel++;
        const pc = meta.palette[3 * n + c].slice(1).match(/../g)!.map((h: string) => parseInt(h, 16)); const q = meta.palette[3 * n + (c % n)].slice(1).match(/../g)!.map((h: string) => parseInt(h, 16));
        if (hex(q.map((v: number) => Math.round(v + (255 - v) * [0, 0.35, 0.7][lv]))) !== hex(pc)) badInk++;
      }
    }
    ok(`TS ${id}.${m}: tekst klatki pliku w chwili START + k·loop/N = tekst silnika w fazie k/N, ${N} z ${N} (ruch widać w ${moving} klatkach)`, badText === 0 && moving > 5, `złych ${badText}`);
    ok(`TS ${id}.${m}: kolor komórki z env.color: poziom odcienia (0/35/70%) taki jak w silniku, kolor = kolor obrazu z palety rozjaśniony o ten poziom`, badLevel === 0 && badInk === 0, `poziom ${badLevel}, kolor ${badInk}`);
    ok(`TS ${id}.${m}: meta wg checkera biblioteki (kategoria, note ≤ 72, ≤ 80×32, fps 0–60, paleta 2–64 #rrggbb = 6 × ${n} ≤ 60, ground, loop, still 0); tylko import type; bez Math.random i DOM`,
      meta.category === 'effects' && meta.note.length <= 72 && meta.cols <= 80 && meta.rows <= 32 && Number.isInteger(meta.fps) && meta.palette.length === 6 * n && n <= 10 && meta.palette.every((c: string) => /^#[0-9a-f]{6}$/.test(c)) && /^#[0-9a-f]{6}$/.test(meta.ground) && meta.loop === LOOP && meta.still === 0
      && !/^\s*import\s(?!type\s)/m.test(r.code) && !/Math\.random|\b(document|window|requestAnimationFrame|localStorage|navigator|globalThis)\b/.test(r.code), `${meta.cols}x${meta.rows}, ${n} kolorów`);
    const again = mod.default({}); ok(`TS ${id}.${m}: deterministyczny (dwie instancje dają te same klatki)`, [0, 1, 2.5, 5].every((t) => again(t) === frame(t)));
  }
  /* dopasowanie siatki: 600×400, Characters cellSize 10 → 100×40 > 80×32; po zmianie mieści się, a o 1 px mniejsza komórka już nie */
  const g = pieceGrid(S6, { style: { id: 'characters' } }); const smaller = renderCells(S6, { style: { id: 'characters', params: { cellSize: g.cellSize - 1 } } })!;
  ok('TS: siatka 100×40 zmniejszona do ≤ 80×32 przez Cell size; najmniejsza komórka, która się mieści (o 1 px mniej już nie)', g.from.cols === 100 && g.from.rows === 40 && g.base.cols <= 80 && g.base.rows <= 32 && (smaller.cols > 80 || smaller.rows > 32), `${g.base.cols}x${g.base.rows}, cellSize ${g.from.cellSize} → ${g.cellSize}`);
  const small = pieceGrid(testImage(300, 200), { style: { id: 'characters' } }); ok('TS: siatka mieszcząca się w 80×32 bez zmian (50×20, Cell size 10)', small.base.cols === 50 && small.base.rows === 20 && small.cellSize === 10, `${small.base.cols}x${small.base.rows}`);
  /* kategoria scenes (decyzja użytkownika: zdjęcia dokładniej): do 320×120, wymaga ≥ 4 kolorów tuszu; mniej kolorów → effects */
  const { pieceFit } = await import('../src/index.ts');
  const sc = pieceFit(S6, { style: { id: 'characters' }, motion: { id: 'glint' } });
  const rs = pieceSource(sc.base, { name: 'scene test', note: 'a test picture', motion: { id: 'glint', p: { speed: 1, pass: 50, width: 5 } }, loop: LOOP, fps: 30, category: sc.category });
  const fs = join(dir, `${rs.slug}.ts`); wf(fs, rs.code); const ms = await import(fs); const frs = ms.default({}); let badS = 0;
  for (let k = 0; k < N; k += 3) if (frs(PIECE_START + (k * LOOP) / N) !== renderCells(S6, { ...sc.state, motion: { id: 'glint' } }, { phase: k / N })!.text.join('\n')) badS++;
  ok('TS scenes: obraz testowy (kolorowy) → kategoria scenes, siatka 100×40 bez zmniejszania, ≥ 4 kolory; klatki pliku = silnik', sc.category === 'scenes' && ms.meta.category === 'scenes' && ms.meta.cols === 100 && ms.meta.rows === 40 && rs.colors >= 4 && badS === 0, `${sc.category} ${ms.meta.cols}x${ms.meta.rows}, ${rs.colors} kolorów, złych ${badS}`);
  const big = pieceFit(S6, { style: { id: 'characters', params: { cellSize: 3 } } }); const big1 = renderCells(S6, { style: { id: 'characters', params: { cellSize: big.cellSize - 1 } } })!;
  ok('TS scenes: siatka 300×134 (Cell size 3, komórka 2×3 px) zmniejszona do ≤ 320×120, najmniejsza komórka, która się mieści', big.category === 'scenes' && big.from.cols === 300 && big.from.rows === 134 && big.base.cols <= 320 && big.base.rows <= 120 && (big1.cols > 320 || big1.rows > 120), `${big.from.cols}x${big.from.rows} → ${big.base.cols}x${big.base.rows}, cellSize ${big.cellSize}`);
  const mono = pieceFit(S6, { style: { id: 'characters', params: { colorMode: 'mono' } } });
  let monoErr = ''; try { pieceSource(pieceGrid(S6, { style: { id: 'characters', params: { colorMode: 'mono' } } }, {}, { cols: 320, rows: 120 }).base, { name: 'x', note: 'x', motion: { id: 'scan', p: { speed: 1, pass: 50 } }, loop: 4, fps: 30, category: 'scenes' }); } catch (e) { monoErr = (e as Error).message; }
  ok('TS: obraz w jednym kolorze (mono) → kategoria effects i ≤ 80×32; jako scenes pieceSource odmawia (scena wymaga ≥ 4 kolorów)', mono.category === 'effects' && mono.base.cols <= 80 && mono.base.rows <= 32 && monoErr.includes('at least 4'), `${mono.category} ${mono.base.cols}x${mono.base.rows} | ${monoErr}`);
  const bm = pieceBadChars(pieceGrid(S6, { style: { id: 'mixed' } }).base), bb = pieceBadChars(renderCells(testImage(300, 200), { style: { id: 'braille' } })!);
  let thr = ''; try { pieceSource(pieceGrid(S6, { style: { id: 'mixed' } }).base, { name: 'x', note: 'x', motion: { id: 'scan', p: { speed: 1, pass: 50 } }, loop: 4, fps: 30 }); } catch (e) { thr = (e as Error).message; }
  ok('TS: znaki spoza zestawu biblioteki wykryte (Mixed domyślnie: ∙; Braille: U+28xx) i pieceSource odmawia', bm.includes('∙') && [...bb].every((c) => c.codePointAt(0)! >= 0x2800 && c.codePointAt(0)! <= 0x28ff) && bb.length > 0 && thr.includes('outside'), `${bm} | ${bb.length} znaków Braille | ${thr}`);
}
// 37. Etap 2, Tier B: po jednej własności na efekt (wartości oczekiwane ze wzorów ruchu, nie z pomiaru)
{
  const W = 160, H = 120; const R = (img: Img, id: string, mid: string | null, phase?: number, mp: any = {}, sp: any = {}) => render(img, { style: { id, params: sp }, ...(mid ? { motion: { id: mid, params: mp } } : {}) }, { phase, glyphs: G }).img;
  const flat = (v: number) => newImg(W, H, [v, v, v, 255]); const S = testImage(W, H);
  /* Dither flow: na płaskiej szarości wynik zależy tylko od progu, więc przesunięty wzór = statyczny wzór przesunięty. tiles 3 × kafel 8 = 24 px na cykl, φ 1/24 → 1 px w prawo (E) */
  const g = flat(128); const d0 = R(g, 'dither', null).data, d1 = R(g, 'dither', 'flow', 1 / 24, { direction: 'e' }).data; let sh = 0, diff = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) { if (d1[(y * W + x) * 4] !== d0[(y * W + x + 1) * 4]) sh++; if (d1[(y * W + x) * 4] !== d0[(y * W + x) * 4]) diff++; }
  ok('Dither flow (Bayer 8×8, E): na płaskiej szarości φ 1/24 = wzór statyczny przesunięty o 1 px (piksel x = statyczny x + 1)', sh === 0 && diff > 0, `niezgodnych ${sh}, zmienionych ${diff}`);
  /* Dither shimmer: próg przesuwa się o u cyklu; na płaskiej szarości w obrazie 160×120 (wielokrotność kafla 8) zestaw progów się nie zmienia, więc liczba jasnych pikseli też */
  const white = (img: Uint8ClampedArray) => { let n = 0; for (let i = 0; i < img.length; i += 4) if (img[i] > 127) n++; return n; };
  const shm = [0.25, 0.5, 0.75].map((f) => R(g, 'dither', 'shimmer', f).data);
  ok('Dither shimmer: na płaskiej szarości liczba jasnych pikseli w każdej fazie = statyczna (ten sam zestaw progów), a wzór się zmienia', shm.every((x) => white(x) === white(d0)) && shm.some((x) => sha({ w: W, h: H, data: x }) !== sha({ w: W, h: H, data: d0 })), `${white(d0)} / ${shm.map(white).join(' ')}`);
  const fl = [0.1, 0.4, 0.8].map((f) => sha(R(S, 'dither', 'flow', f, {}, { algorithm: 'floyd' }))); const fl0 = sha(R(S, 'dither', null, undefined, {}, { algorithm: 'floyd' }));
  ok('Dither z dyfuzją błędu (Floyd–Steinberg): flow nie działa (onlyIf), każda klatka = obraz statyczny', fl.every((x) => x === fl0));
  /* LED pulse: jasność × (1 − 0,5·(1 − cos π)/2·2)… przy intensity 50 i φ 0,5: × 0,5 = statyczny z Brightness 50% */
  ok('LED Matrix pulse (intensity 50%): φ 0,5 = statyczny z Brightness 50% (bit w bit)', sha(R(S, 'ledmatrix', 'pulse', 0.5, { intensity: 50 })) === sha(R(S, 'ledmatrix', null, undefined, {}, { ledBrightness: 50 })));
  /* LED sweep: bez poświaty (glow 0) zmieniają się tylko diody w pasie: |środek komórki (x + y)/(W + H) − 0,5| < 0,15 przy φ 0,5; w pasie jaśniej */
  const ls0 = R(S, 'ledmatrix', null, undefined, {}, { glow: 0 }).data, ls1 = R(S, 'ledmatrix', 'sweep', 0.5, {}, { glow: 0 }).data; let outB = 0, inB = 0, darker = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const cx = Math.floor(x / 10), cy = Math.floor(y / 10); const s2 = ((cx + 0.5) * 10 + (cy + 0.5) * 10) / (W + H); const i = (y * W + x) * 4; const ch = ls0[i] !== ls1[i] || ls0[i + 1] !== ls1[i + 1] || ls0[i + 2] !== ls1[i + 2];
    if (ch) { if (Math.abs(s2 - 0.5) >= 0.15) outB++; else inB++; if (ls1[i] < ls0[i] || ls1[i + 1] < ls0[i + 1] || ls1[i + 2] < ls0[i + 2]) darker++; } }
  ok('LED Matrix sweep (glow 0): zmiany tylko w diodach pasa (komórka 10 px, pas ±0,15 przekątnej wokół 0,5), żadna dioda nie ciemnieje', outB === 0 && inB > 100 && darker === 0, `poza ${outB}, w pasie ${inB}, ciemniej ${darker}`);
  ok('Halftone rotate: φ 0,5 (kropki, okres 90°) = statyczny z kątem 45° + 45° = 90° (bit w bit)', sha(R(S, 'halftone', 'rotate', 0.5)) === sha(R(S, 'halftone', null, undefined, {}, { angle: 90 })));
  ok('Halftone rotate (linie, okres 180°): φ 0,25 = statyczny z kątem 45° + 45° (bit w bit)', sha(R(S, 'halftone', 'rotate', 0.25, {}, { shape: 'line' })) === sha(R(S, 'halftone', null, undefined, {}, { shape: 'line', angle: 90 })));
  const sd = Number(getEffect('glitch').params.find((q) => q.id === 'seed')!.default);
  ok('Glitch jitter (6 kroków): φ 1,5/6 (krok 1) = statyczny z ziarnem seed + 7919 (bit w bit)', sha(R(S, 'glitch', 'jitter', 1.5 / 6)) === sha(R(S, 'glitch', null, undefined, {}, { seed: sd + 7919 })));
  const jit = new Set([0, 1, 2, 3, 4, 5].map((k) => sha(R(S, 'glitch', 'jitter', (k + 0.5) / 6)))); ok('Glitch jitter: 6 kroków = 6 różnych klatek', jit.size === 6, String(jit.size));
  /* CRT refresh (curvature 0, flicker 0): φ 0,5 → pas o środku −h/8 + (h + h/4)·0,5 = −15 + 75 = 60, połowa szerokości h/8 = 15; poza pasem wiersze bez zmian, w pasie jaśniej */
  const c0 = R(S, 'crt', null, undefined, {}, { curvature: 0, flicker: 0 }).data, c1 = R(S, 'crt', 'refresh', 0.5, {}, { curvature: 0, flicker: 0 }).data; let rOut = 0, rIn = 0, rDark = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; for (let q = 0; q < 3; q++) if (c0[i + q] !== c1[i + q]) { if (Math.abs(y + 0.5 - 60) >= 15) rOut++; else rIn++; if (c1[i + q] < c0[i + q]) rDark++; } }
  ok('CRT refresh (curvature 0, flicker 0): zmiany tylko w wierszach pasa (środek 60, ±15), tam jaśniej', rOut === 0 && rIn > 100 && rDark === 0, `poza ${rOut}, w pasie ${rIn}, ciemniej ${rDark}`);
  const fk = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((k) => sha(R(S, 'crt', 'flicker', (k + 0.5) / 8)))); ok('CRT flicker: 8 kroków = 8 różnych klatek', fk.size === 8, String(fk.size));
  /* Waves flow: frequency 10 na 160 px → długość fali 16 px; φ 0,5 przesuwa fazę o π, czyli falę o 8 px. Na płaskim obrazie cieniowanie zależy tylko od fazy,
     więc piksel x przy φ 0,5 = statyczny x + 8. Różnica do 1 poziomu: k·(u + 8) i k·u − π różnią się w ostatnich bitach (zaokrąglenie do bajtu) */
  const wv0 = R(flat(150), 'waves', null).data, wv1 = R(flat(150), 'waves', 'flow', 0.5).data; let wmax = 0, wch = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W - 8; x++) { const i = (y * W + x) * 4, j = (y * W + x + 8) * 4; wmax = Math.max(wmax, Math.abs(wv1[i] - wv0[j])); if (wv1[i] !== wv0[i]) wch++; }
  ok('Waves flow: na płaskim obrazie φ 0,5 = fala przesunięta o pół długości (8 px przy 16 px), różnica ≤ 1 poziom (zaokrąglenie)', wmax <= 1 && wch > 100, `max ${wmax}, zmienionych ${wch}`);
  const rz = [0.2, 0.5, 0.9].map((f) => sha(R(S, 'risograph', 'drift', f, {}, { misregistration: 0, grain: 0 }))); const rz0 = sha(R(S, 'risograph', null, undefined, {}, { misregistration: 0, grain: 0 }));
  ok('Risograph drift: bez przesunięcia i ziarna (0, 0) nic się nie rusza: każda klatka = statyczna', rz.every((x) => x === rz0));
  const rg = [0.1, 0.4].map((f) => sha(R(S, 'risograph', 'drift', f, {}, { misregistration: 0 }))); ok('Risograph drift: przy misregistration 0 zmienia się tylko ziarno (kroki 0 i 1 różne)', rg[0] !== rg[1]);
}
// 38. Etap 2, Tier C: Engraving (rotate, swell); wartości ze wzorów ruchu
{
  const W = 160, H = 120; const flat = newImg(W, H, [128, 128, 128, 255]); const sp = { angle: 0, curvature: 0 };
  const E = (mid: string | null, phase?: number, p: any = sp) => render(flat, { style: { id: 'engraving', params: p }, ...(mid ? { motion: { id: mid } } : {}) }, { phase }).img.data;
  /* kąt 0: linie poziome (wiersz stały w x); rotate φ 0,25 = +90°: linie pionowe (kolumna stała w y). cos(π/2) ≠ 0 w liczbach zmiennoprzecinkowych
     (ok. 6e-17), więc dopuszczalna różnica 1 poziomu na granicach pikseli (zaokrąglenie), nie więcej */
  const st = E(null), r = E('rotate', 0.25); let rowVar = 0, colVar = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { rowVar = Math.max(rowVar, Math.abs(st[(y * W + x) * 4] - st[y * W * 4])); colVar = Math.max(colVar, Math.abs(r[(y * W + x) * 4] - r[x * 4])); }
  let rv = 0; for (let x = 0; x < W; x++) rv = Math.max(rv, Math.abs(r[x * 4] - r[(W >> 1) * 4]));
  ok('Engraving rotate: kąt 0 → linie poziome; φ 0,25 (¼ obrotu) → linie pionowe (kolumny stałe, ≤ 1 poziom: zaokrąglenie cos π/2), a w poziomie wzór się zmienia', rowVar === 0 && colVar <= 1 && rv > 100, `wiersze ${rowVar}, kolumny ${colVar}, zmiana w poziomie ${rv}`);
  /* swell: grubość × (1 + 0,6·sin 2πu·sin(2πv/λ)), v = x przy kącie 0, λ = 160/3. φ 0,25: tam gdzie sin(2πv/λ) > 0,5 linie grubsze (ciemniej), gdzie < −0,5 cieńsze */
  const s0 = E(null), s1 = E('swell', 0.25), s2 = E('swell', 0.5); const lam = W / 3; let up = 0, down = 0, nUp = 0, nDown = 0, half = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const sn = Math.sin((2 * Math.PI * (x + 0.5)) / lam); const dd = s0[i] - s1[i]; if (sn > 0.5) { up += dd; nUp++; } else if (sn < -0.5) { down += dd; nDown++; } half = Math.max(half, Math.abs(s2[i] - s0[i])); }
  ok('Engraving swell (60%): φ 0,25 → gdzie fala dodatnia, średnio ciemniej niż statyczny, gdzie ujemna jaśniej; φ 0,5 ≈ statyczny (sin π ≈ 1e-16: ≤ 1 poziom)', up / nUp > 5 && down / nDown < -5 && half <= 1, `ciemniej ${(up / nUp).toFixed(1)}, jaśniej ${(down / nDown).toFixed(1)}, φ0,5 ${half}`);
}
const out = res.map(([n, c, d]) => `${c ? 'OK  ' : 'FAIL'} ${n}${d ? '  [' + d + ']' : ''}`).join('\n') + '\n';
writeFileSync('reports/engine-check.txt', out); console.log(out); console.log(`${res.filter((r) => r[1]).length}/${res.length} OK`);
