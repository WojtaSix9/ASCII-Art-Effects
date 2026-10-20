// Strona /video (etap 2, prośba użytkownika po kroku 10): klatki filmu do efektów. Działa w Workerze: Mediabunny 1.61.0
// (MPL-2.0, biblioteka bez zmian) czyta plik (MP4, WebM, MOV…) i dekoduje go przez WebCodecs VideoDecoder.
// Decyzje użytkownika: film do 8 s (dłuższy: pierwsze 8 s i komunikat), bez dźwięku.
// Klatki są pobierane w równych odstępach 1/fps od pierwszej klatki filmu, w rozmiarze, którego dłuższy bok ma VIDEO_SIDE px,
// i trzymane w pamięci Workera jako RGBA (najwyżej 8 s × 15 fps = 120 klatek po ok. 0,5 MB).
import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';
import type { Img } from '../../../engine/src/index.ts';

export const VIDEO_MAX_SECONDS = 8;
/** Dłuższy bok klatek źródłowych (proj): 480 px wystarcza siatce znaków efektów ASCII (komórki kilka–kilkanaście px). */
export const VIDEO_SIDE = 480;
/** Błędy wczytania: brak ścieżki wideo / przeglądarka nie dekoduje tego kodeka / plik nieczytelny. */
export const NO_VIDEO = 'NO_VIDEO', NO_DECODE = 'NO_DECODE', BAD_FILE = 'BAD_FILE';

export type VideoInfo = { n: number; w: number; h: number; fps: number; duration: number; used: number; truncated: boolean; codec: string | null; srcW: number; srcH: number };

export async function decodeVideo(file: Blob, fps: number, progress: (done: number, total: number) => void, cancelled: () => boolean): Promise<{ info: VideoInfo; frames: Img[] }> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    let track;
    try { track = await input.getPrimaryVideoTrack(); } catch { throw new Error(BAD_FILE); }
    if (!track) throw new Error(NO_VIDEO);
    if (!(await track.canDecode())) throw new Error(`${NO_DECODE}:${track.codec ?? '?'}`);
    const first = await track.getFirstTimestamp(), end = await track.computeDuration();
    const duration = end - first, used = Math.min(VIDEO_MAX_SECONDS, duration);
    const n = Math.max(1, Math.floor(used * fps + 1e-6));
    const k = VIDEO_SIDE / Math.max(track.displayWidth, track.displayHeight);
    const w = Math.max(2, Math.round(track.displayWidth * k)), h = Math.max(2, Math.round(track.displayHeight * k));
    const sink = new CanvasSink(track, { width: w, height: h, fit: 'fill', poolSize: 2 });
    const frames: Img[] = []; let lastGood: Img | null = null;
    const times = Array.from({ length: n }, (_, i) => first + i / fps);
    for await (const wc of sink.canvasesAtTimestamps(times)) {
      if (cancelled()) throw new Error('CANCELLED');
      let img: Img;
      if (wc) { const g = (wc.canvas as OffscreenCanvas).getContext('2d', { willReadFrequently: true })!; img = { w, h, data: g.getImageData(0, 0, w, h).data }; lastGood = img; }
      else img = lastGood ?? { w, h, data: new Uint8ClampedArray(w * h * 4) };   // brak klatki (przed pierwszą): poprzednia albo czerń
      frames.push(img); progress(frames.length, n);
    }
    return { info: { n: frames.length, w, h, fps, duration, used, truncated: duration > VIDEO_MAX_SECONDS + 0.5 / fps, codec: track.codec, srcW: track.displayWidth, srcH: track.displayHeight }, frames };
  } finally { input.dispose(); }
}
