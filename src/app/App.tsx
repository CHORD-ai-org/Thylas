import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { applyTheme } from '../lib/theme';
import { AppProvider } from '../state/app';
import { prefsOf, useUser } from '../state/user';
import { router } from './router';

/** Keeps the document attribute in step with the stored preference. The
    pre-paint script already set it for the first frame; this covers changes. */
function ThemeEffect() {
  const theme = prefsOf(useUser()).theme;
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return null;
}

export function App() {
  return (
    <AppProvider>
      <ThemeEffect />
      <RouterProvider router={router} />
    </AppProvider>
  );
}
