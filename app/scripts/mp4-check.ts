// Etap 2, krok 4c: czyste funkcje eksportu MP4 (src/engine/mp4.ts) w Node: RGBA → I420 BT.709 (zakres tv), wymiary parzyste, bitrate.
// Kodowanie WebCodecs i kontener sprawdza editor-check.ts w Chromium (na VP9, bo Chromium z Playwrighta nie ma H.264) z ffprobe.
import { rgbaToI420, evenDims, mp4Bitrate } from '../src/engine/mp4.ts';
const res: [string, boolean, string?][] = []; const t = (n: string, ok: boolean, info?: unknown) => res.push([n, ok, info === undefined ? undefined : JSON.stringify(info)]);
const solid = (r: number, g: number, b: number) => { const d = new Uint8ClampedArray(4 * 4 * 4); for (let i = 0; i < d.length; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; } return [...rgbaToI420(d, 4, 4, 4)]; };
const yuv = (c: number[]) => [c[0], c[16], c[20]];   // Y piksela 0, U i V bloku 0 (4×4: Y 16, U 4, V 4)
// Wartości referencyjne BT.709 zakres tv (ITU-R BT.709-6, 8 bit): czerń 16/128/128, biel 235/128/128, czerwień 63/102/240,
// zieleń 173/42/26, niebieski 32/240/118 (zaokrąglenia ±1 zależnie od źródła)
const ref: [string, number[], number[]][] = [['czerń', [0, 0, 0], [16, 128, 128]], ['biel', [255, 255, 255], [235, 128, 128]], ['czerwień', [255, 0, 0], [63, 102, 240]], ['zieleń', [0, 255, 0], [173, 42, 26]], ['niebieski', [0, 0, 255], [32, 240, 118]]];
const got = ref.map(([n, rgb, want]) => { const v = yuv(solid(rgb[0], rgb[1], rgb[2])); return { n, v, ok: v.every((x, i) => Math.abs(x - want[i]) <= 1) }; });
t('RGBA → I420 BT.709 zakres tv: czerń, biel, czerwień, zieleń, niebieski = wartości referencyjne BT.709 (±1)', got.every((g) => g.ok), got);
const bt601red = [81, 90, 240];   // BT.601 dla czerwieni: wyraźnie inne Y i Cb niż BT.709 (63/102), więc test odróżnia macierze
t('macierz to BT.709, nie BT.601 (czerwień: Y 63 ≠ 81, Cb 102 ≠ 90)', Math.abs(yuv(solid(255, 0, 0))[0] - bt601red[0]) > 10);
const g = new Uint8ClampedArray(4 * 2 * 4); for (let x = 0; x < 4; x++) for (let y = 0; y < 2; y++) { const i = (y * 4 + x) * 4; g[i] = g[i + 1] = g[i + 2] = x < 2 ? 0 : 255; g[i + 3] = 255; }
const gi = [...rgbaToI420(g, 4, 4, 2)];
t('chroma 2×2 i luma per piksel: dwa bloki 2×2 czarny/biały → Y 16,16,235,235; U, V = 128 (szarości)', gi.slice(0, 4).join() === '16,16,235,235' && gi.slice(8).every((v) => v === 128), gi);
const wide = new Uint8ClampedArray(5 * 2 * 4).fill(255); const wi = rgbaToI420(wide, 5, 4, 2);
t('szerokość wiersza źródła (5 px) różna od wyjścia (4 px): ostatnia kolumna pominięta, rozmiar I420 = w·h·1,5', wi.length === 12 && [...wi.slice(0, 8)].every((v) => v === 235));
t('wymiary parzyste: 1080×831 → 1080×830, 1079×720 → 1078×720, 3×3 → 2×2', JSON.stringify([evenDims(1080, 831), evenDims(1079, 720), evenDims(3, 3)]) === '[{"w":1080,"h":830},{"w":1078,"h":720},{"w":2,"h":2}]');
t('bitrate: 8 Mb/s przy 1080×810, proporcjonalny, min 1,5 Mb/s', mp4Bitrate(1080, 810) === 8_000_000 && mp4Bitrate(540, 405) === 2_000_000 && mp4Bitrate(100, 100) === 1_500_000);
for (const [n, ok, info] of res) console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${!ok && info ? `  [${info}]` : ''}`);
console.log(`${res.filter((r) => r[1]).length}/${res.length} OK`); process.exit(res.every((r) => r[1]) ? 0 : 1);
