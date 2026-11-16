import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { LoginPage } from '../pages/auth/LoginPage';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage';
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
  /* First run is a composed sequence, not a page in the shell: the rail would
     compete with the progress column and imply the environment already exists. */
  {
    path: '/onboarding',
    element: <OnboardingPage />,
    errorElement: <RouteError />,
  },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: routerChildren,
  },
]);
