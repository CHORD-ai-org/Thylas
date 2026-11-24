import { useCallback, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { LoginSheet } from './LoginSheet';
import { QuotePanel } from './QuotePanel';
import { SignInTransition } from './SignInTransition';
import { SketchFrame, SketchUnderline } from './SketchFrame';
import s from './login.module.css';

type Mode = 'signin' | 'create';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sign-in providers. None of them is wired: each one says so, by name. */
const PROVIDERS = ['Google', 'GitHub', 'X'] as const;

/**
 * Sign in / create an account.
 *
 * This page does not authenticate anyone: CHORD owns sign-in (src/lib/session.ts),
 * so the form validates locally, states plainly that nothing is verified, and
 * offers the same dev stand-in the rest of the build uses. No request is made
 * with the password — not even a failed one.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Set once the form is valid: the whole page becomes the transition. */
  const [warp, setWarp] = useState<{
    sheet: DOMRect;
    panel: DOMRect;
    dx: number;
    dy: number;
  } | null>(null);

  /* Creating an account begins the first-run journey; signing in goes to the
     existing profile initialization surface. Both use the same labelled dev
     stand-in the rest of the prototype uses. */
  const finish = useCallback(() => {
    document.cookie = 'thylas_session=dev:u-local:ws-1,ws-research,ws-onda; path=/';
    navigate(mode === 'create' ? routes.onboarding() : routes.profileInit(), { replace: true });
  }, [navigate, mode]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();

    if (address === '') return setError('Enter an email address.');
    if (!EMAIL.test(address)) return setError('That does not look like an email address.');
    if (mode === 'create' && name.trim() === '') return setError('Enter a name.');
    if (password === '') return setError('Enter a password.');

    setError(null);
    setNotice(null);

    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sheetEl = document.querySelector<HTMLElement>('[data-login-sheet]');
    const panelEl = document.querySelector<HTMLElement>('[data-login-panel]');

    if (reduced || !sheetEl || !panelEl) {
      finish();
      return;
    }

    const sheetRect = sheetEl.getBoundingClientRect();
    const panelRect = panelEl.getBoundingClientRect();
    setWarp({
      sheet: sheetRect,
      panel: panelRect,
      dx: window.innerWidth / 2 - (sheetRect.left + sheetRect.width / 2),
      dy: window.innerHeight / 2 - (sheetRect.top + sheetRect.height / 2),
    });
  };

  const switchMode = () => {
    setMode((current) => (current === 'signin' ? 'create' : 'signin'));
    setError(null);
    setNotice(null);
  };

  /* The explicit dev stand-in: the same cookie the e2e suite and the rest of
     the build use. Labelled, never hidden inside the submit path. */
  const enterAsDev = () => {
    document.cookie = 'thylas_session=dev:u-local:ws-1,ws-research,ws-onda; path=/';
    navigate(routes.overview());
  };

  const creating = mode === 'create';

  return (
    <div
      className={s.page}
      data-warp={warp ? 'true' : 'false'}
      aria-busy={warp ? true : undefined}
      style={
        warp
          ? ({
              '--warp-x': `${warp.dx}px`,
              '--warp-y': `${warp.dy}px`,
              '--sheet-left': `${warp.sheet.left}px`,
              '--sheet-top': `${warp.sheet.top}px`,
              '--sheet-width': `${warp.sheet.width}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {/* The visible title lives inside the drag grip; the page still needs a
          heading of its own. */}
      <h1 className={s.srOnly}>{creating ? 'Create an account' : 'Sign in'}</h1>
      <LoginSheet
        title={creating ? 'Create an account' : 'Sign in'}
        corner={
          <Link className={s.logo} to={routes.root()} aria-label="Thylas" data-login-logo>
            <span className={s.logoMark} aria-hidden>
              τ
            </span>
            <span className={s.logoName}>Thylas</span>
          </Link>
        }
      >
        <form className={s.form} onSubmit={submit} noValidate data-login-form>
          {error ? (
            <p className={s.error} role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className={s.notice} role="status">
              {notice}
            </p>
          ) : null}

          <div className={s.oauth}>
            {PROVIDERS.map((provider) => (
              <button
                key={provider}
                type="button"
                className={s.oauthBtn}
                data-oauth={provider.toLowerCase()}
                onClick={() => {
                  setError(null);
                  setNotice(`${provider} sign-in is not connected in this build.`);
                }}
              >
                <SketchFrame seed={`oauth-${provider}`} double={false} />
                <span className={s.oauthLabel}>Continue with {provider}</span>
              </button>
            ))}
          </div>

          <div className={s.divider} aria-hidden />

          {creating ? (
            <div className={s.field}>
              <span className={s.fieldLabel}>Name</span>
              <input
                className={s.input}
                aria-label="Name"
                value={name}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
              />
              <SketchUnderline seed="login-name" />
            </div>
          ) : null}

          <div className={s.field}>
            <span className={s.fieldLabel}>Email</span>
            <input
              className={s.input}
              type="email"
              aria-label="Email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
            <SketchUnderline seed="login-email" />
          </div>

          <div className={s.field}>
            <span className={s.fieldLabel}>Password</span>
            <input
              className={s.input}
              type="password"
              aria-label="Password"
              value={password}
              autoComplete={creating ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)}
            />
            <SketchUnderline seed="login-password" />
          </div>

          <button type="submit" className={s.submit} data-login-submit>
            <SketchFrame seed="login-submit" double={false} />
            <span className={s.submitLabel}>{creating ? 'Create account' : 'Sign in'}</span>
          </button>

          <div className={s.actions}>
            <button type="button" className={s.switchMode} onClick={switchMode} data-login-switch>
              {creating ? 'Sign in instead' : 'Create an account'}
            </button>
          </div>

          <div className={s.devBlock}>
            <p className={s.devNote}>chord owns sign-in — nothing is verified in this build</p>
            <button type="button" className={s.devLink} onClick={enterAsDev} data-dev-enter>
              Continue as local dev user
            </button>
            <Link
              className={s.devLink}
              style={{ marginLeft: 12 }}
              to={routes.onboarding()}
              data-onboarding-preview
            >
              Preview onboarding
            </Link>
          </div>
        </form>
      </LoginSheet>

      <QuotePanel />

      {warp ? <SignInTransition panel={warp.panel} onDone={finish} /> : null}
    </div>
  );
}
