import type { Page } from '../router.ts';

// Szkielet (krok 1). Treści BRAK: do napisania i zatwierdzenia w kolejnych krokach (05, sekcje 5–8).
const stub = (label: string, heading: string, note: string) => () =>
  `<p class="label">${label}</p><h1 tabindex="-1">${heading}</h1><p>${note}</p>`;

export const home: Page = {
  title: 'ASCII Art Effects', layout: 'site',
  render: stub('/start', 'ASCII Art Effects', 'Strona główna: hero z suwakiem przed/po i kafelki efektów powstaną w kroku 3.'),
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
  title: 'Edytor · ASCII Art Effects', layout: 'editor',
  render: (url) => {
    const style = url.searchParams.get('style');
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    return stub('/edytor', 'Edytor', `Edytor powstanie w kroku 5.${style ? ` Wybrany styl: <code>${esc(style)}</code>.` : ''}`)();
  },
};
export const notFound: Page = {
  title: 'Nie znaleziono · ASCII Art Effects', layout: 'site',
  render: stub('/404', 'Nie znaleziono strony', '<a href="/">Wróć na stronę główną</a>'),
};
