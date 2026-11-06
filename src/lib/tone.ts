/* The five tones a chip or dot may carry. Declared in lib so that
   components/ui does not import from data/* — a primitive must not know what
   a run is. */
export type Tone = 'live' | 'warn' | 'ok' | 'error' | 'idle';
