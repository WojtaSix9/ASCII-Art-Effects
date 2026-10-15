import type { Page } from '../router.ts';
import { heroHtml, mountHero } from '../home/hero.ts';
import { tilesHtml } from '../home/tiles.ts';
import { editorHtml, mountEditor } from '../editor/editor.ts';

// Szkielet (krok 1). Treści BRAK: do napisania i zatwierdzenia w kolejnych krokach (05, sekcje 5–8).
const stub = (label: string, heading: string, note: string) => () =>
  `<p class="label">${label}</p><h1 tabindex="-1">${heading}</h1><p>${note}</p>`;

export const home: Page = {
  title: 'ASCII Art Effects', layout: 'site', mainClass: 'page-home',
  render: () => heroHtml() + tilesHtml(), mount: (main) => mountHero(main),
};
export const effects: Page = {
  title: 'Efekty · ASCII Art Effects', layout: 'site',
  render: stub('/efekty', 'Efekty', 'Lista 91 efektów z rejestru powstanie w kroku 4.'),
};
export const howTo: Page = {
  title: 'Jak używać · ASCII Art Effects', layout: 'site',
  render: stub('/jak-używać', 'Jak używać', 'Instrukcja powstanie w kroku 8.'),
};
export const editor: Page = {
  title: 'Edytor · ASCII Art Effects', layout: 'editor', mainClass: 'page-editor',
  render: editorHtml, mount: (main, url) => mountEditor(main, url),
};
export const notFound: Page = {
  title: 'Nie znaleziono · ASCII Art Effects', layout: 'site',
  render: stub('/404', 'Nie znaleziono strony', '<a href="/">Wróć na stronę główną</a>'),
};
