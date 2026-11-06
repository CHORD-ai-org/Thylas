import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button } from '../components/ui';
import s from './routerror.module.css';

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <div className={s.wrap}>
      <p className={s.code}>Something in this surface failed</p>
      <h1 className={s.title}>{message}</h1>
      <p className={s.hint}>
        The rail still works: this boundary is per route, so the rest of the application is intact.
        Reload to retry — no state was lost, because none of this build's state is on a server.
      </p>
      <Button size="sm" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  );
}
