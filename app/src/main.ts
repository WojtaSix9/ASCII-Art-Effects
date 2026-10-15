// Pliki wag z unicode-range: przeglądarka pobiera tylko podzbiory, których używa strona (np. latin + latin-ext dla polskich znaków).
// Pliki podzbiorów (latin-400.css itp.) nie mają unicode-range, więc dwa naraz nadpisują się nawzajem; nie używać.
// Pokrycie znaków dla presetów (Braille, Katakana…) sprawdza krok 2.
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/600.css';
import './styles/tokens.css';
import './styles/base.css';
import { startRouter, type Page } from './router.ts';
import { home, effects, howTo, editor, notFound } from './pages/pages.ts';

// Strona deweloperska ładowana na żądanie, żeby silnik i dane testowe nie trafiały do głównego pakietu.
const devEngine: Page = {
  title: 'Test silnika · ASCII Art Effects', layout: 'site',
  render: () => '<p class="label">/dev</p><h1 tabindex="-1">Test silnika w przeglądarce</h1><p>Ładowanie…</p>',
  mount(main) {
    let stop: (() => void) | undefined; let gone = false;
    import('./dev/dev-engine.ts').then((m) => {
      if (gone) return;
      main.innerHTML = m.devEngineHtml(); stop = m.mountDevEngine(main);
    });
    return () => { gone = true; stop?.(); };
  },
};

const devThumbs: Page = {
  title: 'Miniatury · ASCII Art Effects', layout: 'site',
  render: () => '<p class="label">/dev</p><h1 tabindex="-1">Miniatury efektów</h1><p>Ładowanie…</p>',
  mount(main) {
    let stop: (() => void) | undefined; let gone = false;
    import('./dev/thumbs.ts').then((m) => { if (gone) return; main.innerHTML = m.thumbsHtml(); stop = m.mountThumbs(main); });
    return () => { gone = true; stop?.(); };
  },
};

const routes: Record<string, Page> = { '/': home, '/effects': effects, '/how-to': howTo, '/editor': editor, '/dev/engine': devEngine, '/dev/thumbs': devThumbs };

const brand = `<a class="nav__brand" href="/"><span class="nav__logo" aria-hidden="true">▚▞</span>ASCII Art Effects</a>`;

const siteNav = (path: string) => {
  const link = (href: string, text: string) =>
    `<li><a href="${href}"${path === href ? ' aria-current="page"' : ''}>${text}</a></li>`;
  return `<header class="nav">${brand}
    <nav aria-label="Główna"><ul class="nav__links">${link('/effects', 'Efekty')}${link('/how-to', 'Jak używać')}</ul></nav>
    <a class="btn-outline" href="/editor">Otwórz edytor</a></header>`;
};

const editorTop = () => `<header class="ed-top">${brand}</header>`;

const app = document.getElementById('app')!;
let first = true;
let cleanup: void | (() => void);

startRouter(routes, notFound, (page, url) => {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const chrome = page.layout === 'editor' ? editorTop() : siteNav(path);
  const body = `<main id="main" class="${page.mainClass ?? 'page'}">${page.render(url)}</main>`;
  app.innerHTML = `<a class="skip-link" href="#main">Przejdź do treści</a>${chrome}${
    page.layout === 'editor' ? `<div class="ed-body">${body}</div>` : body}`;
  document.title = page.title;
  cleanup?.(); cleanup = page.mount?.(app.querySelector('main')!, url);
  // Po nawigacji w aplikacji przenosimy fokus na nagłówek, żeby czytnik ekranu ogłosił nową stronę.
  if (!first) (app.querySelector('h1') as HTMLElement | null)?.focus();
  first = false;
});
