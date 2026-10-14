// Palety dithera (15 id z pliku 01). Dokladne kolory oryginalu znamy TYLKO dla gameboy (docs: #9bbc0f #8bac0f #306230 #0f380f).
// Pozostale to STANDARDOWE publiczne palety (PICO-8, C64 Pepto, CGA) lub nasze projekty (proj), nie kopie oryginalu.
export type Palette = { name: string; colors: string[] | null; source: 'docs' | 'standard' | 'proj' }; // null = "original"
const grey = (n: number) => Array.from({ length: n }, (_, i) => { const v = Math.round((i * 255) / (n - 1)).toString(16).padStart(2, '0'); return `#${v}${v}${v}`; });
export const PALETTES: Record<string, Palette> = {
  mono: { name: 'Mono (1-bit)', colors: ['#000000', '#ffffff'], source: 'proj' },
  grey4: { name: 'Grey 4', colors: grey(4), source: 'proj' },
  grey8: { name: 'Grey 8', colors: grey(8), source: 'proj' },
  gameboy: { name: 'Game Boy', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], source: 'docs' },
  cga0: { name: 'CGA 0', colors: ['#000000', '#00aa00', '#aa0000', '#aa5500'], source: 'standard' },
  cga1: { name: 'CGA 1', colors: ['#000000', '#00aaaa', '#aa00aa', '#aaaaaa'], source: 'standard' },
  pico8: { name: 'PICO-8', colors: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'], source: 'standard' },
  c64: { name: 'C64', colors: ['#000000', '#ffffff', '#68372b', '#70a4b2', '#6f3d86', '#588d43', '#352879', '#b8c76f', '#6f4f25', '#433900', '#9a6759', '#444444', '#6c6c6c', '#9ad284', '#6c5eb5', '#959595'], source: 'standard' },
  nes16: { name: 'NES 16', colors: ['#000000', '#fcfcfc', '#bcbcbc', '#7c7c7c', '#0000fc', '#0078f8', '#3cbcfc', '#a4e4fc', '#00a800', '#b8f818', '#f83800', '#fca044', '#f8b800', '#d800cc', '#6844fc', '#881400'], source: 'proj' },
  rgb3: { name: 'RGB 3-bit', colors: ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'], source: 'proj' },
  cyberpunk: { name: 'Cyberpunk', colors: ['#0b0014', '#2d0a4e', '#ff2a6d', '#05d9e8', '#d1f7ff', '#f9f002'], source: 'proj' },
  pastel: { name: 'Pastel', colors: ['#2b2d42', '#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#fffffc'], source: 'proj' },
  riso: { name: 'Riso', colors: ['#14141a', '#ffffff', '#ff48b0', '#0078bf', '#ffe800', '#00a95c', '#ff6c2f'], source: 'proj' },
  sepia: { name: 'Sepia', colors: ['#1a1008', '#4a3420', '#8a6a46', '#c9a874', '#f3e2bf'], source: 'proj' },
  original: { name: 'Original colours', colors: null, source: 'docs' },
};
// Przyblizona paleta klockow (proj; nie jest "official LEGO Art colour set" z oryginalu, ktorego skladu nie znamy).
export const LEGO_COLORS = ['#f2f3f2', '#a3a2a4', '#6d6e5c', '#1b2a34', '#c91a09', '#a83d15', '#f9b52d', '#f4cd2a', '#fe8a18', '#e4adc8', '#cd6298', '#4b9f4a', '#287f46', '#a5ca18', '#0055bf', '#5a93db', '#9fc3e9', '#6c3b27', '#9b6f42', '#d09168', '#fcc7a0', '#720e0f', '#352100', '#8e5597'];
export const BAYER2 = [[0, 2], [3, 1]];
