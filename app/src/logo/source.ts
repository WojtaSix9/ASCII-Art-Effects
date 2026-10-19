// Ported from github.com/bas3line/ascii, site/src/lib/logo.ts @ 8fd792e (16 X 2026): render() and raster(), the parts of the
// drawing that need the DOM. MIT License, Copyright (c) 2026 bas3line (https://github.com/bas3line); LICENSES/ascii.rest-MIT.txt.
// ASCII Art Effects changes (etap 2, krok 8): imports from the engine's port (engine/src/logo/logo.ts); messages in Polish;
// otherwise unchanged. Everything runs in the page: the file is never sent anywhere.
import { SIDE, SVG_NS, clearGround, trim, type Source } from '../../../engine/src/logo/logo.ts';

/** Draws the SVG about 2400 pixels across and finds its ink. Throws, with a message for the page, when it can't. */
export async function render(markup: string): Promise<Source> {
  let text = markup.trim();
  if (!/<svg[\s>]/i.test(text)) throw new Error("To nie jest plik SVG.");
  // Markup copied out of an HTML page often leaves out its namespaces, which an image needs.
  if (!/<svg[^>]*\sxmlns\s*=/i.test(text)) text = text.replace(/<svg(?=[\s>])/i, `<svg xmlns="${SVG_NS}"`);
  if (/\sxlink:/.test(text) && !/xmlns:xlink\s*=/.test(text)) text = text.replace(/<svg(?=[\s>])/i, `<svg xmlns:xlink="http://www.w3.org/1999/xlink"`);
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (doc.getElementsByTagName("parsererror").length || svg.localName !== "svg" || svg.namespaceURI !== SVG_NS) throw new Error("Nie da się odczytać tego SVG.");

  let vb = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) {
    const w = parseFloat(svg.getAttribute("width") ?? ""), h = parseFloat(svg.getAttribute("height") ?? "");
    if (!(w > 0 && h > 0)) throw new Error("SVG nie ma rozmiaru: dodaj mu viewBox.");
    vb = [0, 0, w, h];
    svg.setAttribute("viewBox", vb.join(" "));
  }
  const k = SIDE / Math.max(vb[2], vb[3]);
  const W = Math.max(1, Math.round(vb[2] * k)), H = Math.max(1, Math.round(vb[3] * k));
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Nie da się narysować tego SVG."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, W, H);
    const box = trim(ctx.getImageData(0, 0, W, H).data, W, H);
    if (!box) throw new Error("To SVG nic nie rysuje.");
    return { canvas, ...box };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Draws any image the browser can read about 2400 pixels across and finds its ink. With no transparency of its own,
 * a plain ground is taken out first, unless `keepGround`. Throws, with a message for the page, when it can't.
 */
export async function raster(image: Blob, { keepGround = false } = {}): Promise<Source> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image);
  } catch {
    throw new Error("Nie da się odczytać tego obrazu: spróbuj SVG, PNG, JPG, WebP albo GIF.");
  }
  try {
    if (!bitmap.width || !bitmap.height) throw new Error("Ten obraz jest pusty.");
    const k = SIDE / Math.max(bitmap.width, bitmap.height);
    const W = Math.max(1, Math.round(bitmap.width * k)), H = Math.max(1, Math.round(bitmap.height * k));
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, W, H);
    const pixels = ctx.getImageData(0, 0, W, H);
    const found = clearGround(pixels.data, W, H, !keepGround);
    if (found.ground) ctx.putImageData(pixels, 0, 0);
    const box = trim(pixels.data, W, H);
    if (!box) throw new Error("Ten obraz to samo tło.");
    return { canvas, ...box, ground: found.ground, photo: found.opaque && !found.ground && !keepGround };
  } finally {
    bitmap.close();
  }
}

