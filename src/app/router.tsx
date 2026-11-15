import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { LoginPage } from '../pages/auth/LoginPage';
import { RouteError } from './RouteError';
import { routerChildren } from './routerChildren';

export const router = createBrowserRouter([
  /* Sign in is the only page outside the shell: no rail, no dock, its own
     two-column surface (docs/development/auth/LOGIN-PLAN.md). */
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteError />,
  },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: routerChildren,
  },
]);
