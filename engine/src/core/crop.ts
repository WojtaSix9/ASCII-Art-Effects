// Kadr (krok 7.3): przeliczenie ułamków na piksele źródła. Bez zależności, więc aplikacja może go importować bez silnika.
export type Crop = { x: number; y: number; w: number; h: number };
/** Kadr w pikselach źródła (zaokrąglony, co najmniej 1 px, w granicach obrazu). Błąd przy wartościach spoza 0–1. */
export function cropRect(W: number, H: number, c: Crop) {
  const bad = [c.x, c.y, c.w, c.h].some((v) => typeof v !== 'number' || !Number.isFinite(v)) || c.x < 0 || c.y < 0 || c.w <= 0 || c.h <= 0 || c.x + c.w > 1 + 1e-9 || c.y + c.h > 1 + 1e-9;
  if (bad) throw new Error('crop must be {x,y,w,h} within 0..1 with w,h > 0');
  const sx = Math.min(W - 1, Math.round(c.x * W)), sy = Math.min(H - 1, Math.round(c.y * H));
  return { sx, sy, sw: Math.max(1, Math.min(W - sx, Math.round(c.w * W))), sh: Math.max(1, Math.min(H - sy, Math.round(c.h * H))) };
}
