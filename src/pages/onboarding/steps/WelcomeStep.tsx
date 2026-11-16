import s from '../onboarding.module.css';

/** The first sheet: one statement, nothing to configure. */
export function WelcomeStep() {
  return (
    <h1 className={s.hero}>
      Your work deserves more than a conversation<span className={s.heroMuted}>.</span>
    </h1>
  );
}
