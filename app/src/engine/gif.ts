// Eksport GIF animacji (plik 09, sekcja 6.1; krok 4 etapu 2). Działa w Workerze. Koder: gifenc 1.0.3 (MIT).
// Decyzje użytkownika: natywny fps (12/24/30) z rozkładem opóźnień z pliku 04 (sekcja 5.4); jedna paleta globalna 256 kolorów
// z próbki klatek całej pętli, bez ditheringu; pętla w nieskończoność; dłuższy bok najwyżej 1080 px.
import * as gifenc from 'gifenc';
/* Vite bierze build ESM (nazwane eksporty), Node w testach build CommonJS (wszystko pod default): obsługujemy oba */
const G = ((gifenc as any).GIFEncoder ? gifenc : (gifenc as any).default) as typeof gifenc;
const { GIFEncoder, applyPalette, quantize } = G;

/** Opóźnienia klatek w setnych sekundy: round((i+1)·100/fps) − round(i·100/fps). Suma = dokładnie round(n·100/fps),
 *  pojedyncze opóźnienie różni się od 100/fps najwyżej o 1 cs (np. 24 fps: 4,4,4,5,…). */
export const gifDelays = (fps: number, n: number) => Array.from({ length: n }, (_, i) => Math.round(((i + 1) * 100) / fps) - Math.round((i * 100) / fps));

/** Klatki wybrane do palety: do 8 równo rozłożonych w pętli (proj). */
export const paletteFrames = (n: number, k = 8) => [...new Set(Array.from({ length: Math.min(k, n) }, (_, j) => Math.floor((j * n) / Math.min(k, n))))];

/** GIF nie ma kanału alfa (tylko 1-bitowa przezroczystość): spłaszczamy na czarnym tle, jak JPG w etapie 1. Zmienia dane w miejscu. */
export function flattenOnBlack(d: Uint8ClampedArray) {
  for (let i = 0; i < d.length; i += 4) { const a = d[i + 3]; if (a === 255) continue; const k = a / 255; d[i] = d[i] * k; d[i + 1] = d[i + 1] * k; d[i + 2] = d[i + 2] * k; d[i + 3] = 255; }
  return d;
}

export type FrameSource = (i: number) => Promise<Uint8ClampedArray> | Uint8ClampedArray;
/** Koduje n klatek w×h (RGBA). Klatki do palety są renderowane dodatkowo (pamięć: najwyżej 1 klatka + próbka ≤ 2^20 pikseli). */
export async function encodeGif(frame: FrameSource, n: number, w: number, h: number, fps: number,
  progress: (done: number, total: number) => void = () => {}, cancelled: () => boolean = () => false): Promise<Uint8Array> {
  const pf = paletteFrames(n); const total = n + pf.length; let done = 0;
  const per = Math.max(1, Math.floor((1 << 20) / pf.length)); const step = Math.max(1, Math.ceil((w * h) / per));
  const sample = new Uint8ClampedArray(pf.length * Math.ceil((w * h) / step) * 4); let o = 0;
  for (const i of pf) {
    const d = flattenOnBlack(await frame(i)); if (cancelled()) throw new Error('CANCELLED');
    for (let p = 0; p < w * h; p += step) { sample[o++] = d[p * 4]; sample[o++] = d[p * 4 + 1]; sample[o++] = d[p * 4 + 2]; sample[o++] = 255; }
    progress(++done, total);
  }
  const palette = quantize(sample.subarray(0, o), 256);
  const delays = gifDelays(fps, n); const gif = GIFEncoder();
  for (let i = 0; i < n; i++) {
    const d = flattenOnBlack(await frame(i)); if (cancelled()) throw new Error('CANCELLED');
    gif.writeFrame(applyPalette(d, palette), w, h, { palette: i === 0 ? palette : undefined, delay: delays[i] * 10, repeat: 0 });
    progress(++done, total);
  }
  gif.finish(); return gif.bytes();
}
