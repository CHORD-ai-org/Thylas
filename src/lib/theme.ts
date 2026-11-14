/** Applies a palette to the document. One place owns the attribute and the
    browser chrome colour, so the store, the command palette and the inline
    pre-paint script can never disagree about what is painted. */
import type { Theme } from '../state/user';

const GROUND: Record<Theme, string> = {
  warm: '#F1EBDD',
  dark: '#0A0A0A',
  light: '#FFFFFF',
};

export const THEME_LABEL: Record<Theme, string> = {
  warm: 'Warm paper',
  dark: 'Black',
  light: 'White',
};

export function applyTheme(theme: Theme | undefined): void {
  const value: Theme = theme === 'dark' || theme === 'light' ? theme : 'warm';
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = value;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', GROUND[value]);
}
