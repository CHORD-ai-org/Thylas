#!/usr/bin/env node
/**
 * Real-browser checks + screenshots for the first-run onboarding preview.
 *
 *   node scripts/onboarding-checks.mjs
 *
 * Expects a dev server on http://localhost:5196 (override with OB_BASE).
 * Drives headless Chrome over CDP, walks all six steps, checks that backward
 * navigation keeps data, then re-checks the same flow at a narrow viewport.
 * Screenshots land in design/reference/onboarding/.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(fileURLToPath(import.meta.url), '..');
const OUT = join(here, '..', 'design', 'reference', 'onboarding');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.OB_BASE ?? 'http://localhost:5196';
const PORT = 9261;
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter((p) => p && existsSync(p))[0];
if (!CHROME) throw new Error('Chrome not found; set CHROME_PATH.');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'onboarding-check-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' });

let failed = 0;
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failed += 1;
    console.log(`FAIL  ${label}\n      got: ${JSON.stringify(actual)}\n      expected: ${typeof expected === 'function' ? '(predicate)' : JSON.stringify(expected)}`);
  } else {
    console.log(`ok    ${label}`);
  }
};

let ws;
try {
  await sleep(1600);
  const list = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  });
  const send = (method, params = {}) => {
    const callId = ++id;
    ws.send(JSON.stringify({ id: callId, method, params }));
    return new Promise((resolve) => pending.set(callId, resolve));
  };
  const js = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const shot = async (name) => {
    const captured = await send('Page.captureScreenshot', { format: 'png' });
    if (captured?.data) {
      writeFileSync(join(OUT, `${name}.png`), Buffer.from(captured.data, 'base64'));
      console.log(`shot  ${name}`);
    }
  };
  const next = async () => js(`document.querySelector('[data-ob-next]').click(); 'ok'`);
  const back = async () => js(`document.querySelector('[data-ob-back]').click(); 'ok'`);
  const step = () => js(`document.querySelector('[data-onboarding]')?.dataset.onboardingStep ?? null`);

  const helpers = `
    const setVal = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const q = (s) => document.querySelector(s);
  `;
  /* Statements with their own `return` are executed as-is; bare expressions
     are returned so a check can read a value without boilerplate. */
  const run = (body) => {
    const source = /\breturn\b/.test(body) ? body : `return (${body});`;
    return js(`(() => { ${helpers} ${source} })()`);
  };

  await send('Page.enable');
  await send('Page.bringToFront');
  /* A headless page has no clipboard by default; grant it so the normal copy
     path is exercised. The product still has a selectable-text fallback. */
  const granted = await send('Browser.grantPermissions', {
    origin: BASE,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  });
  if (granted?.error) console.log(`note  clipboard grant unavailable: ${granted.error.message}`);
  await send('Page.navigate', { url: `${BASE}/onboarding` });
  await sleep(1400);
  await run(`localStorage.setItem('thylas:user:v1', JSON.stringify({version:1,prefs:{theme:'warm'}})); return 1;`);
  await send('Page.reload');
  await sleep(1400);

  /* ---- 01 welcome ------------------------------------------------------ */
  check('01: a black sky, one small sheet, all six stops visible', await js(`({
    step: document.querySelector('[data-onboarding]')?.dataset.onboardingStep,
    rail: !!document.querySelector('[data-rail]'),
    hero: document.querySelector('h1')?.innerText.replace(/\\s+/g, ' ').trim(),
    sky: !!document.querySelector('[data-onboarding-stars]'),
    ground: getComputedStyle(document.querySelector('[data-onboarding]')).backgroundColor,
    panel: Math.round(document.querySelector('[data-ob-panel]').getBoundingClientRect().width),
    stops: [...document.querySelectorAll('[data-ob-step-link]')].map((b) => ({
      text: b.innerText.trim(),
      color: getComputedStyle(b).color,
      visible: b.getBoundingClientRect().width > 0 && getComputedStyle(b).visibility === 'visible',
    })),
    theme: document.documentElement.dataset.theme,
    next: document.querySelector('[data-ob-next]')?.innerText.trim(),
  })`), (v) => v.step === 'welcome' && v.rail === false && v.sky === true &&
    v.ground === 'rgb(5, 5, 5)' && v.panel <= 480 && v.theme === 'warm' &&
    v.stops.length === 6 && v.stops.every((s) => s.visible && s.text !== '' && s.color !== 'rgba(0, 0, 0, 0)') &&
    v.next === 'Get Started' && v.hero === 'Your work deserves more than a conversation.');
  await shot('01-welcome');

  /* ---- one question per screen ----------------------------------------- */
  await next();
  await sleep(260);
  check('02: the first sheet asks only for a name', await js(`({
    step: document.querySelector('[data-onboarding]')?.dataset.onboardingStep,
    fields: [...document.querySelectorAll('[data-field]')].map((e) => e.dataset.field),
    asks: document.querySelector('[class*="stepTitle"]')?.textContent.trim(),
    prose: document.querySelectorAll('[class*="stepLede"], [class*="fieldHint"], [class*="sectionNote"]').length,
  })`), { step: 'name', fields: ['name'], asks: 'What should we call you?', prose: 0 });
  await next();
  await sleep(240);
  check('02: an empty name is rejected on its own sheet', await js(`({
    step: document.querySelector('[data-onboarding]')?.dataset.onboardingStep,
    error: document.querySelector('[data-ob-error]')?.textContent.trim() ?? null,
  })`), { step: 'name', error: 'Add a preferred name.' });
  await run(`setVal(q('[data-ob-name]'), 'Ceaser'); return 1;`);
  await next();
  await sleep(240);
  check('02: the focus sheet asks one question', await js(`({
    step: document.querySelector('[data-onboarding]')?.dataset.onboardingStep,
    fields: [...document.querySelectorAll('[data-field]')].map((e) => e.dataset.field),
  })`), { step: 'focus', fields: ['focus'] });
  await run(`setVal(q('[data-ob-focus]'), 'Designing an AI-native learning system that keeps a learner’s context across sessions.'); return 1;`);
  await next();
  await sleep(240);
  check('02: interests are optional and come on their own sheet', await js(`({
    step: document.querySelector('[data-onboarding]')?.dataset.onboardingStep,
    fields: [...document.querySelectorAll('[data-field]')].map((e) => e.dataset.field),
  })`), { step: 'interests', fields: ['interests'] });

  await run(`setVal(q('[data-ob-interest-input]'), 'Knowledge graphs'); q('[data-ob-interest-add]').click(); return 1;`);
  await sleep(180);
  check('02: custom interests can be added and removed', await run(`({
    added: !!q('[data-ob-interest-custom="Knowledge graphs"]'),
    count: document.querySelectorAll('[data-ob-interest-custom]').length,
  })`), { added: true, count: 1 });
  await run(`q('[data-ob-interest-custom="Knowledge graphs"]').click(); return 1;`);
  await sleep(150);
  check('02: removing a custom interest works', await run(`document.querySelectorAll('[data-ob-interest-custom]').length`), 0);
  await shot('02-profile');

  /* Back must not lose the answer. */
  await back();
  await sleep(220);
  check('02: backward navigation keeps the focus answer', await run(`({
    step: q('[data-onboarding]').dataset.onboardingStep,
    focus: q('[data-ob-focus]').value.length > 40,
  })`), { step: 'focus', focus: true });
  await next();
  await sleep(220);

  /* ---- starting point, then workspace name ----------------------------- */
  await next();
  await sleep(240);
  check('03: the starting point is its own sheet', await js(`({
    step: document.querySelector('[data-onboarding]')?.dataset.onboardingStep,
    cells: document.querySelectorAll('[data-ob-category]').length,
    fields: [...document.querySelectorAll('[data-field]')].map((e) => e.dataset.field),
  })`), { step: 'starting-point', cells: 6, fields: ['category'] });
  await next();
  await sleep(220);
  check('03: a starting point is required', await js(`({
    step: document.querySelector('[data-onboarding]')?.dataset.onboardingStep,
    error: document.querySelector('[data-ob-error]')?.textContent.trim() ?? null,
  })`), { step: 'starting-point', error: 'Choose a starting point.' });
  await run(`q('[data-ob-category="research"]').click(); return 1;`);
  await sleep(180);
  check('03: only the chosen starting point is selected', await run(`({
    selected: q('[data-ob-category="research"]').dataset.selected,
    chosen: document.querySelectorAll('[data-ob-category][aria-pressed="true"]').length,
  })`), { selected: 'true', chosen: 1 });
  await shot('03-workspace');
  await next();
  await sleep(240);
  check('03: the workspace name is a separate question', await run(`({
    step: q('[data-onboarding]').dataset.onboardingStep,
    fields: [...document.querySelectorAll('[data-field]')].map((e) => e.dataset.field),
    value: q('[data-ob-workspace-name]').value,
  })`), { step: 'workspace-name', fields: ['workspaceName'], value: 'Research & Discovery' });
  await run(`setVal(q('[data-ob-workspace-name]'), 'Learning Systems'); return 1;`);
  await sleep(160);

  /* ---- template, then name, then working style -------------------------- */
  await next();
  await sleep(240);
  check('04: the template is its own sheet', await js(`({
    step: document.querySelector('[data-onboarding]')?.dataset.onboardingStep,
    templates: document.querySelectorAll('[data-ob-template]').length,
    fields: [...document.querySelectorAll('[data-field]')].map((e) => e.dataset.field),
  })`), { step: 'template', templates: 6, fields: ['templateId'] });
  await run(`q('[data-ob-template="architect"]').click(); return 1;`);
  await sleep(180);
  check('04: only the chosen template is selected', await run(`document.querySelectorAll('[data-ob-template][aria-pressed="true"]').length`), 1);
  await shot('04-coworker');
  await next();
  await sleep(240);
  check('04: the coworker name is a separate question', await run(`({
    step: q('[data-onboarding]').dataset.onboardingStep,
    fields: [...document.querySelectorAll('[data-field]')].map((e) => e.dataset.field),
    value: q('[data-ob-coworker-name]').value,
  })`), { step: 'coworker-name', fields: ['coworkerName'], value: 'Architect' });
  await run(`setVal(q('[data-ob-coworker-name]'), 'Mira'); return 1;`);
  await next();
  await sleep(240);
  check('04: working style is the last small choice', await run(`({
    step: q('[data-onboarding]').dataset.onboardingStep,
    styles: document.querySelectorAll('[data-ob-style]').length,
  })`), { step: 'style', styles: 3 });
  await run(`q('[data-ob-style="direct"]').click(); return 1;`);
  await sleep(160);

  /* ---- 05 collaboration ------------------------------------------------ */
  await next();
  await sleep(300);
  check('05: contextual introduction and a suggested task', await js(`({
    step: document.querySelector('[data-onboarding]')?.dataset.onboardingStep,
    who: document.querySelector('[data-ob-thread-name]')?.textContent.trim(),
    greeting: document.querySelector('[data-ob-message="coworker"]')?.innerText ?? '',
    task: document.querySelector('[data-ob-task]')?.textContent.trim() ?? '',
    empty: document.querySelector('[data-ob-artifact]')?.dataset.obArtifact,
  })`), (v) => v.step === 'collaboration' && v.who === 'Mira' &&
    v.greeting.includes('Ceaser') && v.greeting.includes('Learning Systems') &&
    v.task.includes('architecture draft') && v.empty === 'empty');

  await run(`q('[data-ob-run-task]').click(); return 1;`);
  await sleep(1200);
  check('05: a structured artifact is produced from the answers', await js(`({
    state: document.querySelector('[data-ob-artifact]')?.dataset.obArtifact,
    title: document.querySelector('[data-ob-artifact-title]')?.textContent.trim() ?? '',
    sections: document.querySelectorAll('[class*="outlineSection"]').length,
    firstLine: document.querySelector('[class*="outlineLines"]')?.textContent ?? '',
    messages: document.querySelectorAll('[data-ob-message]').length,
  })`), (v) => v.state === 'ready' && v.title.includes('Architecture Draft') &&
    v.sections === 4 && v.firstLine.includes('AI-native learning system') && v.messages >= 3);

  await run(`q('[data-ob-keep]').click(); return 1;`);
  await sleep(150);
  check('05: the output can be retained', await run(`({
    label: q('[data-ob-keep]').textContent.trim(),
    pressed: q('[data-ob-keep]').getAttribute('aria-pressed'),
    meta: q('[class*="artifactMeta"]').textContent.includes('retained'),
  })`), { label: 'Kept in workspace', pressed: 'true', meta: true });

  await run(`setVal(q('[data-ob-composer]'), 'Keep the boundaries explicit'); q('[data-ob-send]').click(); return 1;`);
  await sleep(1200);
  check('05: a typed direction changes the retained output', await js(`({
    sections: document.querySelectorAll('[class*="outlineSection"]').length,
    direction: [...document.querySelectorAll('[class*="outlineTitle"]')].some(n => n.textContent.trim() === 'Your direction'),
    body: document.querySelector('[data-ob-artifact]').textContent.includes('Keep the boundaries explicit'),
  })`), { sections: 5, direction: true, body: true });
  /* Shoot before the copy probe: a scripted click has no user activation, so
     headless Chrome exercises the selectable-text fallback. */
  await shot('05-collaboration');
  /* The sheet is deliberately small, so the lower part scrolls inside it. */
  await run(`const b = q('[class*="panelBody"]'); b.scrollTop = b.scrollHeight; return 1;`);
  await sleep(180);
  check('05: the artifact controls are reachable inside the sheet', await js(`({
    bottom: Math.round(document.querySelector('[data-ob-keep]').getBoundingClientRect().bottom),
    panel: Math.round(document.querySelector('[data-ob-panel]').getBoundingClientRect().bottom),
    scrolled: document.querySelector('[class*="panelBody"]').scrollTop > 0,
  })`), (v) => v.scrolled && v.bottom <= v.panel + 1);
  await run(`const b = q('[class*="panelBody"]'); b.scrollTop = 0; return 1;`);
  await run(`const o = q('[data-ob-artifact] [class*="artifactBody"]'); o.scrollTop = o.scrollHeight; return 1;`);
  await sleep(200);
  await shot('05-collaboration-artifact');
  await run(`const o = q('[data-ob-artifact] [class*="artifactBody"]'); o.scrollTop = 0; return 1;`);

  await run(`q('[data-ob-copy]').click(); return 1;`);
  await sleep(300);
  check('05: copying the outline works or offers selectable text', await run(`({
    label: q('[data-ob-copy]').textContent.trim(),
    fallback: q('[data-ob-copy-fallback]')?.value ?? null,
  })`), (v) => v.label === 'Copied' ||
    (v.label === 'Try copy again' && typeof v.fallback === 'string' && v.fallback.includes('Architecture Draft')));

  /* ---- 06 summary ------------------------------------------------------ */
  await next();
  await sleep(300);
  check('06: the summary reports what was established', await js(`({
    step: document.querySelector('[data-onboarding]')?.dataset.onboardingStep,
    rows: document.querySelectorAll('[data-ob-summary-row]').length,
    text: document.querySelector('[data-ob-summary]')?.innerText ?? '',
    next: document.querySelector('[data-ob-next]')?.innerText.trim(),
  })`), (v) => v.step === 'enter' && v.rows === 4 &&
    v.text.includes('Learning Systems') && v.text.includes('Mira') &&
    v.text.includes('Architecture Draft') && v.text.includes('Retained in Learning Systems') &&
    v.next === 'Enter Thylas');
  await shot('06-enter');

  /* ---- narrow viewport: same state, no navigation ----------------------- */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(400);
  check('mobile: all six stops stay visible and the sheet fits', await js(`({
    stops: [...document.querySelectorAll('[data-ob-step-link]')].filter((b) => b.getBoundingClientRect().width > 0).length,
    panel: Math.round(document.querySelector('[data-ob-panel]').getBoundingClientRect().width),
    viewport: window.innerWidth,
    overflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
  })`), (v) => v.stops === 6 && v.panel <= v.viewport && v.overflow === true);
  await shot('m-06-enter');
  await back(); await sleep(220); await shot('m-05-collaboration');
  await back(); await sleep(160);
  await back(); await sleep(160);
  await back(); await sleep(220); await shot('m-04-coworker');
  await back(); await sleep(160);
  await back(); await sleep(220); await shot('m-03-workspace');
  await back(); await sleep(220); await shot('m-02-profile');
  await back(); await sleep(160);
  await back(); await sleep(160);
  await back(); await sleep(220); await shot('m-01-welcome');
  check('mobile: walked back to the first sheet', await step(), 'welcome');

  check('mobile: no horizontal overflow on the welcome step', await js(`document.documentElement.scrollWidth <= window.innerWidth + 1`), true);
  await send('Emulation.clearDeviceMetricsOverride');
  await sleep(300);

  /* ---- enter the app --------------------------------------------------- */
  for (let i = 0; i < 10; i += 1) { await next(); await sleep(150); }
  check('final: back at the last step before entering', await step(), 'enter');
  await next();
  await sleep(900);
  check('final: Enter Thylas reaches the application shell', await js(`({
    path: location.pathname,
    rail: !!document.querySelector('[data-rail]'),
    onboarding: !!document.querySelector('[data-onboarding]'),
  })`), { path: '/overview', rail: true, onboarding: false });

  /* ---- sign-up entry --------------------------------------------------- */
  await send('Page.navigate', { url: `${BASE}/login` });
  await sleep(900);
  check('login: an explicit onboarding preview link exists', await js(`({
    preview: document.querySelector('[data-onboarding-preview]')?.getAttribute('href') ?? null,
    dev: !!document.querySelector('[data-dev-enter]'),
  })`), { preview: '/onboarding', dev: true });

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`);
  console.log(`screenshots: ${OUT}`);
} catch (error) {
  failed += 1;
  console.error('HARNESS ERROR', error);
} finally {
  if (ws) ws.close();
  chrome.kill();
  process.exit(failed === 0 ? 0 : 1);
}
