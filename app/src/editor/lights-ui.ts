// Zakładka Lights (docs/07-lights-projekt.md): pole 2D z podglądem zdjęcia i siatką kropek. Kliknięcie dodaje światło
// (najwyżej 4), przeciągnięcie przesuwa, kliknięcie zaznacza; klawiatura: strzałki 1% (Shift 5%), Delete usuwa.
import type { Light } from '../../../engine/src/index.ts';
import type { PostDefs } from '../engine/protocol.ts';
import { mountParamPanel } from '../ui/param-panel.ts';
import type { EditorState } from './state.ts';

export const lightsHtml = () => `
  <p class="pp-title">/ Lights</p>
  <label class="ed-fx__on"><input type="checkbox" data-lights-on> Włącz światła</label>
  <p class="ed-hint" data-lights-hint>Kliknij w pole, żeby dodać światło (najwyżej 4). Przeciągnij, żeby przesunąć.</p>
  <div class="ed-lpad" data-lpad role="group" aria-label="Pole świateł">
    <canvas class="ed-lpad__bg" data-lpad-bg aria-hidden="true"></canvas>
    <div class="ed-lpad__lights" data-lpad-lights></div>
  </div>
  <div class="ed-lsel" data-lsel hidden>
    <div class="ed-lsel__head"><span class="pp-title" data-lsel-name></span><button type="button" class="ed-btn" data-ltrash>Usuń światło</button></div>
    <form class="pp" data-lparams onsubmit="return false"></form>
  </div>
  <form class="pp" data-lamb onsubmit="return false"></form>`;

type Ctx = {
  get: () => EditorState; source: () => CanvasImageSource & { width: number; height: number } | null;
  change: () => void;   // render po zmianie
  commit: () => void;   // zapis do historii
  say: (m: string) => void;
};

export function mountLights(root: HTMLElement, defs: PostDefs['lights'], ctx: Ctx) {
  const pad = root.querySelector<HTMLElement>('[data-lpad]')!, layer = root.querySelector<HTMLElement>('[data-lpad-lights]')!;
  const bg = root.querySelector<HTMLCanvasElement>('[data-lpad-bg]')!, on = root.querySelector<HTMLInputElement>('[data-lights-on]')!;
  const sel = root.querySelector<HTMLElement>('[data-lsel]')!;
  let selected = -1;
  const L = () => ctx.get().lights;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const newLight = (x: number, y: number): Light => ({ x, y, radius: 30, intensity: 80, color: '#ffffff' });

  const drawBg = () => {
    const src = ctx.source(); if (!src) return;
    pad.style.aspectRatio = `${src.width} / ${src.height}`;
    const w = 320, h = Math.max(1, Math.round((w * src.height) / src.width)); bg.width = w; bg.height = h;
    bg.getContext('2d')!.drawImage(src, 0, 0, w, h);
  };
  const drawLights = () => {
    const box = pad.getBoundingClientRect(); const diag = Math.hypot(box.width, box.height);
    layer.innerHTML = L().items.map((l, i) => `
      <span class="ed-light__ring" style="left:${l.x * 100}%;top:${l.y * 100}%;width:${(2 * l.radius * diag) / 100}px;height:${(2 * l.radius * diag) / 100}px;border-color:${l.color}" aria-hidden="true"></span>
      <button type="button" class="ed-light" data-light="${i}" aria-pressed="${i === selected}" style="left:${l.x * 100}%;top:${l.y * 100}%;background:${l.color}"
        aria-label="Światło ${i + 1}: ${pct(l.x)} od lewej, ${pct(l.y)} od góry"></button>`).join('');
    pad.classList.toggle('is-off', !L().enabled);
  };
  const buildSelected = () => {
    const l = L().items[selected];
    sel.hidden = !l; if (!l) return;
    root.querySelector('[data-lsel-name]')!.textContent = `/ Światło ${selected + 1}`;
    mountParamPanel(root.querySelector<HTMLElement>('[data-lparams]')!, '', defs.params, l as unknown as Record<string, unknown>,
      (v) => { Object.assign(l, v); drawLights(); ctx.change(); }, (v) => { Object.assign(l, v); ctx.commit(); }, { sections: false });
  };
  const build = () => {
    on.checked = L().enabled;
    if (selected >= L().items.length) selected = L().items.length - 1;
    drawBg(); drawLights(); buildSelected();
    mountParamPanel(root.querySelector<HTMLElement>('[data-lamb]')!, '', [defs.ambient], { ambient: L().ambient },
      (v) => { L().ambient = Number(v.ambient); ctx.change(); }, (v) => { L().ambient = Number(v.ambient); ctx.commit(); }, { sections: false });
  };
  const select = (i: number) => { selected = i; drawLights(); buildSelected(); layer.querySelector<HTMLElement>(`[data-light="${i}"]`)?.focus(); };
  const remove = (i: number) => { if (i < 0) return; L().items.splice(i, 1); selected = Math.min(i, L().items.length - 1); drawLights(); buildSelected(); ctx.commit(); ctx.change(); if (selected >= 0) select(selected); else pad.focus(); };
  const posOf = (e: PointerEvent) => { const r = pad.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };

  on.addEventListener('change', () => {
    L().enabled = on.checked;
    if (on.checked && !L().items.length) { L().items.push(newLight(0.5, 0.4)); selected = 0; buildSelected(); }   // włączenie bez świateł nic by nie zmieniło
    drawLights(); ctx.commit(); ctx.change();
  });

  let drag: { i: number; moved: boolean } | null = null;
  pad.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-light]');
    if (b) { const i = Number(b.dataset.light); select(i); drag = { i, moved: false }; pad.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    if (L().items.length >= defs.max) { ctx.say(`Najwyżej ${defs.max} światła.`); return; }
    const p = posOf(e); L().items.push(newLight(p.x, p.y)); L().enabled = true; on.checked = true;
    select(L().items.length - 1); drag = { i: selected, moved: true }; pad.setPointerCapture(e.pointerId); ctx.change(); e.preventDefault();
  });
  pad.addEventListener('pointermove', (e) => {
    if (!drag) return; const p = posOf(e); const l = L().items[drag.i]; l.x = p.x; l.y = p.y; drag.moved = true; drawLights(); ctx.change();
  });
  const end = () => { if (drag?.moved) ctx.commit(); if (drag) layer.querySelector<HTMLElement>(`[data-light="${drag.i}"]`)?.focus(); drag = null; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  layer.addEventListener('keydown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-light]'); if (!b) return; const i = Number(b.dataset.light); const l = L().items[i];
    const st = e.shiftKey ? 0.05 : 0.01;
    const d = ({ ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] } as Record<string, number[]>)[e.key];
    if (d) { l.x = Math.min(1, Math.max(0, l.x + d[0])); l.y = Math.min(1, Math.max(0, l.y + d[1])); drawLights(); select(i); ctx.change(); ctx.commit(); e.preventDefault(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { remove(i); e.preventDefault(); }
  });
  root.querySelector('[data-ltrash]')!.addEventListener('click', () => remove(selected));
  const ro = new ResizeObserver(() => drawLights()); ro.observe(pad);
  return { build, drawBg, dispose: () => ro.disconnect() };
}
