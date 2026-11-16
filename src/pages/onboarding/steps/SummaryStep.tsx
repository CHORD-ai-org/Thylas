import { environmentSummary } from '../../../lib/onboarding';
import type { StepProps } from '../types';
import s from '../onboarding.module.css';

export function SummaryStep({ state, collab }: StepProps) {
  const rows = environmentSummary(state, collab.outline, collab.phase === 'done');

  return (
    <>
      <h2 className={s.stepTitle}>Your first working environment is ready.</h2>

      <ol className={s.summaryList} data-ob-summary>
        {rows.map((row, index) => (
          <li className={s.summaryRow} key={row.label} data-ob-summary-row={index}>
            <span className={s.summaryNum}>{String(index + 1).padStart(2, '0')}</span>
            <span className={s.summaryLabel}>{row.label}</span>
            <div>
              <p className={s.summaryValue}>{row.value}</p>
              <p className={s.summaryDetail}>{row.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
