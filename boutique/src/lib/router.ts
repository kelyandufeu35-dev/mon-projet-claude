import { useSyncExternalStore } from 'react';

/** Minimal history router: real URLs (good for SEO), no dependency. */
const listeners = new Set<() => void>();

/**
 * Preview builds (VITE_MEMORY_ROUTER=1) keep the route in memory, for hosts
 * that serve the page under an unknown path.
 */
const memory = import.meta.env.VITE_MEMORY_ROUTER === '1';
let memoryPath = '/';

function scrollToHash(hash: string, smooth: boolean) {
  requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }));
}

function notify() {
  listeners.forEach((l) => l());
}

window.addEventListener('popstate', notify);

export function navigate(to: string) {
  if (memory) {
    const [path, hash] = to.split('#');
    const next = path || memoryPath;
    const same = next === memoryPath;
    memoryPath = next;
    notify();
    if (hash) scrollToHash('#' + hash, same);
    else window.scrollTo(0, 0);
    return;
  }
  const url = new URL(to, location.href);
  if (url.origin !== location.origin) {
    location.href = to;
    return;
  }
  if (url.pathname === location.pathname && url.hash) {
    history.pushState(null, '', url.pathname + url.hash);
    document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    notify();
    return;
  }
  history.pushState(null, '', url.pathname + url.search + url.hash);
  notify();
  if (url.hash) {
    requestAnimationFrame(() => document.getElementById(url.hash.slice(1))?.scrollIntoView({ block: 'start' }));
  } else {
    window.scrollTo(0, 0);
  }
}

export function usePath() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (memory ? memoryPath : location.pathname.replace(/\/+$/, '') || '/'),
  );
}

/** Intercepts clicks on internal <a> links. */
export function onLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
  const a = e.currentTarget;
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
  e.preventDefault();
  navigate(href);
}
