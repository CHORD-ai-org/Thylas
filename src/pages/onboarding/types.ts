import type { OnboardingState, Outline } from '../../lib/onboarding';

export type ChatMessage = {
  id: string;
  from: 'coworker' | 'user' | 'system';
  text: string;
};

export type CollabState = {
  phase: 'idle' | 'working' | 'done';
  /** The answers the greeting was composed from, so changing them re-seeds it. */
  seed: string;
  pending: string | null;
  messages: ChatMessage[];
  extras: string[];
  outline: Outline | null;
};

export type StepActions = {
  runTask: () => void;
  sendDirection: (text: string) => void;
};

export type StepProps = {
  state: OnboardingState;
  patch: (next: Partial<OnboardingState>) => void;
  invalid: string | null;
  collab: CollabState;
  actions: StepActions;
};

export function initialCollabState(): CollabState {
  return {
    phase: 'idle',
    seed: '',
    pending: null,
    messages: [],
    extras: [],
    outline: null,
  };
}
