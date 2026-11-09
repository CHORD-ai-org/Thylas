import type { WorkloadState } from '../../data/compute';

/** One word per state, used by every Compute screen that shows a run. */
export const STATE_WORD: Record<WorkloadState, string> = {
  running: 'running',
  queued: 'queued',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
};
