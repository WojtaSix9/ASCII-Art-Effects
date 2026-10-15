// Warstwa tekstu (docs/08, zaakceptowany): zakładka Tekst (lista do 4 napisów, pole tekstu, parametry) i ramki napisów na płótnie.
// Ramki pochodzą z ostatniego renderu (silnik zwraca prostokąty w ułamkach ramki). Przeciągnięcie ramki przesuwa napis;
// na zaznaczonej ramce strzałki przesuwają o 1% (Shift 5%), Delete usuwa.
import type { PostDefs } from '../engine/protocol.ts';
import type { TextBox } from '../../../engine/src/index.ts';
import { mountParamPanel, type Values } from '../ui/param-panel.ts';
import type { EditorState } from './state.ts';

export const textHtml = () => `
  <p class="pp-title">/ Tekst</p>
  <p class="ed-hint">Napisy leżą na wierzchu i nie podlegają korektom Color. Przeciągnij napis na płótnie, żeby go przesunąć.</p>
  <div class="ed-tlist" data-tlist></div>
  <div class="ed-tsel" data-tsel hidden>
    <label class="pp-title" for="ed-ttext">/ Napis</label>
    <textarea id="ed-ttext" class="ed-ttext" data-ttext rows="3" maxlength="200" spellcheck="false"></textarea>
    <p class="ed-hint" data-tweight hidden>Ten krój ma tylko jedną grubość.</p>
    <form class="pp" data-tparams onsubmit="return false"></form>
    <p><button type="button" class="ed-btn" data-tdel>Usuń napis</button></p>
  </div>`;

type Ctx = { get: () => EditorState; change: () => void; commit: () => void; say: (m: string) => void; open: () => void };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function mountText(root: HTMLElement, layer: HTMLElement, defs: PostDefs['text'], ctx: Ctx) {
  const list = root.querySelector<HTMLElement>('[data-tlist]')!, sel = root.querySelector<HTMLElement>('[data-tsel]')!;
  const area = root.querySelector<HTMLTextAreaElement>('[data-ttext]')!;
  const params = defs.params.filter((d) => d.id !== 'text');
  let selected = -1, boxes: (TextBox | null)[] = [];
  const T = () => ctx.get().text;
  const fresh = (): Values => ({ ...Object.fromEntries(defs.params.map((d) => [d.id, structuredClone(d.default)])), y: [85, 15, 50, 70][T().length % 4] });
  const short = (s: unknown) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t ? (t.length > 24 ? t.slice(0, 23) + '…' : t) : '(pusty)'; };

  const drawList = () => {
    list.innerHTML = T().map((t, i) => `<button type="button" class="ed-chip" data-ti="${i}" aria-pressed="${i === selected}">${i + 1}. ${short(t.text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</button>`).join('')
      + `<button type="button" class="ed-chip" data-tadd${T().length >= defs.max ? ' disabled' : ''}>+ Dodaj napis</button>`;
  };
  const drawSel = () => {
    const t = T()[selected]; sel.hidden = !t; if (!t) return;
    if (document.activeElement !== area) area.value = String(t.text);
    const one = (defs.fonts.find((f) => f.id === t.font)?.weights.length ?? 2) < 2; root.querySelector<HTMLElement>('[data-tweight]')!.hidden = !one;
    mountParamPanel(root.querySelector<HTMLElement>('[data-tparams]')!, '', params, t, (v) => { Object.assign(t, v); drawLayer(); ctx.change(); },
      (v) => { Object.assign(t, v); drawSel(); drawList(); ctx.commit(); }, { sections: false });
  };
  /** Ramki napisów na płótnie (procenty, więc niezależne od zoomu). */
  const drawLayer = () => {
    layer.innerHTML = T().map((t, i) => { const b = boxes[i]; if (!b) return '';
      return `<button type="button" class="ed-tbox" data-tbox="${i}" aria-pressed="${i === selected}" style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%"
        aria-label="Napis ${i + 1}: ${short(t.text).replace(/"/g, '&quot;')}, ${Math.round(Number(t.x))}% od lewej, ${Math.round(Number(t.y))}% od góry"></button>`; }).join('');
  };
  const build = () => { if (selected >= T().length) selected = T().length - 1; drawList(); drawSel(); drawLayer(); };
  const select = (i: number, focusBox = false) => { selected = i; drawList(); drawSel(); drawLayer(); if (focusBox) layer.querySelector<HTMLElement>(`[data-tbox="${i}"]`)?.focus(); };
  const add = () => {
    if (T().length >= defs.max) { ctx.say(`Najwyżej ${defs.max} napisy.`); ctx.open(); return; }
    T().push(fresh()); ctx.open(); select(T().length - 1); ctx.change(); ctx.commit(); area.focus(); area.select();
  };
  const remove = (i: number) => { if (i < 0) return; T().splice(i, 1); boxes.splice(i, 1); selected = Math.min(i, T().length - 1); build(); ctx.change(); ctx.commit(); };

  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ti],[data-tadd]'); if (!b) return;
    if (b.hasAttribute('data-tadd')) add(); else select(Number(b.dataset.ti));
  });
  area.addEventListener('input', () => { const t = T()[selected]; if (!t) return; t.text = area.value; drawList(); ctx.change(); });
  area.addEventListener('change', () => ctx.commit());
  root.querySelector('[data-tdel]')!.addEventListener('click', () => remove(selected));

  // Przeciąganie ramki: przesunięcie w ułamkach płótna (layer ma wymiary płótna); ramka przesuwa się od razu, napis po renderze.
  let drag: { i: number; x: number; y: number; t0x: number; t0y: number; b0: TextBox; moved: boolean } | null = null;
  layer.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tbox]'); if (!el || e.button !== 0) return;
    e.stopPropagation(); e.preventDefault(); const i = Number(el.dataset.tbox); const t = T()[i];
    select(i, true); drag = { i, x: e.clientX, y: e.clientY, t0x: Number(t.x), t0y: Number(t.y), b0: { ...boxes[i]! }, moved: false }; layer.setPointerCapture(e.pointerId);
  });
  layer.addEventListener('pointermove', (e) => {
    if (!drag) return; const r = layer.getBoundingClientRect(); const dx = ((e.clientX - drag.x) / r.width) * 100, dy = ((e.clientY - drag.y) / r.height) * 100;
    const t = T()[drag.i]; t.x = clamp(Math.round((drag.t0x + dx) * 10) / 10, 0, 100); t.y = clamp(Math.round((drag.t0y + dy) * 10) / 10, 0, 100); drag.moved = true;
    boxes[drag.i] = { ...drag.b0, x: drag.b0.x + (Number(t.x) - drag.t0x) / 100, y: drag.b0.y + (Number(t.y) - drag.t0y) / 100 };
    drawLayer(); drawSel(); ctx.change();
  });
  const end = () => { if (drag?.moved) ctx.commit(); if (drag) layer.querySelector<HTMLElement>(`[data-tbox="${drag.i}"]`)?.focus(); drag = null; };
  layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end);
  layer.addEventListener('keydown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tbox]'); if (!el) return; const i = Number(el.dataset.tbox); const t = T()[i];
    const st = e.shiftKey ? 5 : 1; const d = ({ ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] } as Record<string, number[]>)[e.key];
    if (d) { e.preventDefault(); t.x = clamp(Number(t.x) + d[0], 0, 100); t.y = clamp(Number(t.y) + d[1], 0, 100); select(i, true); ctx.change(); ctx.commit(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(i); }
  });
  /** Prostokąty z ostatniego renderu. */
  const setBoxes = (b: (TextBox | null)[] | undefined) => { if (drag) return; boxes = b ? [...b] : []; drawLayer(); };
  return { build, add, setBoxes };
}
