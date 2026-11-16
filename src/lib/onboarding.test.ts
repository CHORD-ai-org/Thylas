import { describe, expect, it } from 'vitest';
import {
  COWORKER_TEMPLATES,
  INTEREST_SUGGESTIONS,
  PHASES,
  STEPS,
  WORKING_STYLES,
  WORKSPACE_CATEGORIES,
  buildOutline,
  categoryOf,
  environmentSummary,
  initialOnboardingState,
  outlineToText,
  sampleOnboardingState,
  shortFocus,
  styleOf,
  suggestedTask,
  templateOf,
  validateStep,
} from './onboarding';

describe('onboarding content', () => {
  it('has one question per screen inside six visible phases', () => {
    expect(PHASES).toHaveLength(6);
    expect(STEPS).toHaveLength(11);
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(11);
    expect(new Set(STEPS.map((s) => s.phase)).size).toBe(6);
    /* Only the welcome, collaboration and final screens ask nothing. */
    expect(STEPS.filter((s) => !s.field)).toHaveLength(3);
    expect(new Set(WORKSPACE_CATEGORIES.map((c) => c.id)).size).toBe(6);
    expect(new Set(COWORKER_TEMPLATES.map((t) => t.id)).size).toBe(6);
  });

  it('every template declares a distinct working approach and a retained output', () => {
    const approaches = COWORKER_TEMPLATES.map((t) => t.approach);
    expect(new Set(approaches).size).toBe(6);
    for (const template of COWORKER_TEMPLATES) {
      expect(template.description.length).toBeGreaterThan(30);
      expect(template.responsibility.length).toBeGreaterThan(20);
      expect(template.lines.length).toBeGreaterThanOrEqual(4);
      expect(template.output.length).toBeGreaterThan(0);
      expect(WORKING_STYLES.some((s) => s.id === template.style)).toBe(true);
    }
  });

  it('every starting point has a name, a hint and a drawable glyph', () => {
    for (const category of WORKSPACE_CATEGORIES) {
      expect(category.title.length).toBeGreaterThan(0);
      expect(category.hint.length).toBeGreaterThan(20);
      expect(category.defaultName.length).toBeGreaterThan(0);
      expect(category.glyph.startsWith('M')).toBe(true);
    }
  });

  it('interest suggestions are unique and non-empty', () => {
    expect(INTEREST_SUGGESTIONS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(INTEREST_SUGGESTIONS).size).toBe(INTEREST_SUGGESTIONS.length);
  });

  it('unknown ids fall back to the blank workspace and the generalist', () => {
    expect(categoryOf(null).id).toBe('scratch');
    expect(templateOf(null).id).toBe('generalist');
    expect(styleOf('direct')).toBe('Direct');
  });
});

describe('shortFocus', () => {
  it('collapses whitespace and leaves short text alone', () => {
    expect(shortFocus('  a   question\nwith spaces  ')).toBe('a question with spaces');
  });

  it('truncates on a word boundary and marks the cut', () => {
    const result = shortFocus('Designing an AI-native learning system for long-term context', 24);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(25);
  });
});

describe('validation', () => {
  it('asks for the name on its own screen', () => {
    const state = initialOnboardingState();
    expect(validateStep(1, state)).toEqual({ message: expect.any(String), field: 'name' });
    state.name = 'Ceaser';
    expect(validateStep(1, state)).toBeNull();
  });

  it('asks for the focus on its own screen', () => {
    const state = initialOnboardingState();
    expect(validateStep(2, state)?.field).toBe('focus');
    state.focus = 'A question about context';
    expect(validateStep(2, state)).toBeNull();
  });

  it('asks for a starting point, then a workspace name', () => {
    const state = sampleOnboardingState();
    state.category = null;
    expect(validateStep(4, state)?.field).toBe('category');
    state.category = 'research';
    expect(validateStep(4, state)).toBeNull();
    state.workspaceName = '  ';
    expect(validateStep(5, state)?.field).toBe('workspaceName');
    state.workspaceName = 'Learning Systems';
    expect(validateStep(5, state)).toBeNull();
  });

  it('asks for a template, then a coworker name', () => {
    const state = sampleOnboardingState();
    state.templateId = null;
    expect(validateStep(6, state)?.field).toBe('templateId');
    state.templateId = 'critic';
    expect(validateStep(6, state)).toBeNull();
    state.coworkerName = '';
    expect(validateStep(7, state)?.field).toBe('coworkerName');
    state.coworkerName = 'Mira';
    expect(validateStep(7, state)).toBeNull();
  });

  it('never blocks a screen with no question', () => {
    const state = initialOnboardingState();
    for (const index of [0, 3, 8, 9, 10]) expect(validateStep(index, state)).toBeNull();
  });
});

describe('the simulated first output', () => {
  const state = sampleOnboardingState();

  it('is built from typed answers, with the coworker as author', () => {
    const outline = buildOutline({
      focus: state.focus,
      category: state.category,
      templateId: state.templateId,
      coworkerName: state.coworkerName,
    });
    expect(outline.author).toBe('Mira');
    expect(outline.output).toBe('Research Outline');
    expect(outline.sections[0]?.lines[0]).toContain('AI-native learning system');
    expect(outline.sections[0]?.lines[1]).toContain('Research & Discovery');
    expect(outline.sections.map((s) => s.title)).toEqual([
      'Starting point',
      'The question',
      'Lines of work',
      'First deliverable',
    ]);
  });

  it('uses the selected template\'s own lines of work', () => {
    const generalist = buildOutline({ focus: 'x', category: null, templateId: 'generalist', coworkerName: '' });
    expect(generalist.output).toBe('Structured Note');
    expect(generalist.author).toBe('Generalist');
    expect(generalist.sections[2]?.lines).toEqual(templateOf('generalist').lines);
  });

  it('appends direction the person typed, in order, and drops blanks', () => {
    const outline = buildOutline({
      focus: 'a question',
      category: 'product',
      templateId: 'architect',
      coworkerName: 'K',
      extra: ['  Keep it short  ', '', 'Name the seams'],
    });
    expect(outline.sections.at(-1)?.title).toBe('Your direction');
    expect(outline.sections.at(-1)?.lines).toEqual(['Add: Keep it short', 'Add: Name the seams']);
  });

  it('exports as readable plain text', () => {
    const outline = buildOutline({ focus: 'a question', category: null, templateId: null, coworkerName: 'Mira' });
    const text = outlineToText(outline);
    expect(text.startsWith(outline.title)).toBe(true);
    expect(text).toContain('Starting point\n- a question');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('suggests a task that names the template output and the focus', () => {
    expect(suggestedTask(state)).toContain('research outline');
    expect(suggestedTask(state)).toContain('AI-native learning system');
  });
});

describe('environment summary', () => {
  it('reports what was actually established, including a skipped collaboration', () => {
    const rows = environmentSummary(initialOnboardingState(), null, false);
    expect(rows).toHaveLength(4);
    expect(rows[3]?.value).toBe('Not started');
  });

  it('says whether the output was retained', () => {
    const state = sampleOnboardingState();
    const outline = buildOutline({ focus: state.focus, category: state.category, templateId: state.templateId, coworkerName: state.coworkerName });
    expect(environmentSummary(state, outline, true)[3]?.detail).toBe('Preview only');
    state.kept = true;
    expect(environmentSummary(state, outline, true)[3]?.detail).toBe('Retained in Learning Systems');
  });
});
