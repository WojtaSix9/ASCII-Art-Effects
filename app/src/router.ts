// Minimalny router po stronie klienta (History API), bez zależności.
export type Page = { title: string; layout: 'site' | 'editor'; render: (url: URL) => string };

export function startRouter(routes: Record<string, Page>, notFound: Page, mount: (page: Page, url: URL) => void) {
  const go = () => {
    const url = new URL(location.href);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    mount(routes[path] ?? notFound, url);
  };

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest('a');
    if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin) return;
    if (a.pathname === location.pathname && a.search === location.search && a.hash) return;
    e.preventDefault();
    if (a.href !== location.href) history.pushState(null, '', a.href);
    go();
  });
  window.addEventListener('popstate', go);
  go();
}
