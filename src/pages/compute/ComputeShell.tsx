import type { ReactNode } from 'react';
import { PlainLayout } from '../../shell/layouts';
import { allWorkloads, resourcesView } from '../../state/compute';
import { ComputeTabs } from './parts';
import s from './compute.module.css';

/**
 * The frame every Compute screen sits in: what the section is, the five
 * screens, and one sentence about what is simulated. The sentence is not
 * decoration — this pool has no executor behind it, and a reader who finds that
 * out by pressing something has been lied to.
 */
export function ComputeShell({
  children,
  title,
  sub,
  actions,
}: {
  children: ReactNode;
  title?: string;
  sub?: string;
  actions?: ReactNode;
}) {
  const resources = resourcesView();
  const runs = allWorkloads().filter((w) => w.state === 'running').length;

  return (
    <PlainLayout size="console">
      <header className={s.head}>
        <div className={s.headText}>
          <p className={s.eyebrow}>CHORD · Compute</p>
          <h1 className={s.title}>{title ?? 'Compute'}</h1>
          <p className={s.sub}>
            {sub ??
              'Local machines, SSH servers and cloud instances in one pool. Thylas reads what each machine can take and helps you choose one; it does not start work in this build.'}
          </p>
        </div>
        {actions ? <div className={s.headActions}>{actions}</div> : null}
      </header>

      <ComputeTabs resourceCount={resources.length} runningCount={runs} />

      <div className={s.body}>{children}</div>
    </PlainLayout>
  );
}
