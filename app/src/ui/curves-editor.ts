// Edytor krzywych (Curves, krok 7): kanały RGB / R / G / B, do 16 punktów na kanał, interpolacja jak w silniku (Fritsch–Carlson).
// Mysz: kliknięcie dodaje punkt, przeciągnięcie przesuwa, podwójne kliknięcie usuwa. Klawiatura: płótno ma fokus,
// strzałki przesuwają zaznaczony punkt o 1 (Shift: 10), Delete usuwa; pola Wejście/Wyjście (0–255) dla zaznaczonego punktu.
import { curveLut, MAX_CURVE_POINTS, type Curves } from '../../../engine/src/post/grade.ts';

type Ch = keyof Curves;
const CH: [Ch, string, string][] = [['rgb', 'RGB', '#f5f5f5'], ['r', 'R', '#ff5a5a'], ['g', 'G', '#4fd16b'], ['b', 'B', '#5a8cff']];
const S = 255;

export function mountCurves(root: HTMLElement, initial: Curves, onChange: (c: Curves) => void, onCommit: (c: Curves) => void) {
  let cur: Curves = structuredClone(initial); let ch: Ch = 'rgb'; let sel = -1;
  root.innerHTML = `
    <div class="cv-chs" role="group" aria-label="Kanał krzywej">${CH.map(([k, l]) => `<button type="button" class="chip" data-ch="${k}" aria-pressed="${k === ch}">${l}</button>`).join('')}</div>
    <canvas class="cv-canvas" data-cv width="512" height="512" tabindex="0" role="application"
      aria-label="Krzywa: kliknij, żeby dodać punkt, przeciągnij, żeby przesunąć; strzałki przesuwają zaznaczony punkt, Delete usuwa"></canvas>
    <div class="cv-point" data-point>
      <label>Wejście <input type="number" min="0" max="255" step="1" data-px></label>
      <label>Wyjście <input type="number" min="0" max="255" step="1" data-py></label>
      <button type="button" class="ed-btn" data-del>Usuń punkt</button>
    </div>
    <p class="ed-hint" data-cv-info></p>
    <p><button type="button" class="ed-btn" data-reset-ch>Resetuj kanał</button></p>`;
  const cv = root.querySelector<HTMLCanvasElement>('[data-cv]')!; const g = cv.getContext('2d')!;
  const px = root.querySelector<HTMLInputElement>('[data-px]')!, py = root.querySelector<HTMLInputElement>('[data-py]')!, del = root.querySelector<HTMLButtonElement>('[data-del]')!;
  const info = root.querySelector<HTMLElement>('[data-cv-info]')!;
  const pts = () => cur[ch];

  const draw = () => {
    const W = cv.width; g.clearRect(0, 0, W, W); g.fillStyle = '#050505'; g.fillRect(0, 0, W, W);
    g.strokeStyle = '#222'; g.lineWidth = 2; for (let i = 1; i < 4; i++) { const v = (W * i) / 4; g.beginPath(); g.moveTo(v, 0); g.lineTo(v, W); g.moveTo(0, v); g.lineTo(W, v); g.stroke(); }
    g.strokeStyle = '#333'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(0, W); g.lineTo(W, 0); g.stroke(); g.setLineDash([]);
    for (const [k, , color] of CH) {
      const lut = curveLut(cur[k]); g.strokeStyle = color; g.globalAlpha = k === ch ? 1 : 0.25; g.lineWidth = k === ch ? 3 : 2;
      g.beginPath(); for (let v = 0; v < 256; v++) { const x = (v / 255) * W, y = W - (lut[v] / 255) * W; v ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    g.globalAlpha = 1;
    pts().forEach(([x, y], i) => { g.beginPath(); g.arc(x * W, W - y * W, i === sel ? 11 : 8, 0, 7); g.fillStyle = i === sel ? '#fff' : '#000'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); });
    const p = pts()[sel]; root.querySelector<HTMLElement>('[data-point]')!.hidden = !p;
    if (p) { px.value = String(Math.round(p[0] * S)); py.value = String(Math.round(p[1] * S)); del.disabled = pts().length <= 2; }
    info.textContent = `${CH.find((c) => c[0] === ch)![1]}: ${pts().length} z ${MAX_CURVE_POINTS} punktów`;
  };
  /** Ustawia punkt i z zachowaniem kolejności x (odstęp co najmniej 1/255). */
  const setPoint = (i: number, x: number, y: number) => {
    const p = pts(); const lo = i > 0 ? p[i - 1][0] + 1 / S : 0, hi = i < p.length - 1 ? p[i + 1][0] - 1 / S : 1;
    p[i] = [Math.min(hi, Math.max(lo, Math.round(x * S) / S)), Math.min(1, Math.max(0, Math.round(y * S) / S))];
  };
  const emit = () => { draw(); onChange(structuredClone(cur)); };
  const commit = () => onCommit(structuredClone(cur));
  const posOf = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height, r }; };
  const hit = (x: number, y: number, r: DOMRect) => pts().findIndex(([a, b]) => Math.hypot((a - x) * r.width, (b - y) * r.height) <= 10);

  let drag = false, moved = false;
  cv.addEventListener('pointerdown', (e) => {
    const { x, y, r } = posOf(e); let i = hit(x, y, r);
    if (i < 0) {
      if (pts().length >= MAX_CURVE_POINTS) { info.textContent = `Najwyżej ${MAX_CURVE_POINTS} punktów na kanał.`; return; }
      const xx = Math.round(Math.min(1, Math.max(0, x)) * S) / S; if (pts().some((p) => p[0] === xx)) return;
      const p = pts(); i = p.findIndex((q) => q[0] > xx); if (i < 0) i = p.length; p.splice(i, 0, [xx, 0]); setPoint(i, xx, y); moved = true; emit();
    }
    sel = i; drag = true; cv.setPointerCapture(e.pointerId); cv.focus(); draw();
  });
  cv.addEventListener('pointermove', (e) => { if (!drag || sel < 0) return; const { x, y } = posOf(e); setPoint(sel, x, y); moved = true; emit(); });
  const end = () => { if (drag && moved) commit(); drag = false; moved = false; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const remove = () => { if (sel < 0 || pts().length <= 2) return; pts().splice(sel, 1); sel = Math.min(sel, pts().length - 1); emit(); commit(); };
  cv.addEventListener('dblclick', (e) => { const { x, y, r } = posOf(e as PointerEvent); const i = hit(x, y, r); if (i >= 0) { sel = i; remove(); } });
  cv.addEventListener('keydown', (e) => {
    if (sel < 0 && pts().length) sel = 0;
    const st = (e.shiftKey ? 10 : 1) / S; const p = pts()[sel]; if (!p) return;
    const d = ({ ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] } as Record<string, number[]>)[e.key];
    if (d) { setPoint(sel, p[0] + d[0], p[1] + d[1]); emit(); commit(); e.preventDefault(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { remove(); e.preventDefault(); }
    else if (e.key === 'Tab' && !e.shiftKey && sel < pts().length - 1) { sel++; draw(); e.preventDefault(); }
    else if (e.key === 'Tab' && e.shiftKey && sel > 0) { sel--; draw(); e.preventDefault(); }
  });
  const fromInputs = () => { if (sel < 0) return; setPoint(sel, Number(px.value) / S, Number(py.value) / S); emit(); };
  px.addEventListener('input', fromInputs); py.addEventListener('input', fromInputs); px.addEventListener('change', commit); py.addEventListener('change', commit);
  del.addEventListener('click', remove);
  root.querySelector('[data-reset-ch]')!.addEventListener('click', () => { cur[ch] = [[0, 0], [1, 1]]; sel = -1; emit(); commit(); });
  root.querySelector('.cv-chs')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ch]'); if (!b) return; ch = b.dataset.ch as Ch; sel = -1;
    root.querySelectorAll('[data-ch]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw();
  });
  draw();
  return { set: (c: Curves) => { cur = structuredClone(c); sel = -1; draw(); } };
}
