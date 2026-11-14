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
        Reload to retry.
      </p>
      <Button size="sm" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  );
}
