// Zakładka Kadr (krok 7.3, proj; plik 01 i 05 wymieniają tylko ikonę „kadr”). Pole z całym zdjęciem i prostokątem kadru:
// przeciągnięcie środka przesuwa, narożniki zmieniają rozmiar; proporcje do wyboru; pola X, Y, szerokość, wysokość w px źródła.
// Klawiatura na prostokącie: strzałki przesuwają o 1% (Shift 5%), Alt + strzałki zmieniają rozmiar. Kadr całego zdjęcia = brak kadru.
import type { Crop } from '../../../engine/src/core/crop.ts';
import type { EditorState } from './state.ts';

export const ASPECTS: [string, string][] = [['free', 'Dowolne'], ['original', 'Oryginał'], ['1:1', '1:1'], ['4:5', '4:5'], ['3:2', '3:2'], ['16:9', '16:9'], ['9:16', '9:16']];
/** Najmniejszy bok kadru w px źródła (proj). */
export const MIN_CROP = 16;

export const cropHtml = () => `
  <p class="pp-title">/ Kadr</p>
  <p class="ed-hint">Przeciągnij prostokąt albo jego narożniki. Strzałki przesuwają o 1% (Shift 5%), Alt + strzałki zmieniają rozmiar.</p>
  <div class="ed-aspects" role="group" aria-label="Proporcje kadru">${ASPECTS.map(([id, n]) => `<button type="button" class="ed-chip" data-aspect="${id}" aria-pressed="false">${n}</button>`).join('')}</div>
  <div class="ed-cpad" data-cpad>
    <canvas class="ed-lpad__bg" data-cpad-bg aria-hidden="true"></canvas>
    <div class="ed-crop" data-crop-box tabindex="0" role="group">
      ${['nw', 'ne', 'sw', 'se'].map((h) => `<span class="ed-crop__h ed-crop__h--${h}" data-h="${h}" aria-hidden="true"></span>`).join('')}
    </div>
  </div>
  <div class="ed-cfields">
    ${[['x', 'X'], ['y', 'Y'], ['w', 'Szerokość'], ['h', 'Wysokość']].map(([k, l]) => `<label>${l}<input type="number" inputmode="numeric" min="0" step="1" data-cf="${k}"></label>`).join('')}
  </div>
  <p class="ed-hint" data-crop-size></p>
  <p><button type="button" class="ed-btn" data-crop-reset>Resetuj kadr</button></p>`;

type Ctx = {
  get: () => EditorState; source: () => (CanvasImageSource & { width: number; height: number }) | null;
  change: () => void; commit: () => void;
};
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function mountCrop(root: HTMLElement, ctx: Ctx) {
  const pad = root.querySelector<HTMLElement>('[data-cpad]')!, box = root.querySelector<HTMLElement>('[data-crop-box]')!, bg = root.querySelector<HTMLCanvasElement>('[data-cpad-bg]')!;
  const field = (k: string) => root.querySelector<HTMLInputElement>(`[data-cf="${k}"]`)!;
  const S = () => ctx.get();
  const dims = () => { const s = ctx.source(); return { W: s?.width ?? 1, H: s?.height ?? 1 }; };
  const cur = (): Crop => S().crop ?? { x: 0, y: 0, w: 1, h: 1 };
  /** Proporcja kadru w ułamkach (w/h), albo null przy „Dowolne”. */
  const ratioN = (): number | null => {
    const a = S().cropAspect; if (a === 'free') return null; const { W, H } = dims();
    const px = a === 'original' ? W / H : (([p, q]) => p / q)(a.split(':').map(Number)); return (px * H) / W;
  };
  const mins = () => { const { W, H } = dims(); return { mw: Math.min(1, MIN_CROP / W), mh: Math.min(1, MIN_CROP / H) }; };
  /** Zapis: kadr równy całemu zdjęciu (co do piksela) = brak kadru, więc render jest wtedy identyczny jak bez kadru. */
  const set = (c: Crop) => {
    const { W, H } = dims(); const full = Math.round(c.x * W) === 0 && Math.round(c.y * H) === 0 && Math.round(c.w * W) === W && Math.round(c.h * H) === H;
    const r = (v: number) => Math.round(v * 1e6) / 1e6, f = (v: number) => Math.floor(v * 1e6) / 1e6;   // szerokość w dół: x + w nigdy > 1
    const x = r(c.x), y = r(c.y); S().crop = full ? null : { x, y, w: f(Math.min(c.w, 1 - x)), h: f(Math.min(c.h, 1 - y)) };
    draw(); ctx.change();
  };
  /** Największy prostokąt o danej proporcji mieszczący się w zdjęciu, wyśrodkowany możliwie na środku obecnego kadru. */
  const fit = (c: Crop, rn: number): Crop => {
    let w = Math.min(1, rn), h = w / rn; if (h > 1) { h = 1; w = rn; }
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2; return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
  };

  const drawBg = () => {
    const s = ctx.source(); if (!s) return; pad.style.aspectRatio = `${s.width} / ${s.height}`;
    const w = 320, h = Math.max(1, Math.round((w * s.height) / s.width)); bg.width = w; bg.height = h; bg.getContext('2d')!.drawImage(s, 0, 0, w, h);
  };
  const draw = (fields = false) => {
    const c = cur(); const { W, H } = dims();
    Object.assign(box.style, { left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` });
    const px = { x: Math.round(c.x * W), y: Math.round(c.y * H), w: Math.round(c.w * W), h: Math.round(c.h * H) };
    for (const k of ['x', 'y', 'w', 'h'] as const) { const f = field(k); if (fields || document.activeElement !== f) f.value = String(px[k]); f.max = String(k === 'x' || k === 'w' ? W : H); }
    box.setAttribute('aria-label', `Kadr ${px.w}×${px.h} px, od lewej ${px.x}, od góry ${px.y}`);
    root.querySelector('[data-crop-size]')!.textContent = S().crop ? `Kadr ${px.w}×${px.h} px z ${W}×${H} px.` : `Całe zdjęcie, ${W}×${H} px.`;
    root.querySelectorAll<HTMLElement>('[data-aspect]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.aspect === S().cropAspect)));
  };
  const build = () => { drawBg(); draw(); };

  root.querySelector('.ed-aspects')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-aspect]'); if (!b) return;
    S().cropAspect = b.dataset.aspect!; const rn = ratioN(); set(rn ? fit(cur(), rn) : cur()); ctx.commit();
  });
  root.querySelector('[data-crop-reset]')!.addEventListener('click', () => { S().crop = null; S().cropAspect = 'free'; draw(); ctx.change(); ctx.commit(); });

  // Przeciąganie: środek przesuwa, narożnik zmienia rozmiar względem przeciwległego narożnika.
  let drag: { mode: string; px: number; py: number; c: Crop; moved: boolean } | null = null;
  const pos = (e: PointerEvent) => { const r = pad.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) }; };
  const resize = (c: Crop, corner: string, p: { x: number; y: number }): Crop => {
    const ax = corner.includes('w') ? c.x + c.w : c.x, ay = corner.includes('n') ? c.y + c.h : c.y;   // stały narożnik
    const sx = corner.includes('w') ? -1 : 1, sy = corner.includes('n') ? -1 : 1; const { mw, mh } = mins();
    const maxW = sx > 0 ? 1 - ax : ax, maxH = sy > 0 ? 1 - ay : ay;
    let w = clamp((p.x - ax) * sx, mw, maxW), h = clamp((p.y - ay) * sy, mh, maxH); const rn = ratioN();
    if (rn) { w = Math.min(Math.max(w, h * rn), maxW, maxH * rn); h = w / rn; if (h < mh) { h = mh; w = h * rn; } }
    return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
  };
  pad.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; const h = (e.target as HTMLElement).closest<HTMLElement>('[data-h]');
    const inBox = (e.target as HTMLElement).closest('[data-crop-box]'); if (!h && !inBox) return;
    const p = pos(e); drag = { mode: h ? h.dataset.h! : 'move', px: p.x, py: p.y, c: { ...cur() }, moved: false };
    pad.setPointerCapture(e.pointerId); box.focus(); e.preventDefault();
  });
  pad.addEventListener('pointermove', (e) => {
    if (!drag) return; const p = pos(e); const c = drag.c; drag.moved = true;
    if (drag.mode === 'move') set({ ...c, x: clamp(c.x + p.x - drag.px, 0, 1 - c.w), y: clamp(c.y + p.y - drag.py, 0, 1 - c.h) });
    else set(resize(c, drag.mode, p));
  });
  const end = () => { if (drag?.moved) ctx.commit(); drag = null; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);

  box.addEventListener('keydown', (e) => {
    const st = e.shiftKey ? 0.05 : 0.01; const d = ({ ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] } as Record<string, number[]>)[e.key];
    if (!d) return; e.preventDefault(); const c = cur();
    if (e.altKey) set(resize(c, 'se', { x: c.x + c.w + d[0], y: c.y + c.h + (ratioN() ? d[0] : d[1]) }));
    else set({ ...c, x: clamp(c.x + d[0], 0, 1 - c.w), y: clamp(c.y + d[1], 0, 1 - c.h) });
    ctx.commit();
  });
  root.querySelector('.ed-cfields')!.addEventListener('change', (e) => {
    const f = (e.target as HTMLElement).closest<HTMLInputElement>('[data-cf]'); if (!f) return;
    const { W, H } = dims(); const c = { ...cur() }; const v = Number(f.value); if (!Number.isFinite(v)) { draw(); return; }
    const { mw, mh } = mins(); const rn = ratioN();
    if (f.dataset.cf === 'x') c.x = clamp(v / W, 0, 1 - c.w);
    else if (f.dataset.cf === 'y') c.y = clamp(v / H, 0, 1 - c.h);
    else if (f.dataset.cf === 'w') { c.w = clamp(v / W, mw, 1 - c.x); if (rn) { c.h = Math.min(c.w / rn, 1 - c.y); c.w = c.h * rn; } }
    else { c.h = clamp(v / H, mh, 1 - c.y); if (rn) { c.w = Math.min(c.h * rn, 1 - c.x); c.h = c.w / rn; } }
    set(c); draw(true); ctx.commit();
  });
  return { build, drawBg };
}
