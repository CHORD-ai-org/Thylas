import { useEffect, useState } from 'react';
import { MOONSHOT_QUOTES } from '../../data/quotes';
import { SketchRule } from './SketchFrame';
import s from './login.module.css';

const HOLD_MS = 9000;
const FADE_MS = 320;

/**
 * The black panel: one quote at a time, fading between them.
 *
 * The panel is the one surface in the app that does not follow the theme —
 * fixed #0A0A0A in all three palettes, a printed wire next to paper.
 *
 * Rotation stops for `prefers-reduced-motion`; the quote still changes, it just
 * cuts instead of fading.
 */
export function QuotePanel() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduced = () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const pending: number[] = [];
    const advance = () => {
      setIndex((current) => (current + 1) % MOONSHOT_QUOTES.length);
      setVisible(true);
    };
    const tick = () => {
      if (reduced()) return advance();
      setVisible(false);
      pending.push(window.setTimeout(advance, FADE_MS));
    };

    const loop = window.setInterval(tick, HOLD_MS);
    return () => {
      window.clearInterval(loop);
      for (const timer of pending) window.clearTimeout(timer);
    };
  }, []);

  const quote = MOONSHOT_QUOTES[index]!;

  return (
    <aside className={s.panel} aria-label="Moonshot thinking">
      <div className={s.panelInner}>
        <p className={s.panelHead}>moonshot thinking</p>
        <SketchRule seed="panel-rule" />
        <div className={s.quoteStage} data-quote-rotator data-quote-count={MOONSHOT_QUOTES.length}>
          <blockquote
            className={[s.quote, visible ? s.quoteOn : ''].join(' ')}
            data-quote={quote.id}
            data-visible={visible ? 'true' : 'false'}
          >
            <p className={s.quoteText}>“{quote.text}”</p>
            <footer className={s.quoteBy}>
              {quote.author}, {quote.year}
              <span className={s.quoteSource}> · {quote.source}</span>
            </footer>
          </blockquote>
        </div>
      </div>
    </aside>
  );
}
