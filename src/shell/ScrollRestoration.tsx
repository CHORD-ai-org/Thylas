import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { readScroll, saveScroll } from '../lib/scroll';

const REGION = '[data-scroll-region]';

/** One place owns scroll memory. Surfaces only name their scrollable regions
    with `data-scroll-region="..."`, so adding a list does not require a hook
    in every page. Restoring in useLayoutEffect happens before first paint. */
export function ScrollRestoration() {
  const { pathname } = useLocation();
  const current = useRef(pathname);

  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    const onScroll = (event: Event) => {
      const el = event.target as HTMLElement | null;
      // A document-level scroll event has no getAttribute; only named regions
      // are ours to remember.
      if (!el || typeof el.getAttribute !== 'function') return;
      const region = el.getAttribute('data-scroll-region');
      if (!region) return;
      saveScroll(current.current, region, el.scrollTop);
    };

    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);

  useLayoutEffect(() => {
    current.current = pathname;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(REGION))) {
      const region = el.getAttribute('data-scroll-region');
      if (!region) continue;
      const y = readScroll(pathname, region);
      if (y > 0) el.scrollTop = y;
    }
  }, [pathname]);

  return null;
}
