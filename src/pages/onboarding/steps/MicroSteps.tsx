import { useState, type ReactNode } from 'react';
import {
  COWORKER_TEMPLATES,
  INTEREST_SUGGESTIONS,
  WORKING_STYLES,
  WORKSPACE_CATEGORIES,
  type WorkspaceCategory,
} from '../../../lib/onboarding';
import type { StepProps } from '../types';
import s from '../onboarding.module.css';

/** One question, one answer. No helper copy, no secondary fields. */
function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2 className={s.stepTitle}>{title}</h2>
      <div className={s.questionField}>{children}</div>
    </>
  );
}

function CategoryGlyph({ category }: { category: WorkspaceCategory }) {
  return (
    <svg
      className={s.matrixGlyph}
      width="20"
      height="20"
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

export function NameStep({ state, patch, invalid }: StepProps) {
  return (
    <Question title="What should we call you?">
      <input
        className={[s.lineInput, invalid === 'name' ? s.invalid : ''].join(' ').trim()}
        data-field="name"
        data-ob-name
        aria-label="Preferred name"
        placeholder="Your name"
        value={state.name}
        maxLength={60}
        onChange={(e) => patch({ name: e.target.value })}
      />
    </Question>
  );
}

export function FocusStep({ state, patch, invalid }: StepProps) {
  return (
    <Question title="What are you working on?">
      <textarea
        className={[s.areaInput, invalid === 'focus' ? s.invalid : ''].join(' ').trim()}
        data-field="focus"
        data-ob-focus
        aria-label="Current focus"
        placeholder="The work in front of you"
        value={state.focus}
        rows={3}
        maxLength={400}
        onChange={(e) => patch({ focus: e.target.value })}
      />
    </Question>
  );
}

export function InterestsStep({ state, patch }: StepProps) {
  const [custom, setCustom] = useState('');
  const suggested: readonly string[] = INTEREST_SUGGESTIONS;

  const toggle = (interest: string) => {
    patch({
      interests: state.interests.includes(interest)
        ? state.interests.filter((i) => i !== interest)
        : [...state.interests, interest],
    });
  };

  const addCustom = () => {
    const value = custom.trim().replace(/\s+/g, ' ');
    if (value && !state.interests.some((i) => i.toLowerCase() === value.toLowerCase())) {
      patch({ interests: [...state.interests, value] });
    }
    setCustom('');
  };

  return (
    <Question title="What are you interested in?">
      <div className={s.tags} data-field="interests">
        {INTEREST_SUGGESTIONS.map((interest) => {
          const on = state.interests.includes(interest);
          return (
            <button
              key={interest}
              type="button"
              className={[s.tag, on ? s.tagOn : ''].join(' ').trim()}
              aria-pressed={on}
              data-ob-interest={interest}
              onClick={() => toggle(interest)}
            >
              {interest}
            </button>
          );
        })}
        {state.interests.filter((i) => !suggested.includes(i)).map((interest) => (
          <button
            key={interest}
            type="button"
            className={[s.tag, s.tagOn].join(' ')}
            aria-pressed
            data-ob-interest-custom={interest}
            onClick={() => toggle(interest)}
          >
            {interest}<span className={s.tagX} aria-hidden>×</span>
          </button>
        ))}
      </div>
      <div className={s.customTag}>
        <input
          className={s.customInput}
          aria-label="Add a custom interest"
          data-ob-interest-input
          placeholder="Add your own"
          value={custom}
          maxLength={40}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button
          type="button"
          className={s.textButton}
          disabled={custom.trim() === ''}
          data-ob-interest-add
          onClick={addCustom}
        >
          Add
        </button>
      </div>
    </Question>
  );
}

export function StartingPointStep({ state, patch, invalid }: StepProps) {
  return (
    <Question title="What would you like to work on?">
      <div
        className={[s.matrix, invalid === 'category' ? s.matrixInvalid : ''].join(' ').trim()}
        data-field="category"
        role="group"
        aria-label="Workspace starting points"
      >
        {WORKSPACE_CATEGORIES.map((category, index) => (
          <button
            key={category.id}
            type="button"
            className={s.matrixCell}
            data-selected={state.category === category.id}
            data-ob-category={category.id}
            aria-pressed={state.category === category.id}
            onClick={() => {
              const previous = WORKSPACE_CATEGORIES.find((c) => c.id === state.category);
              const next: Partial<typeof state> = { category: category.id };
              if (!state.workspaceName.trim() || state.workspaceName === previous?.defaultName) {
                next.workspaceName = category.defaultName;
              }
              patch(next);
            }}
          >
            <span className={s.matrixTop}>
              <span className={s.matrixNum}>{String(index + 1).padStart(2, '0')}</span>
              <CategoryGlyph category={category} />
            </span>
            <span className={s.matrixTitle}>{category.title}</span>
          </button>
        ))}
      </div>
    </Question>
  );
}

export function WorkspaceNameStep({ state, patch, invalid }: StepProps) {
  return (
    <Question title="Name your workspace.">
      <input
        className={[s.lineInput, invalid === 'workspaceName' ? s.invalid : ''].join(' ').trim()}
        data-field="workspaceName"
        data-ob-workspace-name
        aria-label="Workspace name"
        placeholder="Workspace name"
        value={state.workspaceName}
        maxLength={40}
        onChange={(e) => patch({ workspaceName: e.target.value })}
      />
    </Question>
  );
}

export function TemplateStep({ state, patch, invalid }: StepProps) {
  return (
    <Question title="Who would you like to work with?">
      <div
        className={[s.templateList, invalid === 'templateId' ? s.listInvalid : ''].join(' ').trim()}
        data-field="templateId"
        role="group"
        aria-label="Coworker templates"
      >
        {COWORKER_TEMPLATES.map((template, index) => (
          <button
            key={template.id}
            type="button"
            className={s.templateRow}
            data-selected={state.templateId === template.id}
            data-ob-template={template.id}
            aria-pressed={state.templateId === template.id}
            onClick={() => {
              const previous = COWORKER_TEMPLATES.find((t) => t.id === state.templateId);
              const next: Partial<typeof state> = { templateId: template.id };
              if (!state.coworkerName.trim() || state.coworkerName === previous?.name) {
                next.coworkerName = template.name;
              }
              if (!state.responsibility.trim() || state.responsibility === previous?.responsibility) {
                next.responsibility = template.responsibility;
              }
              if (state.style === previous?.style) next.style = template.style;
              patch(next);
            }}
          >
            <span className={s.templateNum}>{String(index + 1).padStart(2, '0')}</span>
            <span className={s.templateName}>{template.name}</span>
          </button>
        ))}
      </div>
    </Question>
  );
}

export function CoworkerNameStep({ state, patch, invalid }: StepProps) {
  return (
    <Question title="Name your coworker.">
      <input
        className={[s.lineInput, invalid === 'coworkerName' ? s.invalid : ''].join(' ').trim()}
        data-field="coworkerName"
        data-ob-coworker-name
        aria-label="Coworker name"
        placeholder="Coworker name"
        value={state.coworkerName}
        maxLength={60}
        onChange={(e) => patch({ coworkerName: e.target.value })}
      />
    </Question>
  );
}

export function StyleStep({ state, patch }: StepProps) {
  return (
    <Question title="How should they work?">
      <div className={s.styles} role="group" aria-label="Working style">
        {WORKING_STYLES.map((option) => (
          <button
            key={option.id}
            type="button"
            className={s.styleOption}
            data-selected={state.style === option.id}
            data-ob-style={option.id}
            aria-pressed={state.style === option.id}
            onClick={() => patch({ style: option.id })}
          >
            <span className={s.styleName}>{option.label}</span>
          </button>
        ))}
      </div>
    </Question>
  );
}
