import { useState } from 'react';
import { INTEREST_SUGGESTIONS, sampleOnboardingState } from '../../../lib/onboarding';
import type { StepProps } from '../types';
import s from '../onboarding.module.css';

const SUGGESTED: readonly string[] = INTEREST_SUGGESTIONS;

export function ProfileStep({ state, patch, invalid }: StepProps) {
  const [custom, setCustom] = useState('');

  const toggle = (interest: string) => {
    patch({
      interests: state.interests.includes(interest)
        ? state.interests.filter((i) => i !== interest)
        : [...state.interests, interest],
    });
  };

  const addCustom = () => {
    const value = custom.trim().replace(/\s+/g, ' ');
    if (!value || state.interests.some((i) => i.toLowerCase() === value.toLowerCase())) {
      setCustom('');
      return;
    }
    patch({ interests: [...state.interests, value] });
    setCustom('');
  };

  const customTags = state.interests.filter((i) => !SUGGESTED.includes(i));

  return (
    <>
      <p className={s.eyebrow}><span className={s.eyebrowRule} />02 / Your profile</p>
      <h2 className={s.stepTitle}>A little context, before we begin.</h2>
      <p className={s.stepLede}>
        This becomes your initial profile. It shapes the first task your Coworker suggests, and
        you can refine any of it later.
      </p>

      <div className={s.fieldBlock}>
        <div className={s.fieldHead}>
          <span className={s.fieldNum}>01</span>
          <span className={s.fieldLabel}>Preferred name</span>
          <span className={s.fieldAside}>How you are addressed</span>
        </div>
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
      </div>

      <div className={s.fieldBlock}>
        <div className={s.fieldHead}>
          <span className={s.fieldNum}>02</span>
          <span className={s.fieldLabel}>Current focus <em>— what are you working on right now?</em></span>
          <span className={s.fieldAside}>Right now</span>
        </div>
        <textarea
          className={[s.areaInput, invalid === 'focus' ? s.invalid : ''].join(' ').trim()}
          data-field="focus"
          data-ob-focus
          aria-label="Current focus"
          placeholder="Describe the work in front of you."
          value={state.focus}
          rows={3}
          maxLength={400}
          onChange={(e) => patch({ focus: e.target.value })}
        />
        <p className={s.fieldHint}>The work in front of you, not a list of everything you care about.</p>
      </div>

      <div className={s.fieldBlock}>
        <div className={s.fieldHead}>
          <span className={s.fieldNum}>03</span>
          <span className={s.fieldLabel}>Interests <em>— optional</em></span>
          <span className={s.fieldAside}>Over time</span>
        </div>
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
          {customTags.map((interest) => (
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
            placeholder="Add your own interest"
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
        <p className={s.fieldHint}>Long-term interests stay separate from your current focus.</p>
      </div>

      <button
        type="button"
        className={s.sampleLink}
        data-ob-sample
        onClick={() => {
          const sample = sampleOnboardingState();
          patch({ name: sample.name, focus: sample.focus, interests: sample.interests });
          setCustom('');
        }}
      >
        Use sample answers
      </button>
    </>
  );
}
