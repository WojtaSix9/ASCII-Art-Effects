import type { Page } from '../router.ts';
import { heroHtml, mountHero } from '../home/hero.ts';
import { tilesHtml } from '../home/tiles.ts';
import { effectListHtml } from '../home/effect-list.ts';
import { effectsHtml, mountEffects } from '../effects/effects-page.ts';
import { editorHtml, mountEditor } from '../editor/editor.ts';
import { howToHtml, licensesHtml, mountLicenses } from './info.ts';
import { logoHtml, mountLogo } from '../logo/logo-page.ts';
import { videoHtml, mountVideo } from '../video/video-page.ts';

// Szkielet (krok 1). Treści BRAK: do napisania i zatwierdzenia w kolejnych krokach (05, sekcje 5–8).
const stub = (label: string, heading: string, note: string) => () =>
  `<p class="label">${label}</p><h1 tabindex="-1">${heading}</h1><p>${note}</p>`;

export const home: Page = {
  title: 'ASCII Art Effects', layout: 'site', mainClass: 'page-home',
  render: () => heroHtml() + tilesHtml() + effectListHtml(), mount: (main) => mountHero(main),
};
export const effects: Page = {
  title: 'Efekty · ASCII Art Effects', layout: 'site', mainClass: 'page-effects',
  render: effectsHtml, mount: (main, url) => mountEffects(main, url),
};
export const howTo: Page = {
  title: 'Jak używać · ASCII Art Effects', layout: 'site', mainClass: 'page page-prose',
  render: howToHtml,
};
export const licenses: Page = {
  title: 'Licencje · ASCII Art Effects', layout: 'site', mainClass: 'page page-prose',
  render: licensesHtml, mount: (main) => mountLicenses(main),
};
export const editor: Page = {
  title: 'Edytor · ASCII Art Effects', layout: 'editor', mainClass: 'page-editor',
  render: editorHtml, mount: (main, url) => mountEditor(main, url),
};
export const notFound: Page = {
  title: 'Nie znaleziono · ASCII Art Effects', layout: 'site',
  render: stub('/404', 'Nie znaleziono strony', '<a href="/">Wróć na stronę główną</a>'),
};
export const logo: Page = {
  title: 'Logo · ASCII Art Effects', layout: 'site', mainClass: 'page page-logo',
  render: logoHtml, mount: (main) => mountLogo(main),
};
export const video: Page = {
  title: 'Wideo · ASCII Art Effects', layout: 'site', mainClass: 'page page-logo page-video',
  render: videoHtml, mount: (main) => mountVideo(main),
};
