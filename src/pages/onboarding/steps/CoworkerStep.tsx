import {
  COWORKER_TEMPLATES,
  WORKING_STYLES,
  templateOf,
  type CoworkerTemplate,
  type OnboardingState,
  type WorkingStyle,
} from '../../../lib/onboarding';
import type { StepProps } from '../types';
import s from '../onboarding.module.css';

function TemplateGlyph({ template }: { template: CoworkerTemplate }) {
  return (
    <svg
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
      <path d={template.glyph} />
    </svg>
  );
}

export function CoworkerStep({ state, patch, invalid }: StepProps) {
  const previous = templateOf(state.templateId);
  const selected = templateOf(state.templateId);

  const choose = (template: CoworkerTemplate) => {
    const next: Partial<OnboardingState> = { templateId: template.id };
    /* Carry the template's defaults forward, without erasing a person's edits. */
    if (!state.coworkerName.trim() || state.coworkerName === previous.name) {
      next.coworkerName = template.name;
    }
    if (!state.responsibility.trim() || state.responsibility === previous.responsibility) {
      next.responsibility = template.responsibility;
    }
    if (state.style === previous.style) next.style = template.style;
    patch(next);
  };

  return (
    <>
      <p className={s.eyebrow}><span className={s.eyebrowRule} />04 / Your coworker</p>
      <h2 className={s.stepTitle}>Meet your first Coworker.</h2>
      <p className={s.stepLede}>
        A working partner with a defined responsibility, not a general-purpose chat box. Start from
        a template, then make it yours.
      </p>

      <div className={s.coworkerLayout} data-field="templateId">
        <div className={s.templateList} role="group" aria-label="Coworker templates">
          {COWORKER_TEMPLATES.map((template, index) => (
            <button
              key={template.id}
              type="button"
              className={s.templateRow}
              data-selected={state.templateId === template.id}
              data-ob-template={template.id}
              aria-pressed={state.templateId === template.id}
              onClick={() => choose(template)}
            >
              <span className={s.templateNum}>{String(index + 1).padStart(2, '0')}</span>
              <span>
                <span className={s.templateName}>{template.name}</span>
                <span className={s.templateApproach}>{template.approach}</span>
              </span>
            </button>
          ))}
        </div>

        <div className={s.templateDetail}>
          <div className={s.detailEyebrowRow}>
            <p className={s.detailEyebrow}>Template / {selected.name}</p>
            <span className={s.detailGlyph}><TemplateGlyph template={selected} /></span>
          </div>
          <h3 className={s.detailName}>{selected.name}</h3>
          <p className={s.detailDesc}>{selected.description}</p>

          <div className={s.detailFacts}>
            <div>
              <p className={s.factLabel}>Core responsibility</p>
              <p className={s.factValue}>{selected.responsibility}</p>
            </div>
            <div>
              <p className={s.factLabel}>Working approach</p>
              <p className={s.factValue}>{selected.approach}</p>
            </div>
          </div>

          <div className={s.customFields}>
            <div className={s.customRow}>
              <span className={s.customLabel}>Coworker name</span>
              <input
                className={[s.customInput, invalid === 'coworkerName' ? s.invalid : ''].join(' ').trim()}
                data-field="coworkerName"
                data-ob-coworker-name
                aria-label="Coworker name"
                value={state.coworkerName}
                maxLength={60}
                onChange={(e) => patch({ coworkerName: e.target.value })}
              />
            </div>
            <div className={s.customRow}>
              <span className={s.customLabel}>Responsibility</span>
              <textarea
                className={s.customArea}
                data-ob-responsibility
                aria-label="Responsibility"
                value={state.responsibility}
                rows={2}
                maxLength={240}
                onChange={(e) => patch({ responsibility: e.target.value })}
              />
            </div>
            <div className={s.customRow}>
              <span className={s.customLabel}>Working style</span>
              <div className={s.styles} role="group" aria-label="Working style">
                {WORKING_STYLES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={s.styleOption}
                    data-selected={state.style === option.id}
                    data-ob-style={option.id}
                    aria-pressed={state.style === option.id}
                    onClick={() => patch({ style: option.id as WorkingStyle })}
                  >
                    <span className={s.styleName}>{option.label}</span>
                    <span className={s.styleHint}>{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className={s.sectionNote}>
        Mind Framework and Methodologies stay out of the way until you need them.
      </p>
    </>
  );
}
