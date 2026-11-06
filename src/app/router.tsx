import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { RouteError } from './RouteError';
import { routerChildren } from './routerChildren';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: routerChildren,
  },
]);
