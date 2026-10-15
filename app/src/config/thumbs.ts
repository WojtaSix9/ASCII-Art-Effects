// Miniatury efektów (05, sekcja 4): public/thumbs/<id>.webp, 960×668 (2× kafelka ok. 480×334), jakość ok. 80.
// Kadr „przed” każdego zdjęcia roboczego: public/thumbs/_sample-<n>.webp (ten sam kadr, do efektu hover).
import effects from '../../../engine/src/data/effects.json' with { type: 'json' };
import { sampleAt, SAMPLES } from './sample.ts';

export const THUMB = { w: 960, h: 668, quality: 0.8 };
type Entry = { id: string; name: string; status: string; description: string; category: string };
export const READY = (effects as Entry[]).filter((e) => e.status === 'ready');

/** Numer zdjęcia roboczego (1, 2…) dla efektu: naprzemiennie wg kolejności gotowych efektów w rejestrze. */
export const sampleNoFor = (id: string) => SAMPLES.indexOf(sampleAt(Math.max(0, READY.findIndex((e) => e.id === id)))) + 1;
export const thumbUrl = (id: string) => `/thumbs/${id}.webp`;
export const beforeUrl = (sampleNo: number) => `/thumbs/_sample-${sampleNo}.webp`;
