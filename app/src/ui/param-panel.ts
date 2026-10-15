// Panel parametrów budowany z definicji `params` efektu (ParamDef z silnika), bez wiedzy o konkretnych efektach.
// Kolejność sekcji wg 05, sekcja 8.5: / BACKDROP → parametry stylu → / INTENSITY; parametry „advanced” w zwijanej części
// sekcji; seed na końcu z przyciskiem „Losuj”. Etykiety parametrów pochodzą z silnika (po angielsku, jak nazwy efektów).
import type { ParamDef } from '../../../engine/src/index.ts';

export type Values = Record<string, unknown>;
const BACKDROP = ['bgMode', 'bgOpacity', 'bgBlur', 'bgColor'];
const INTENSITY = ['coverage', 'brightness', 'contrast', 'invert'];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function groupParams(defs: ParamDef[]) {
  const pick = (ids: string[]) => defs.filter((d) => ids.includes(d.id));
  return {
    backdrop: pick(BACKDROP),
    style: defs.filter((d) => !BACKDROP.includes(d.id) && !INTENSITY.includes(d.id) && d.kind !== 'seed'),
    intensity: pick(INTENSITY),
    seed: defs.filter((d) => d.kind === 'seed'),
  };
}

const fmt = (d: ParamDef, v: unknown) => `${v}${d.unit ? (d.unit === '%' ? '%' : ' ' + d.unit) : ''}`;

function control(d: ParamDef, v: unknown): string {
  const id = `p-${d.id}`;
  switch (d.kind) {
    case 'range':
      return `<div class="pp-row pp-range"><label for="${id}">${esc(d.label)}</label><output for="${id}" data-out="${d.id}">${esc(fmt(d, v))}</output>
        <input id="${id}" data-p="${d.id}" type="range" min="${d.min}" max="${d.max}" step="${d.step ?? 1}" value="${v}"></div>`;
    case 'select':
      return `<div class="pp-row"><label for="${id}">${esc(d.label)}</label><select id="${id}" data-p="${d.id}">${
        d.options!.map((o) => `<option value="${esc(o.value)}"${o.value === v ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    case 'toggle':
      return `<div class="pp-row pp-inline"><label for="${id}">${esc(d.label)}</label><input id="${id}" data-p="${d.id}" type="checkbox"${v ? ' checked' : ''}></div>`;
    case 'color':
      return `<div class="pp-row pp-inline"><label for="${id}">${esc(d.label)}</label><input id="${id}" data-p="${d.id}" type="color" value="${esc(String(v))}"></div>`;
    case 'text':
      return `<div class="pp-row"><label for="${id}">${esc(d.label)}</label><input id="${id}" data-p="${d.id}" type="text" class="pp-mono" value="${esc(String(v))}" spellcheck="false" autocomplete="off"></div>`;
    case 'seed':
      return `<div class="pp-row pp-inline"><label for="${id}">${esc(d.label)}</label><span class="pp-seed"><input id="${id}" data-p="${d.id}" type="number" min="${d.min}" max="${d.max}" step="1" value="${v}">
        <button type="button" data-random="${d.id}">Losuj</button></span></div>`;
    case 'curves': return '';   // własny edytor: ui/curves-editor.ts
    case 'gradient': {
      const stops = v as { pos: number; color: string }[];
      return `<fieldset class="pp-row pp-gradient" data-gradient="${d.id}"><legend>${esc(d.label)}</legend>${stops.map((s, i) =>
        `<span class="pp-stop"><input type="color" aria-label="Kolor ${i + 1}" data-stop="${i}" data-k="color" value="${esc(s.color)}">
         <input type="number" aria-label="Pozycja ${i + 1} (0–1)" data-stop="${i}" data-k="pos" min="0" max="1" step="0.01" value="${s.pos}"></span>`).join('')}</fieldset>`;
    }
  }
}

function section(title: string, defs: ParamDef[], values: Values, allMain = false) {
  if (!defs.length) return '';
  const main = defs.filter((d) => allMain || d.level !== 'advanced'), adv = allMain ? [] : defs.filter((d) => d.level === 'advanced');
  return `<section class="pp-sec">${title ? `<h3 class="pp-title">/ ${esc(title)}</h3>` : ''}${main.map((d) => control(d, values[d.id])).join('')}${
    adv.length ? `<details class="pp-adv"><summary>Więcej</summary>${adv.map((d) => control(d, values[d.id])).join('')}</details>` : ''}</section>`;
}

/** Wstawia panel do `root`; onChange dostaje komplet wartości po każdej zmianie (także w trakcie przeciągania suwaka),
 *  onCommit po zakończonej zmianie (puszczenie suwaka, wybór z listy) – do historii cofnij/ponów. Zwraca odczyt wartości.
 *  sections: false = jedna sekcja z tytułem `styleName` (Color, Post FX). */
export function mountParamPanel(root: HTMLElement, styleName: string, defs: ParamDef[], initial: Values, onChange: (v: Values) => void, onCommit?: (v: Values) => void, opts: { sections?: boolean } = {}) {
  const values: Values = Object.fromEntries(defs.map((d) => [d.id, initial[d.id] ?? structuredClone(d.default)]));
  const g = groupParams(defs);
  root.innerHTML = opts.sections === false ? section(styleName, defs, values)
    : section('Backdrop', g.backdrop, values) + section(styleName, g.style, values) + section('Intensity', g.intensity, values) + section('Seed', g.seed, values, true);   // seed to osobny poziom (plik 02), zawsze widoczny
  const byId = new Map(defs.map((d) => [d.id, d]));

  // 'input' (w trakcie) i 'change' (zakończenie) przychodzą osobno; wartość aktualizuje 'input', a dla kontrolek bez
  // 'input' (np. niektóre listy) także 'change'. onCommit raz po zakończonej zmianie.
  root.onchange = (e) => { root.oninput!(e); onCommit?.({ ...values }); };
  root.oninput = (e) => {
    const el = e.target as HTMLInputElement;
    const grad = el.closest<HTMLElement>('[data-gradient]');
    if (grad) {
      const stops = structuredClone(values[grad.dataset.gradient!]) as { pos: number; color: string }[];
      const s = stops[Number(el.dataset.stop)]; if (el.dataset.k === 'color') s.color = el.value; else s.pos = Math.min(1, Math.max(0, Number(el.value) || 0));
      values[grad.dataset.gradient!] = stops; onChange({ ...values }); return;
    }
    const d = byId.get(el.dataset.p ?? ''); if (!d) return;
    const v = d.kind === 'toggle' ? el.checked : d.kind === 'range' || d.kind === 'seed' ? Number(el.value) : el.value;
    if (d.kind === 'seed' && !Number.isFinite(v as number)) return;
    if (values[d.id] === v) return;
    values[d.id] = v;
    const out = root.querySelector(`[data-out="${d.id}"]`); if (out) out.textContent = fmt(d, v);
    onChange({ ...values });
  };
  root.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-random]'); if (!b) return;
    const d = byId.get(b.dataset.random!)!; const input = root.querySelector<HTMLInputElement>(`[data-p="${d.id}"]`)!;
    input.value = String(Math.floor(Math.random() * ((d.max ?? 99999) + 1)));
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  return () => ({ ...values });
}
