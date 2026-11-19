import { useEffect, useState } from 'react';

// Üç ekranlık uygulama için kütüphanesiz, History API tabanlı yönlendirme.
const EVENT = 'app:navigate';

export function navigate(to: string, { replace = false } = {}) {
  if (to === window.location.pathname) return;
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo(0, 0);
}

export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener('popstate', on);
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener(EVENT, on);
    };
  }, []);
  return path;
}

export type Route = { name: 'home' } | { name: 'lineup' } | { name: 'match'; id: string } | { name: 'notFound' };

export function parseRoute(path: string): Route {
  if (path === '/' || path === '') return { name: 'home' };
  if (path === '/kadro') return { name: 'lineup' };
  const m = path.match(/^\/m\/([A-Za-z0-9]{10,40})\/?$/);
  if (m) return { name: 'match', id: m[1] };
  return { name: 'notFound' };
}
