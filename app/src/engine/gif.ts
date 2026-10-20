// Eksport GIF animacji (plik 09, sekcja 6.1; krok 4 etapu 2). Działa w Workerze. Koder: gifenc 1.0.3 (MIT).
// Decyzje użytkownika: natywny fps (12/24/30) z rozkładem opóźnień z pliku 04 (sekcja 5.4); jedna paleta globalna 256 kolorów
// z próbki klatek całej pętli, bez ditheringu; pętla w nieskończoność; dłuższy bok najwyżej 1080 px.
// Zapis różnicowy (decyzja użytkownika po kroku 10): od drugiej klatki piksele o tym samym indeksie palety co w poprzedniej
// dostają indeks przezroczysty, a klatka ma disposal 1 (bez czyszczenia), więc przez nie widać poprzednią. Wynik po złożeniu
// jest identyczny z pełnymi klatkami. Klatkę, w której zapis różnicowy wyszedłby dłuższy (zmienia się prawie każdy piksel),
// zapisujemy w całości. Paleta ma 255 kolorów + 1 wpis na przezroczystość. gifenc 1.0.3 zawsze zapisuje klatkę
// w pełnym rozmiarze (pozycja 0,0), więc zysk pochodzi z kompresji LZW długich ciągów indeksu przezroczystego, nie z wycinka.
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

/** Dithering uporządkowany (Bayer 8×8, decyzja użytkownika: opcja, domyślnie wyłączona): przesunięcie ±amp/2 zależne tylko od
 *  pozycji piksela, więc wzór jest ten sam w każdej klatce (bez „gotowania się”, które dałaby dyfuzja błędu). Zmienia dane w miejscu. */
const BAYER8 = (() => { const m = [0, 2, 3, 1]; const b: number[] = []; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { let v = 0; for (let k = 0; k < 3; k++) { const s = 1 << k; v = v * 4 + m[(((y / s) & 1) << 1) | ((x / s) & 1)]; } b.push((v + 0.5) / 64 - 0.5); } return b; })();
export const DITHER_AMP = 24;   // proj: ok. połowa typowego odstępu kolorów palety 256 na zdjęciu (ocena okiem)
export function orderedDither(d: Uint8ClampedArray, w: number, h: number, amp = DITHER_AMP) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = BAYER8[(y & 7) * 8 + (x & 7)] * amp; const i = (y * w + x) * 4; d[i] += o; d[i + 1] += o; d[i + 2] += o; }
  return d;
}

/** Od drugiej klatki: indeksy równe poprzednim → `t` (w miejscu w `cur`); `prev` dostaje indeksy wyświetlane po tej klatce. */
export function deltaIndices(cur: Uint8Array, prev: Uint8Array, t: number) {
  for (let p = 0; p < cur.length; p++) { const c = cur[p]; if (c === prev[p]) cur[p] = t; else prev[p] = c; }
  return cur;
}

export type FrameSource = (i: number) => Promise<Uint8ClampedArray> | Uint8ClampedArray;
/** Koduje n klatek w×h (RGBA). Klatki do palety są renderowane dodatkowo (pamięć: najwyżej 1 klatka + próbka ≤ 2^20 pikseli).
 *  delta: zapis różnicowy (domyślnie); false tylko do testów porównawczych (ta sama paleta, pełne klatki). */
export async function encodeGif(frame: FrameSource, n: number, w: number, h: number, fps: number,
  progress: (done: number, total: number) => void = () => {}, cancelled: () => boolean = () => false, dither = false, delta = true): Promise<Uint8Array> {
  const pf = paletteFrames(n); const total = n + pf.length; let done = 0;
  const per = Math.max(1, Math.floor((1 << 20) / pf.length)); const step = Math.max(1, Math.ceil((w * h) / per));
  const sample = new Uint8ClampedArray(pf.length * Math.ceil((w * h) / step) * 4); let o = 0;
  for (const i of pf) {
    const d = flattenOnBlack(await frame(i)); if (cancelled()) throw new Error('CANCELLED');
    for (let p = 0; p < w * h; p += step) { sample[o++] = d[p * 4]; sample[o++] = d[p * 4 + 1]; sample[o++] = d[p * 4 + 2]; sample[o++] = 255; }
    progress(++done, total);
  }
  const colors = quantize(sample.subarray(0, o), 255); const T = colors.length;   // indeks przezroczysty: pierwszy wolny
  const palette = [...colors, [0, 0, 0]];
  const delays = gifDelays(fps, n); const gif = GIFEncoder(); const prev = new Uint8Array(w * h);
  /* od drugiej klatki: zakodowana różnicowo i w całości (osobne kodery bez nagłówka), do pliku idzie krótsza; obie po złożeniu
     dają ten sam obraz (disposal 1), więc wybór zależy tylko od rozmiaru, bez progu. Kawałki łączymy na końcu z zakończeniem 0x3B. */
  const encD = GIFEncoder({ auto: false }), encF = GIFEncoder({ auto: false }); const chunks: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const d = flattenOnBlack(await frame(i)); if (cancelled()) throw new Error('CANCELLED');
    if (dither) orderedDither(d, w, h);
    const idx = applyPalette(d, colors); const opts = { delay: delays[i] * 10, dispose: 1 };
    if (i === 0) { prev.set(idx); gif.writeFrame(idx, w, h, { ...opts, palette, repeat: 0 }); chunks.push(gif.bytes()); }
    else {
      encF.reset(); encF.writeFrame(idx, w, h, opts);
      if (delta) { encD.reset(); encD.writeFrame(deltaIndices(idx, prev, T), w, h, { ...opts, transparent: true, transparentIndex: T }); }
      else prev.set(idx);
      chunks.push((delta && encD.bytesView().length < encF.bytesView().length ? encD : encF).bytes());
    }
    progress(++done, total);
  }
  const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0) + 1); let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  out[at] = 0x3b; return out;
}
