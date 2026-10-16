// Eksport MP4 animacji (plik 09, sekcja 6.2; krok 4c etapu 2). Działa w Workerze: WebCodecs VideoEncoder przez Mediabunny
// 1.61.0 (MPL-2.0, biblioteka bez zmian). Decyzje użytkownika: H.264; gdy przeglądarka go nie koduje, komunikat (bez fallbacku).
// Wymagania z pliku 04: wymiary parzyste (4:2:0), BT.709, zakres tv, +faststart (moov przed mdat).
// Kolory: klatkę RGBA zamieniamy sami na I420 macierzą BT.709 (zakres tv) i tak ją oznaczamy. Badanie (krok 4b) pokazało,
// że przy RGBA przeglądarka zapisywała BT.601 (smpte170m) mimo jawnego colorSpace, więc nie zostawiamy konwersji koderowi.
import { BufferTarget, Mp4OutputFormat, Output, VideoSample, VideoSampleSource, canEncodeVideo } from 'mediabunny';
import { flattenOnBlack } from './gif.ts';

export type Mp4Codec = 'avc' | 'vp9';   // 'vp9' tylko w testach automatycznych (Chromium z Playwrighta nie ma kodera H.264)

/** Wymiary parzyste dla 4:2:0: w dół do parzystej (gubimy najwyżej 1 px kolumny/wiersza z prawej/dołu). */
export const evenDims = (w: number, h: number) => ({ w: Math.max(2, w - (w & 1)), h: Math.max(2, h - (h & 1)) });
/** Bitrate (proj): 8 Mb/s przy 1080×810, proporcjonalnie do liczby pikseli, nie mniej niż 1,5 Mb/s. */
export const mp4Bitrate = (w: number, h: number) => Math.max(1_500_000, Math.round((8_000_000 * w * h) / (1080 * 810)));

/** RGBA (szerokość wiersza sw) → I420 BT.709, zakres tv: Y 16–235, Cb/Cr 16–240; chroma = średnia 2×2. Wymiary w, h parzyste. */
export function rgbaToI420(rgba: Uint8ClampedArray, sw: number, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 1.5); const U = w * h, V = U + (w * h) / 4; const kr = 0.2126, kb = 0.0722, kg = 1 - kr - kb;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    let cb = 0, cr = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = ((y + dy) * sw + x + dx) * 4; const r = rgba[i] / 255, g = rgba[i + 1] / 255, b = rgba[i + 2] / 255; const Y = kr * r + kg * g + kb * b;
      out[(y + dy) * w + x + dx] = Math.round(16 + 219 * Y); cb += (b - Y) / (2 * (1 - kb)); cr += (r - Y) / (2 * (1 - kr));
    }
    const c = (y / 2) * (w / 2) + x / 2; out[U + c] = Math.round(128 + 224 * (cb / 4)); out[V + c] = Math.round(128 + 224 * (cr / 4));
  }
  return out;
}
const BT709: VideoColorSpaceInit = { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false };

/** Czy przeglądarka zakoduje ten kodek w tych wymiarach (WebCodecs, przez Mediabunny). */
export const mp4Supported = (codec: Mp4Codec, w: number, h: number) => canEncodeVideo(codec, { width: w, height: h, bitrate: mp4Bitrate(w, h) });

export type RgbaFrame = (i: number) => Promise<Uint8ClampedArray> | Uint8ClampedArray;
/** Koduje n klatek (RGBA srcW×srcH) do MP4 w×h (parzyste, ≤ src), fps, pętla bez stanu: klatka i ma czas i/fps. */
export async function encodeMp4(frame: RgbaFrame, n: number, srcW: number, w: number, h: number, fps: number, codec: Mp4Codec,
  progress: (done: number, total: number) => void = () => {}, cancelled: () => boolean = () => false): Promise<Uint8Array> {
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const source = new VideoSampleSource({ codec, bitrate: mp4Bitrate(w, h), keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: fps }); await output.start();
  try {
    for (let i = 0; i < n; i++) {
      const d = flattenOnBlack(await frame(i)); if (cancelled()) throw new Error('CANCELLED');
      const sample = new VideoSample(rgbaToI420(d, srcW, w, h), { format: 'I420', codedWidth: w, codedHeight: h, timestamp: i / fps, duration: 1 / fps, colorSpace: BT709 });
      await source.add(sample); sample.close(); progress(i + 1, n);
    }
    await output.finalize();
  } catch (e) { await output.cancel().catch(() => {}); throw e; }
  return new Uint8Array((output.target as BufferTarget).buffer!);
}
