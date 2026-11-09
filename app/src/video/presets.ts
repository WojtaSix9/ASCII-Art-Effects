// Presety strony /video (krok B; prośba użytkownika: pasek presetów jak w devault-ascii, zestawy własne): efekt z rodziny ASCII
// z parametrami, Color i Post FX. Wartości (proj) dobrane okiem na filmach testowych; identyfikatory i zakresy sprawdza
// scripts/video-check.ts względem definicji silnika. Brakujące parametry biorą wartości domyślne efektu.
import type { RenderState } from '../../../engine/src/index.ts';

export type VideoPreset = { id: string; name: string; state: RenderState };

const solid = (bg: string) => ({ bgMode: 'solid', bgColor: bg });
export const VIDEO_PRESETS: VideoPreset[] = [
  { id: 'classic', name: 'Klasyczny', state: { style: { id: 'characters', params: {} } } },
  { id: 'mono', name: 'Mono', state: { style: { id: 'characters', params: { colorMode: 'mono', inkColor: '#f2f2f2', ...solid('#000000') } } } },
  { id: 'terminal', name: 'Terminal', state: { style: { id: 'characters', params: { charSet: 'hacker', colorMode: 'mono', inkColor: '#3dff7a', ...solid('#020a04') } },
    postFx: { scanLines: { intensity: 35 }, bloom: { threshold: 45, intensity: 45, tint: '#3dff7a', tintAmount: 40 } } } },
  { id: 'amber', name: 'Bursztyn', state: { style: { id: 'characters', params: { colorMode: 'mono', inkColor: '#ffb000', ...solid('#0a0600') } },
    postFx: { bloom: { threshold: 50, intensity: 40, tint: '#ffb000', tintAmount: 50 }, vignette: { intensity: 55 } } } },
  { id: 'crt', name: 'Stary monitor', state: { style: { id: 'characters', params: { charSet: 'classic' } },
    postFx: { scanLines: { intensity: 45 }, crtCurve: { intensity: 45 }, rgbSplit: { offset: 3 }, vignette: { intensity: 60 } } } },
  { id: 'paper', name: 'Papier', state: { style: { id: 'characters', params: { charSet: 'ink', colorMode: 'mono', inkColor: '#1a1a1a', invert: true, ...solid('#f4f1ea') } } } },
  { id: 'braille', name: 'Braille', state: { style: { id: 'braille', params: {} } } },
  { id: 'blocks', name: 'Bloki', state: { style: { id: 'block-chars', params: { blockSet: 'full', cellSize: 8 } } } },
  { id: 'dots', name: 'Raster', state: { style: { id: 'dots', params: { cellSize: 9, ...solid('#000000') } } } },
  { id: 'mixed', name: 'Mieszany', state: { style: { id: 'mixed', params: {} } } },
  { id: 'glitch', name: 'Glitch', state: { style: { id: 'block-chars', params: { blockSet: 'shaded' } }, postFx: { glitch: { intensity: 40 }, rgbSplit: { offset: 6 } } } },
  { id: 'film', name: 'Film', state: { style: { id: 'dots', params: { cellSize: 7 } }, color: { preset: 'sepia' }, postFx: { filmGrain: { intensity: 35 }, filmDust: { density: 25 }, vignette: { intensity: 50 } } } },
];
