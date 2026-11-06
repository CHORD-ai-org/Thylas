import { RouterProvider } from 'react-router-dom';
import { AppProvider } from '../state/app';
import { router } from './router';

export function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  );
}
