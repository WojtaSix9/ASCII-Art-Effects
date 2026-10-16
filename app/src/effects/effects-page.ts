// Strona /effects (05, sekcja 6): wszystkie 91 efektów jako kafelki w 10 kategoriach, wyszukiwanie i filtr kategorii.
// Stan filtra w adresie (?q=…&cat=…&anim=1), więc link można zapisać i udostępnić. W kategorii najpierw efekty gotowe.
import { ALL, CATEGORIES, grouped, matches, passesAnim, slug } from './catalog.ts';
import { tileHtml } from '../ui/effect-tile.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ready = ALL.filter((e) => e.status === 'ready').length;

export const effectsHtml = () => `
<div class="fx-head">
  <p class="label">/efekty</p>
  <h1 tabindex="-1">Efekty</h1>
  <p>${ALL.length} efektów w 10 kategoriach; ${ready} działa już w edytorze. Kliknij efekt, żeby otworzyć go w edytorze.</p>
  <div class="fx-tools">
    <label class="sr-only" for="fx-q">Szukaj efektu</label>
    <input id="fx-q" class="fx-search" data-q type="search" placeholder="Szukaj nazwy lub opisu" autocomplete="off">
    <div class="fx-cats" role="group" aria-label="Filtr: kategoria i animacja">
      <button type="button" class="chip" data-cat="" aria-pressed="true">Wszystkie</button>
      ${CATEGORIES.map((c) => `<button type="button" class="chip" data-cat="${slug(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}
      <button type="button" class="chip chip--anim" data-anim aria-pressed="false" title="Pokaż tylko efekty z animacją (łączy się z kategorią)">Animation</button>
    </div>
  </div>
  <p class="fx-count" data-count role="status"></p>
</div>
<div class="fx-results" data-results></div>`;

export function mountEffects(main: HTMLElement, url: URL): () => void {
  const qIn = main.querySelector<HTMLInputElement>('[data-q]')!, results = main.querySelector<HTMLElement>('[data-results]')!, count = main.querySelector<HTMLElement>('[data-count]')!;
  let q = url.searchParams.get('q') ?? '', cat = url.searchParams.get('cat') ?? '', anim = url.searchParams.get('anim') === '1';
  if (cat && !CATEGORIES.some((c) => slug(c) === cat)) cat = '';
  qIn.value = q;

  const draw = () => {
    const list = ALL.filter((e) => matches(e, q, cat) && passesAnim(e, anim));
    main.querySelector('[data-anim]')!.setAttribute('aria-pressed', String(anim));
    main.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
    count.textContent = list.length === ALL.length ? `${ALL.length} efektów` : `${list.length} z ${ALL.length} efektów`;
    results.innerHTML = list.length ? grouped(list).map((g) => `
      <section class="fx-group" data-group="${slug(g.category)}" aria-labelledby="fx-${slug(g.category)}">
        <h2 class="fx-group__title label" id="fx-${slug(g.category)}">/${esc(g.category)} <span>${g.items.length}</span></h2>
        <ul class="tiles__grid">${[...g.items].sort((a, b) => Number(b.status === 'ready') - Number(a.status === 'ready')).map((e) => tileHtml(e)).join('')}</ul>
      </section>`).join('')
      : `<p class="fx-empty">Brak efektów pasujących do filtra${q ? ` „${esc(q)}”` : ''}. <button type="button" class="chip" data-clear>Wyczyść filtr</button></p>`;
    const u = new URL(location.href);
    q ? u.searchParams.set('q', q) : u.searchParams.delete('q'); cat ? u.searchParams.set('cat', cat) : u.searchParams.delete('cat'); anim ? u.searchParams.set('anim', '1') : u.searchParams.delete('anim');
    history.replaceState(null, '', u);
  };

  qIn.addEventListener('input', () => { q = qIn.value; draw(); });
  main.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const b = t.closest<HTMLButtonElement>('[data-cat]'); if (b) { cat = b.dataset.cat!; draw(); return; }
    if (t.closest('[data-anim]')) { anim = !anim; draw(); return; }
    if (t.closest('[data-clear]')) { q = ''; cat = ''; anim = false; qIn.value = ''; draw(); qIn.focus(); }
  });
  draw();
  return () => {};
}
