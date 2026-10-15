// Kafelek efektu (05, sekcje 5.2 i 6): miniatura, po najechaniu lub fokusie oryginał z etykietą „Przed”.
// Efekt „wkrótce”: bez miniatury (wzór CSS) i bez linku.
import { beforeUrl, sampleNoFor, thumbUrl, THUMB } from '../config/thumbs.ts';
import { displayDescription, type Effect } from '../effects/catalog.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function tileHtml(e: Effect, opts: { eager?: boolean } = {}) {
  const body = `<span class="tile__body"><span class="tile__title">${esc(e.name)}</span><span class="tile__desc">${esc(displayDescription(e))}</span>${
    e.status === 'ready' ? '<span class="tile__arrow" aria-hidden="true">›</span>' : '<span class="tile__soon">Wkrótce</span>'}</span>`;
  if (e.status !== 'ready') return `<li class="tile tile--soon" data-soon="${e.id}"><div class="tile__inner"><span class="tile__media tile__media--soon" aria-hidden="true"></span>${body}</div></li>`;
  const n = sampleNoFor(e.id); const load = opts.eager ? '' : ' loading="lazy"';
  return `<li class="tile"><a href="/editor?style=${e.id}&amp;sample=${n}" data-tile="${e.id}">
    <span class="tile__media">
      <img class="tile__after" src="${thumbUrl(e.id)}" width="${THUMB.w}" height="${THUMB.h}" alt=""${load} decoding="async">
      <img class="tile__before" src="${beforeUrl(n)}" width="${THUMB.w}" height="${THUMB.h}" alt=""${load} decoding="async">
      <span class="tile__tag" aria-hidden="true">Przed</span>
    </span>${body}</a></li>`;
}
