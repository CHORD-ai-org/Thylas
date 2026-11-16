import {
  WORKSPACE_CATEGORIES,
  categoryOf,
  type OnboardingState,
  type WorkspaceCategory,
} from '../../../lib/onboarding';
import type { StepProps } from '../types';
import s from '../onboarding.module.css';

function CategoryGlyph({ category }: { category: WorkspaceCategory }) {
  return (
    <svg
      className={s.matrixGlyph}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={category.glyph} />
    </svg>
  );
}

export function WorkspaceStep({ state, patch, invalid }: StepProps) {
  const previous = categoryOf(state.category);

  const select = (category: WorkspaceCategory) => {
    const next: Partial<OnboardingState> = { category: category.id };
    /* Replace a default the person has not edited; keep anything they typed. */
    if (!state.workspaceName.trim() || state.workspaceName === previous.defaultName) {
      next.workspaceName = category.defaultName;
    }
    if (
      !state.workspaceDescription.trim() ||
      state.workspaceDescription === previous.defaultDescription
    ) {
      next.workspaceDescription = category.defaultDescription;
    }
    patch(next);
  };

  return (
    <>
      <p className={s.eyebrow}><span className={s.eyebrowRule} />03 / Your workspace</p>
      <h2 className={s.stepTitle}>What would you like to work on?</h2>
      <p className={s.stepLede}>
        A workspace is a persistent place for work to accumulate — notes, artifacts, and the
        Coworkers who have access to them.
      </p>

      <div className={s.matrix} data-field="category" role="group" aria-label="Workspace starting points">
        {WORKSPACE_CATEGORIES.map((category, index) => (
          <button
            key={category.id}
            type="button"
            className={s.matrixCell}
            data-selected={state.category === category.id}
            data-ob-category={category.id}
            aria-pressed={state.category === category.id}
            onClick={() => select(category)}
          >
            <span className={s.matrixTop}>
              <span className={s.matrixNum}>{String(index + 1).padStart(2, '0')}</span>
              <CategoryGlyph category={category} />
            </span>
            <span className={s.matrixTitle}>{category.title}</span>
            <span className={s.matrixHint}>{category.hint}</span>
          </button>
        ))}
      </div>

      <p className={s.sectionNote}>
        Start from a pattern or from nothing. The name and description are yours to change.
      </p>

      <div className={s.workspaceMeta}>
        <div>
          <div className={s.metaRow}>
            <span className={s.metaLabel}>Workspace name</span>
            <input
              className={[s.metaInput, invalid === 'workspaceName' ? s.invalid : ''].join(' ').trim()}
              data-field="workspaceName"
              data-ob-workspace-name
              aria-label="Workspace name"
              value={state.workspaceName}
              maxLength={40}
              placeholder="Name this environment"
              onChange={(e) => patch({ workspaceName: e.target.value })}
            />
          </div>
          <div className={s.metaRow}>
            <span className={s.metaLabel}>Description · optional</span>
            <input
              className={s.metaInput}
              data-ob-workspace-description
              aria-label="Workspace description"
              value={state.workspaceDescription}
              maxLength={120}
              placeholder="One line about what belongs here"
              onChange={(e) => patch({ workspaceDescription: e.target.value })}
            />
          </div>
        </div>

        <aside className={s.envPlate} data-ob-env>
          <p className={s.envEyebrow}>Environment / preview</p>
          <p className={s.envName} data-ob-env-name>
            {state.workspaceName.trim() || 'Unnamed workspace'}
          </p>
          {state.workspaceDescription.trim() ? (
            <p className={s.envDesc}>{state.workspaceDescription}</p>
          ) : null}
          <p className={s.envFacts}>
            {state.category ? categoryOf(state.category).title : 'No starting point yet'}
            <br />
            0 artifacts · 1 coworker · you
          </p>
        </aside>
      </div>
    </>
  );
}
