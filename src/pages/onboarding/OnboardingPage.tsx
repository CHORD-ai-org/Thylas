import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrow, IconChevron } from '../../components/icons';
import { routes } from '../../lib/routes';
import {
  PHASES,
  STEPS,
  initialOnboardingState,
  outlineFor,
  shortFocus,
  suggestedTask,
  validateStep,
  type OnboardingState,
  type PhaseId,
  type Validation,
} from '../../lib/onboarding';
import type { ChatMessage, CollabState, StepActions, StepProps } from './types';
import { initialCollabState } from './types';
import { Starfield } from './Starfield';
import { WelcomeStep } from './steps/WelcomeStep';
import {
  CoworkerNameStep,
  FocusStep,
  InterestsStep,
  NameStep,
  StartingPointStep,
  StyleStep,
  TemplateStep,
  WorkspaceNameStep,
} from './steps/MicroSteps';
import { CollaborationStep } from './steps/CollaborationStep';
import { SummaryStep } from './steps/SummaryStep';
import s from './onboarding.module.css';

/**
 * One question per sheet. The six phases stay visible above the sheet, so the
 * route ahead is never a surprise; inside a phase the questions arrive one at
 * a time. All answers live here for the lifetime of the page and survive Back
 * or a jump to a completed phase. Nothing is written to a store or a server.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [state, setState] = useState<OnboardingState>(initialOnboardingState);
  const [collab, setCollab] = useState<CollabState>(initialCollabState);
  const [error, setError] = useState<Validation>(null);
  const [leaving, setLeaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const messageId = useRef(0);

  const current = STEPS[step]!;
  const phase: PhaseId = current.phase;

  const message = (from: ChatMessage['from'], text: string): ChatMessage => ({
    id: `m${++messageId.current}`,
    from,
    text,
  });

  const patch = (next: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...next }));
    setError(null);
  };

  /* The greeting is composed from answers actually given, and recomposed if
     they change before the collaboration begins. */
  const seed = [state.name, state.focus, state.workspaceName, state.coworkerName].join('|');
  useEffect(() => {
    if (current.id !== 'collaboration') return;
    const name = state.name.trim();
    const focus = state.focus.trim();
    const workspace = state.workspaceName.trim() || 'your workspace';
    const greeting = `Good to work with you${name ? `, ${name}` : ''}. I can see ${workspace} and your current focus${focus ? `: “${shortFocus(focus, 110)}”` : ' is not set yet'}. Here is where I would start.`;
    const intro = message('coworker', greeting);
    setCollab((prev) => {
      if (prev.seed === seed && prev.messages.length > 0) return prev;
      if (prev.phase === 'idle') return { ...prev, seed, messages: [intro] };
      return { ...prev, seed, messages: [intro, ...prev.messages.slice(1)] };
    });
    /* `message` is a local id factory; the seed is the only changing input. */
  }, [current.id, seed]);

  useEffect(() => {
    if (collab.phase !== 'working') return;
    const timer = window.setTimeout(() => {
      setCollab((prev) => {
        if (prev.phase !== 'working') return prev;
        const outline = outlineFor(state, prev.extras);
        const workspace = state.workspaceName.trim() || 'your workspace';
        const folded = prev.pending ? ` I folded “${shortFocus(prev.pending, 56)}” into it.` : '';
        return {
          ...prev,
          phase: 'done',
          pending: null,
          outline,
          messages: [
            ...prev.messages.filter((m) => m.from !== 'system'),
            message('coworker', `Done. Your ${outline.output.toLowerCase()} is in ${workspace}.${folded} Review it and tell me what to change.`),
          ],
        };
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [collab.phase, state]);

  useEffect(() => {
    panelRef.current?.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => navigate(routes.overview(), { replace: true }), 400);
    return () => window.clearTimeout(timer);
  }, [leaving, navigate]);

  const thread = (messages: ChatMessage[], next: ChatMessage[]): ChatMessage[] => {
    const base = messages.filter((m) => m.from !== 'system');
    const trimmed = base.length > 7 ? [base[0]!, ...base.slice(-6)] : base;
    return [...trimmed, ...next];
  };

  const actions: StepActions = {
    runTask: () => {
      const task = suggestedTask(state);
      setCollab((prev) => ({
        ...prev,
        phase: 'working',
        pending: task,
        messages: thread(prev.messages, [message('user', task), message('system', '')]),
      }));
    },
    sendDirection: (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      setCollab((prev) => ({
        ...prev,
        phase: 'working',
        pending: clean,
        extras: [...prev.extras, clean],
        messages: thread(prev.messages, [message('user', clean), message('system', '')]),
      }));
    },
  };

  const focusInvalid = (field: string) => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
      if (!target) return;
      if (field === 'category' || field === 'templateId') {
        target.querySelector<HTMLElement>('button')?.focus();
      } else {
        target.focus();
      }
    });
  };

  const goNext = () => {
    if (leaving) return;
    if (step === STEPS.length - 1) {
      setLeaving(true);
      return;
    }
    const result = validateStep(step, state);
    if (result) {
      setError(result);
      focusInvalid(result.field);
      return;
    }
    setError(null);
    setMaxVisited((visited) => Math.max(visited, step + 1));
    setStep((index) => index + 1);
  };

  const goBack = () => {
    setError(null);
    setStep((index) => Math.max(0, index - 1));
  };

  const jumpToPhase = (target: PhaseId) => {
    const first = STEPS.findIndex((item) => item.phase === target);
    if (first < 0 || first > maxVisited || first === step) return;
    setError(null);
    setStep(first);
  };

  const props: StepProps = { state, patch, invalid: error?.field ?? null, collab, actions };
  const nextLabel = current.id === 'welcome' ? 'Get Started' : current.id === 'enter' ? 'Enter Thylas' : 'Continue';

  return (
    <div className={s.page} data-onboarding data-onboarding-step={current.id}>
      <Starfield />

      <header className={s.topbar}>
        <span className={s.brand}>
          <span className={s.brandMark} aria-hidden>τ</span>
          <span className={s.brandName}>Thylas</span>
        </span>
        <div className={s.topRight}>
          <span className={s.honest}>PREVIEW · NO MODEL</span>
          <span className={s.counter} data-ob-counter>
            {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
          </span>
          <button
            type="button"
            className={s.skip}
            data-ob-skip
            onClick={() => navigate(routes.overview(), { replace: true })}
          >
            Skip
          </button>
        </div>
      </header>

      {/* All six phases remain visible; future ones are disabled, never hidden. */}
      <nav className={s.journey} aria-label="Onboarding phases">
        <ol className={s.journeyList} data-ob-journey>
          {PHASES.map((item, index) => {
            const first = STEPS.findIndex((candidate) => candidate.phase === item.id);
            const last = STEPS.reduce((acc, candidate, i) => (candidate.phase === item.id ? i : acc), first);
            const status = item.id === phase ? 'active' : index < PHASES.findIndex((p) => p.id === phase) ? 'done' : 'future';
            const inside = item.id === phase ? step - first + 1 : 0;
            return (
              <li className={s.journeyItem} key={item.id} data-state={status}>
                <button
                  type="button"
                  className={s.journeyButton}
                  data-ob-step-link={index}
                  data-ob-phase={item.id}
                  aria-label={item.label}
                  aria-current={item.id === phase ? 'step' : undefined}
                  disabled={first > maxVisited || item.id === phase}
                  onClick={() => jumpToPhase(item.id)}
                >
                  <span className={s.journeyDot} aria-hidden />
                  <span>{item.label}</span>
                  {inside > 0 && last > first ? (
                    <span className={s.journeyCount} aria-hidden>{inside}/{last - first + 1}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main className={s.center}>
        <section className={s.panel} data-ob-panel>
          <div className={s.panelBody} ref={panelRef}>
            <div className={s.stage} key={step}>
              <p className={s.eyebrow}>
                <span className={s.eyebrowRule} />
                {current.label}
              </p>
              {step === 0 ? <WelcomeStep /> : null}
              {step === 1 ? <NameStep {...props} /> : null}
              {step === 2 ? <FocusStep {...props} /> : null}
              {step === 3 ? <InterestsStep {...props} /> : null}
              {step === 4 ? <StartingPointStep {...props} /> : null}
              {step === 5 ? <WorkspaceNameStep {...props} /> : null}
              {step === 6 ? <TemplateStep {...props} /> : null}
              {step === 7 ? <CoworkerNameStep {...props} /> : null}
              {step === 8 ? <StyleStep {...props} /> : null}
              {step === 9 ? <CollaborationStep {...props} /> : null}
              {step === 10 ? <SummaryStep {...props} /> : null}
            </div>
          </div>
          <div className={s.panelFoot}>
            {error ? <p className={s.error} role="alert" data-ob-error>{error.message}</p> : null}
            <button
              type="button"
              className={s.back}
              data-ob-back
              disabled={step === 0}
              onClick={goBack}
            >
              <IconChevron size={14} dir="left" />
              Back
            </button>
            <button type="button" className={s.next} data-ob-next onClick={goNext}>
              {nextLabel}
              <IconArrow size={14} />
            </button>
          </div>
        </section>
      </main>

      {leaving ? <div className={s.veil} data-ob-leaving aria-hidden /> : null}
    </div>
  );
}
