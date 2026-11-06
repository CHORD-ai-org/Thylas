import { useNavigate } from 'react-router-dom';
import { routes } from '../lib/routes';
import { Button } from '../components/ui';
import { PlainLayout } from '../shell/layouts';
import s from './notfound.module.css';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <PlainLayout>
      <div className={s.wrap}>
        <p className={s.code}>404 · no such place</p>
        <h1 className={s.title}>This URL is not part of the application.</h1>
        <p className={s.hint}>
          Every visible surface has a URL, and every URL below points at one. If a link brought you
          here, the object was probably deleted — the workspace it lived in still exists.
        </p>
        <div className={s.actions}>
          <Button variant="primary" onClick={() => navigate(routes.overview())}>
            Overview
          </Button>
          <Button variant="ghost" onClick={() => navigate(routes.recently())}>
            Recently
          </Button>
        </div>
      </div>
    </PlainLayout>
  );
}
