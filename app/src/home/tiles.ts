// Kafelki z wybranymi efektami (05, sekcja 5.2): 9 kafelków 3×3, miniatura z public/thumbs/, po najechaniu
// płynne przejście do oryginału z etykietą „Przed” (decyzja użytkownika 15 X 2026). Bez hovera (dotyk): zawsze wynik.
import { READY, beforeUrl, sampleNoFor, thumbUrl, THUMB } from '../config/thumbs.ts';

/** 9 kafelków (proj?): przekrój kategorii, Characters pierwszy. */
export const TILES = ['characters', 'block-chars', 'braille', 'lego', 'dither', 'hexmosaic', 'halftone', 'gradientmap', 'posterize'];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const tilesHtml = () => `
<section class="tiles" aria-labelledby="tiles-h">
  <div class="tiles__head">
    <p class="label">/efekty</p>
    <h2 id="tiles-h">Wybrane efekty</h2>
    <p>Każdy efekt ma własne parametry. Otwórz go w edytorze i dopasuj do swojego zdjęcia.</p>
  </div>
  <ul class="tiles__grid">${TILES.map((id) => {
    const e = READY.find((x) => x.id === id)!; const n = sampleNoFor(id);
    return `<li class="tile"><a href="/editor?style=${id}&amp;sample=${n}" data-tile="${id}">
      <span class="tile__media">
        <img class="tile__after" src="${thumbUrl(id)}" width="${THUMB.w}" height="${THUMB.h}" alt="" loading="lazy" decoding="async">
        <img class="tile__before" src="${beforeUrl(n)}" width="${THUMB.w}" height="${THUMB.h}" alt="" loading="lazy" decoding="async">
        <span class="tile__tag" aria-hidden="true">Przed</span>
      </span>
      <span class="tile__body"><span class="tile__title">${esc(e.name)}</span><span class="tile__desc">${esc(e.description.replace(/`/g, ''))}</span><span class="tile__arrow" aria-hidden="true">›</span></span>
    </a></li>`;
  }).join('')}
  </ul>
  <p class="tiles__more"><a class="btn-outline" href="/effects">Pokaż wszystkie</a></p>
</section>`;
