// Zwarta lista wszystkich 91 efektów na dole strony głównej (05, sekcja 5.3; decyzja użytkownika: wariant A).
// Nazwy w 10 kategoriach; gotowe = link do edytora, „wkrótce” = wyszarzone, bez linku.
import { sampleNoFor } from '../config/thumbs.ts';
import { ALL, grouped } from '../effects/catalog.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ready = ALL.filter((e) => e.status === 'ready').length;

export const effectListHtml = () => `
<section class="elist" aria-labelledby="elist-h">
  <div class="elist__head">
    <p class="label">/wszystkie</p>
    <h2 id="elist-h">Wszystkie efekty</h2>
    <p>${ready} z ${ALL.length} efektów działa już w edytorze, pozostałe są w przygotowaniu. Z miniaturami: <a href="/effects">strona Efekty</a>.</p>
  </div>
  <div class="elist__cols">${grouped(ALL).map((g) => `
    <div class="elist__group"><h3 class="label">${esc(g.category)}</h3><ul>${g.items.map((e) => e.status === 'ready'
      ? `<li><a href="/editor?style=${e.id}&amp;sample=${sampleNoFor(e.id)}" data-elist="${e.id}">${esc(e.name)}</a></li>`
      : `<li class="elist__soon" data-elist-soon="${e.id}">${esc(e.name)}<span class="sr-only"> (wkrótce)</span></li>`).join('')}</ul></div>`).join('')}
  </div>
</section>`;
