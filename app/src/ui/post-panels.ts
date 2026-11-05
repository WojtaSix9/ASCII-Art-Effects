// Panele Color (Color, Levels, Curves) i Post FX, wspólne dla edytora i strony /video. Stan trzyma strona; panel czyta go przez
// get() i zapisuje przez set(), a change() / commit() wołają render i historię strony (commit: zakończona zmiana).
import type { PostDefs } from '../engine/protocol.ts';
import type { Curves } from '../../../engine/src/post/grade.ts';
import { mountParamPanel, type Values } from './param-panel.ts';
import { mountCurves } from './curves-editor.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
type Ctx<T> = { get: () => T; set: (v: T) => void; change: () => void; commit: () => void };

export const colorHtml = () => `
      <form class="pp" data-color onsubmit="return false"></form>
      <form class="pp" data-levels onsubmit="return false"></form>
      <div class="pp-sec"><h3 class="pp-title">/ Curves</h3><div data-curves></div></div>
      <p><button type="button" class="ed-btn" data-color-reset>Resetuj Color, Levels i Curves</button></p>`;

// Kolejność jak w oryginale (plik 01, sekcja 7); Levels i Curves osobno. Wszystko pisze do jednego obiektu color.
const COLOR_ORDER = ['preset', 'photoFilter', 'photoDensity', 'photoPreserve', 'tint', 'tintOpacity', 'blend', 'saturation', 'vibrance', 'hue', 'gradientMap', 'gradientAmount', 'grayscale', 'invertImage'];

/** Panel Color w `root` (z colorHtml()). build() przebudowuje kontrolki z bieżącego stanu (po cofnięciu, resecie). */
export function mountColorPanel(root: HTMLElement, defs: PostDefs['color'], ctx: Ctx<Values>) {
  const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
  const build = () => {
    const by = (ids: string[]) => ids.map((id) => defs.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d);
    const levelIds = defs.filter((d) => d.id.startsWith('levels')).map((d) => d.id);
    const merge = (v: Values) => ctx.set({ ...ctx.get(), ...v });
    mountParamPanel($('[data-color]'), 'Color', by(COLOR_ORDER), ctx.get(), (v) => { merge(v); ctx.change(); }, (v) => { merge(v); ctx.commit(); }, { sections: false });
    mountParamPanel($('[data-levels]'), 'Levels', by(levelIds), ctx.get(), (v) => { merge(v); ctx.change(); }, (v) => { merge(v); ctx.commit(); }, { sections: false });
    const def = defs.find((d) => d.id === 'curves')!.default as Curves;
    const curves = (c: Curves) => ctx.set({ ...ctx.get(), curves: c });
    mountCurves($('[data-curves]'), (ctx.get().curves as Curves | undefined) ?? def, (c) => { curves(c); ctx.change(); }, (c) => { curves(c); ctx.commit(); });
  };
  $('[data-color-reset]').addEventListener('click', () => { ctx.set({}); build(); ctx.commit(); ctx.change(); });
  return { build };
}

/** Panel Post FX w `box`: włącznik i parametry każdego efektu (kolejność stała). style(): bieżący styl, do wyszarzenia
 *  efektów tylko dla stylów glifowych. */
export function mountPostFxPanel(box: HTMLElement, post: PostDefs, style: () => string, ctx: Omit<Ctx<Record<string, Values>>, 'set'>) {
  const build = () => {
    const fx = ctx.get();
    box.innerHTML = `<p class="pp-title">/ Post FX</p><p class="ed-hint">Kolejność stała: od góry do dołu.</p>${post.postFx.map((f) => `
      <div class="ed-fx" data-fx="${f.id}"><label class="ed-fx__on"><input type="checkbox" data-fx-on="${f.id}"${fx[f.id] ? ' checked' : ''}> ${esc(f.name)}</label>
      ${f.glyphOnly ? `<p class="ed-hint" data-fx-note hidden>Tylko style znakowe: Characters, Block, Braille.</p>` : ''}
      <form class="pp ed-fx__params" data-fx-params="${f.id}" onsubmit="return false"${fx[f.id] ? '' : ' hidden'}></form></div>`).join('')}`;
    for (const f of post.postFx) if (fx[f.id]) mountFx(f.id);
    syncGlyph();
  };
  /** Character Bloom i Chromatic działają tylko w stylach glifowych (plik 01, sekcja 8). W innych są wyszarzone; ustawienia zostają
   *  w stanie, więc po powrocie do stylu glifowego wracają (silnik i tak je pomija). */
  const syncGlyph = () => {
    const on = post.glyphStyles.includes(style());
    for (const f of post.postFx) if (f.glyphOnly) {
      const row = box.querySelector<HTMLElement>(`[data-fx="${f.id}"]`); if (!row) continue;
      row.classList.toggle('is-off', !on); row.querySelector<HTMLInputElement>('[data-fx-on]')!.disabled = !on;
      row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-fx-params] input, [data-fx-params] select').forEach((el) => { el.disabled = !on; });
      row.querySelector<HTMLElement>('[data-fx-note]')!.hidden = on;
    }
  };
  const mountFx = (id: string) => {
    const f = post.postFx.find((x) => x.id === id)!; const form = box.querySelector<HTMLFormElement>(`[data-fx-params="${id}"]`)!;
    form.hidden = false;
    ctx.get()[id] = mountParamPanel(form, '', f.params, ctx.get()[id] ?? {}, (v) => { ctx.get()[id] = v; ctx.change(); }, (v) => { ctx.get()[id] = v; ctx.commit(); }, { sections: false })();
    if (f.glyphOnly) syncGlyph();
  };
  box.addEventListener('change', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLInputElement>('[data-fx-on]'); if (!c) return;
    const id = c.dataset.fxOn!;
    if (c.checked) mountFx(id); else { delete ctx.get()[id]; const form = box.querySelector<HTMLElement>(`[data-fx-params="${id}"]`)!; form.hidden = true; form.innerHTML = ''; }
    ctx.commit(); ctx.change();
  });
  return { build, syncGlyph };
}
