// Kafelki z wybranymi efektami (05, sekcja 5.2): 9 kafelków 3×3 (decyzja: hover = płynne przejście do oryginału).
import { ALL } from '../effects/catalog.ts';
import { tileHtml } from '../ui/effect-tile.ts';

/** 9 kafelków (proj?): przekrój kategorii, Characters pierwszy. */
export const TILES = ['characters', 'block-chars', 'braille', 'lego', 'dither', 'hexmosaic', 'halftone', 'gradientmap', 'posterize'];

export const tilesHtml = () => `
<section class="tiles" aria-labelledby="tiles-h">
  <div class="tiles__head">
    <p class="label">/efekty</p>
    <h2 id="tiles-h">Wybrane efekty</h2>
    <p>Każdy efekt ma własne parametry. Otwórz go w edytorze i dopasuj do swojego zdjęcia.</p>
  </div>
  <ul class="tiles__grid">${TILES.map((id) => tileHtml(ALL.find((e) => e.id === id)!)).join('')}</ul>
  <p class="tiles__more"><a class="btn-outline" href="/effects">Pokaż wszystkie</a></p>
</section>`;
