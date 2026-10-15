// Pomocnicze funkcje podglądu: wczytanie zdjęcia, kadrowanie, skala renderu podglądu.
// Podgląd renderuje się w rozdzielczości ekranu (decyzja użytkownika po kroku 2): skala silnika = piksele ekranu / piksele źródła,
// najwyżej 1. Parametry w px skalują się razem z obrazem (silnik, opcja scale), więc podgląd wygląda jak eksport w skali 1×.

export type Rect = { sx: number; sy: number; sw: number; sh: number };

export async function loadImage(src: string) {
  const img = new Image(); img.decoding = 'async'; img.src = src; await img.decode(); return img;
}

/** Kadr źródła wypełniający pole W×H (jak object-fit: cover), możliwie wyśrodkowany na punkcie `focus` (0–1). */
export function coverRect(iw: number, ih: number, W: number, H: number, focus = { x: 0.5, y: 0.5 }): Rect {
  const k = Math.max(W / iw, H / ih); const sw = Math.min(iw, Math.round(W / k)), sh = Math.min(ih, Math.round(H / k));
  const at = (f: number, full: number, part: number) => Math.round(Math.min(full - part, Math.max(0, f * full - part / 2)));
  return { sx: at(focus.x, iw, sw), sy: at(focus.y, ih, sh), sw, sh };
}

/** Skala renderu podglądu: tyle pikseli, ile pokaże ekran (CSS × devicePixelRatio), bez powiększania ponad źródło. */
export function previewScale(srcW: number, srcH: number, cssW: number, cssH: number, dpr = window.devicePixelRatio || 1) {
  return Math.min(1, Math.max(0.1, Math.min((cssW * dpr) / srcW, (cssH * dpr) / srcH)));
}

/** Piksele kadru jako ImageData w rozdzielczości źródła. */
export function cropPixels(img: CanvasImageSource, r: Rect): ImageData {
  const c = document.createElement('canvas'); c.width = r.sw; c.height = r.sh;
  const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, r.sw, r.sh);
  return g.getImageData(0, 0, r.sw, r.sh);
}

export function paint(canvas: HTMLCanvasElement, image: ImageData) {
  if (canvas.width !== image.width || canvas.height !== image.height) { canvas.width = image.width; canvas.height = image.height; }
  canvas.getContext('2d')!.putImageData(image, 0, 0);
}
