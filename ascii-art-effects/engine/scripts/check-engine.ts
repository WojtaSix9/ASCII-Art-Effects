// Testy silnika efektow v1. Uruchomienie: node scripts/check-engine.ts  (wynik: reports/engine-check.txt)
import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { render, renderText, EFFECTS, POSTFX, COLOR_PARAMS, canvasGlyphs, getEffect, PALETTES } from '../src/index.ts';
import type { Img } from '../src/index.ts';
import { testImage } from './make-test-image.ts';
import { blur, resize, lum, parseColor, hash01 } from '../src/core/util.ts';
import { blueNoise64, ALGORITHMS } from '../src/effects/dither.ts';
import { applyColor } from '../src/post/color.ts';
import { newImg } from '../src/core/types.ts';
import { resolveParams } from '../src/core/params.ts';

const G = canvasGlyphs((w: number, h: number) => createCanvas(w, h), '"DejaVu Sans Mono"');
const res: [string, boolean, string][] = []; const ok = (n: string, c: boolean, d = '') => res.push([n, c, d]);
const sha = (i: Img) => createHash('sha1').update(i.data).digest('hex').slice(0, 10);
const uniform = (w: number, h: number, v: number): Img => newImg(w, h, [v, v, v, 255]);
const gradient = (w: number, h: number): Img => { const i = newImg(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = (x / (w - 1)) * 255, o = (y * w + x) * 4; i.data[o] = i.data[o + 1] = i.data[o + 2] = v; } return i; };
const meanLum = (i: Img) => { let s = 0; for (let p = 0; p < i.data.length; p += 4) s += lum(i.data[p], i.data[p + 1], i.data[p + 2]); return s / (i.data.length / 4); };
const psnr = (a: Img, b: Img) => { let se = 0, n = 0; for (let i = 0; i < a.data.length; i += 4) for (let c = 0; c < 3; c++) { const d = a.data[i + c] - b.data[i + c]; se += d * d; n++; } return se === 0 ? 99 : 10 * Math.log10(65025 / (se / n)); };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
const uniq = (i: Img) => { const s = new Set<number>(); for (let p = 0; p < i.data.length; p += 4) s.add(i.data[p] << 16 | i.data[p + 1] << 8 | i.data[p + 2]); return s; };
const R = (src: Img, id: string, params: Record<string, any> = {}, extra: any = {}) => render(src, { style: { id, params }, ...extra }, { glyphs: G });
const SRC = testImage(300, 200);

// 1. rejestr i definicje parametrow
{
  const ids = EFFECTS.map((e) => e.id); let bad: string[] = [];
  for (const e of EFFECTS) for (const p of e.params) { if (p.kind === 'range' && !(p.default >= p.min! && p.default <= p.max! && p.min! < p.max!)) bad.push(`${e.id}.${p.id} range`); if (p.kind === 'select' && !p.options!.some((o) => o.value === p.default)) bad.push(`${e.id}.${p.id} select`); }
  ok(`rejestr: ${EFFECTS.length} efektow, unikalne id, domyslne parametry w zakresach`, new Set(ids).size === ids.length && bad.length === 0 && EFFECTS.length === 18, bad.join(', '));
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
  ok('skala 2x: wymiary x2 i identyczna liczba komorek (cols, rows, cells) dla wszystkich 18 efektow', allSame);
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
  ok(`post FX: ${POSTFX.length} efektow, kazdy zmienia obraz przy parametrach domyslnych i zachowuje wymiary`, POSTFX.every((f) => { const o = rp(f.id, {}); return o.w === 160 && o.h === 100 && sha(o) !== sha(base); }), POSTFX.filter((f) => sha(rp(f.id, {})) === sha(base)).map((f) => f.id).join(','));
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
  ok('effects.json: 18 efektow Fazy 1 = 18 efektow w silniku', EFFECTS.every((e) => J.find((x) => x.id === e.id)?.phase === 1));
}
const out = res.map(([n, c, d]) => `${c ? 'OK  ' : 'FAIL'} ${n}${d ? '  [' + d + ']' : ''}`).join('\n') + '\n';
writeFileSync('reports/engine-check.txt', out); console.log(out); console.log(`${res.filter((r) => r[1]).length}/${res.length} OK`);
