#!/usr/bin/env node
/**
 * Real-browser checks for the UI MVP. Drives headless Chrome over CDP, asserts
 * on DOM state, and starts/ stops the dev server itself so it works from a
 * clean clone.
 *
 *   npm run e2e
 *
 * Requirements: Chrome (or Chromium) reachable; CHROME_PATH overrides detection.
 * Exit code: 0 = all assertions pass, 1 = assertion failure, 2 = harness error.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.E2E_BASE ?? 'http://localhost:5173';
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  return null;
}

async function up() {
  try {
    const res = await fetch(`${BASE}/overview`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('No Chrome found. Set CHROME_PATH to a Chrome/Chromium binary.');
    process.exit(2);
  }

  let server = null;
  if (!(await up())) {
    console.log('starting dev server…');
    server = spawn('npm', ['run', 'dev'], { stdio: 'ignore', shell: process.platform === 'win32' });
    for (let i = 0; i < 60 && !(await up()); i++) await sleep(500);
    if (!(await up())) {
      console.error('Dev server did not start.');
      server.kill();
      process.exit(2);
    }
  }

  const port = 9337;
  const profile = mkdtempSync(join(tmpdir(), 'thylas-e2e-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,900',
    'about:blank',
  ], { stdio: 'ignore' });

  const cleanup = () => {
    chrome.kill();
    server?.kill();
  };
  process.on('exit', cleanup);

  let page = null;
  for (let i = 0; i < 50 && !page; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      page = list.find((t) => t.type === 'page') ?? null;
    } catch {
      await sleep(200);
    }
  }
  if (!page) {
    console.error('Chrome did not expose a page target.');
    cleanup();
    process.exit(2);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    const p = m.id && pending.get(m.id);
    if (p) {
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });
  const send = (method, params = {}) => {
    const msgId = ++id;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
  };

  await send('Page.enable');
  await send('Runtime.enable');

  const goto = async (path) => {
    await send('Page.navigate', { url: `${BASE}${path}` });
    await sleep(900);
  };
  const js = async (body) => {
    const r = await send('Runtime.evaluate', {
      expression: `(async () => { ${body} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };

  const helpers = `
    const byText = (sel, text) => [...document.querySelectorAll(sel)].find(e => e.textContent.trim().includes(text));
    const click = (el) => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  `;

  const results = [];
  const check = (name, actual, expected) => {
    const pass = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
    results.push({ name, pass, actual });
  };

  await goto('/overview');
  check('overview: greeting renders', await js(`return document.querySelector('h1')?.textContent.trim();`), (v) => v?.startsWith('Welcome back'));

  // ---- SP-02 acceptance ----
  check(
    'overview: exactly one display-sized element',
    await js(`
      return [...document.querySelectorAll('main *')]
        .filter(el => el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) >= 24)
        .map(el => el.tagName + '@' + getComputedStyle(el).fontSize);
    `),
    (v) => Array.isArray(v) && v.length === 1,
  );
  check('overview: lede is computed from the sample', await js(`return document.querySelector('main header p')?.textContent.trim();`),
    (v) => typeof v === 'string' && /^\d+ process(es)? (needs|need) a decision/.test(v));
  check('overview: reason is visible before any click', await js(`
    const el = document.getElementById('intent-reason');
    return !!el && el.offsetParent !== null && el.textContent.includes('not connected');
  `), true);
  check('overview: no New workspace affordance', await js(`return !document.body.innerText.includes('New workspace');`), true);
  check('overview: no small text outside glyph tiles', await js(`
    return [...document.querySelectorAll('main *')]
      .filter(el => el.textContent.trim() && !el.className.toString().includes('glyph'))
      .every(el => parseFloat(getComputedStyle(el).fontSize) >= 11);
  `), true);
  const overviewCss = readFileSync(new URL('../src/pages/overview.module.css', import.meta.url), 'utf8');
  check('overview: accent confined to shared primitives', (overviewCss.match(/var\(--accent/g) ?? []).length, 0);

  await js(`${helpers}
    const input = document.querySelector('input[aria-label="Describe what you want to work on"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, 'compare the papers');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    click(byText('button', 'Start'));
    await new Promise(r => setTimeout(r, 200));
  `);
  check('overview: intent does not claim to have been sent', await js(`return document.body.innerText.includes('Nothing was sent') || document.body.innerText.includes('not connected');`), true);
  check('overview: Start stays disabled with text', await js(`
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Start');
    return !!btn && btn.disabled && btn.getAttribute('aria-describedby') === 'intent-reason';
  `), true);
  check('overview: no post-click apology appears', await js(`return !document.body.innerText.includes('Nothing was sent');`), true);
  check('overview: typed text stays in the field', await js(`return document.querySelector('input[aria-label="Describe what you want to work on"]').value;`), 'compare the papers');

  await js(`${helpers} click(byText('button', 'Research')); await new Promise(r => setTimeout(r, 700));`);
  check('rail: opens workspace files', await js(`return location.pathname;`), '/w/ws-research/files');
  check('files: rows render', await js(`return document.querySelectorAll('[role="row"][aria-selected]').length;`), (v) => v >= 5);
  check('panel: selection details are present', await js(`${helpers} return !!byText('aside', 'Used by');`), true);

  const tabsBefore = await js(`return document.querySelectorAll('[role="tab"]').length;`);
  await js(`${helpers}
    const row = document.querySelector('[role="row"][aria-selected]');
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await new Promise(r => setTimeout(r, 700));
  `);
  check('tabs: double-click opens an object tab', await js(`return location.pathname;`), (v) => /^\/w\/ws-research\/files\/f-/.test(v));
  check('tabs: object tab added', (await js(`return document.querySelectorAll('[role="tab"]').length;`)) - tabsBefore, 1);

  await js(`${helpers} click(document.querySelector('[aria-label^="Close "]')); await new Promise(r => setTimeout(r, 700));`);
  check('tabs: closing returns to the room index', await js(`return location.pathname;`), '/w/ws-research/files');
  check('tabs: count restored', await js(`return document.querySelectorAll('[role="tab"]').length;`), tabsBefore);

  // Overflow: nine object tabs in one context. A hidden active tab is the bug
  // this asserts against, so the last one opened is also the one checked.
  const overflowIds = [
    '/w/ws-research/files/f-raw-runs',
    '/w/ws-research/files/f-eval-log',
    '/w/ws-research/files/f-protocol',
    '/w/ws-research/files/f-baseline-md',
    '/w/ws-research/files/f-tokens-run',
    '/w/ws-research/files/f-wu2025',
    '/w/ws-research/files/f-baseline-runs',
    '/w/ws-research/files/f-promptset',
    '/w/ws-research/boards/b-lit',
  ];
  for (const path of overflowIds) await goto(path);
  check(
    'tabs: every object tab carries a type glyph',
    await js(`const tabs = [...document.querySelectorAll('[role="tab"]')].filter(t => t.hasAttribute('title'));
      return tabs.length > 0 && tabs.every(t => t.querySelector('svg'));`),
    true,
  );
  check('tabs: overflow control appears past eight', await js(`return !!document.querySelector('[aria-haspopup="menu"]');`), true);
  check('tabs: strip does not scroll horizontally', await js(`const el = document.querySelector('[role="tablist"]'); return el.scrollWidth <= el.clientWidth + 1;`), true);
  check('tabs: the active tab is never hidden', await js(`return !!document.querySelector('[role="tab"][aria-selected="true"]');`), true);

  await goto('/overview');
  await js(`document.querySelector('[data-rail-item]').focus(); document.querySelector('aside').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true})); await new Promise(r => setTimeout(r, 150));`);
  check('rail: arrow keys move focus between rows', await js(`return document.activeElement?.getAttribute('data-rail-item');`), (v) => typeof v === 'string' && v.length > 1);

  await goto('/notes');
  await js(`${helpers} click(byText('button', 'Method — how we measure')); await new Promise(r => setTimeout(r, 700));`);
  check('notes: opens the reader', await js(`return location.pathname;`), (v) => /^\/notes\/n-/.test(v));
  check('notes: tab carries the title', await js(`${helpers} return !!byText('[role="tab"]', 'Method');`), true);

  await js(`window.dispatchEvent(new KeyboardEvent('keydown', {key:'k', metaKey:true, bubbles:true})); await new Promise(r => setTimeout(r, 250));`);
  check('palette: opens on mod+k', await js(`return !!document.querySelector('[role="dialog"]');`), true);
  await js(`document.querySelector('[role="dialog"] input').dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); await new Promise(r => setTimeout(r, 200));`);
  check('palette: closes on escape', await js(`return !!document.querySelector('[role="dialog"]');`), false);

  await js(`${helpers} window.dispatchEvent(new KeyboardEvent('keydown', {key:'\\\\', metaKey:true, bubbles:true})); await new Promise(r => setTimeout(r, 300));`);
  check('panel: hidden by shortcut', await js(`return !!document.querySelector('aside[aria-label="Scope"]');`), false);
  await js(`${helpers} window.dispatchEvent(new KeyboardEvent('keydown', {key:'\\\\', metaKey:true, bubbles:true})); await new Promise(r => setTimeout(r, 300));`);
  check('panel: restored by shortcut', await js(`return !!document.querySelector('aside[aria-label="Scope"]');`), true);

  await js(`${helpers} click(byText('button', 'Onda Lab')); await new Promise(r => setTimeout(r, 700));`);
  check('workspace: switching changes scope', await js(`return location.pathname;`), '/w/ws-onda/files');

  await js(`${helpers} click(byText('button', 'Processes')); await new Promise(r => setTimeout(r, 600));`);
  await js(`${helpers} click(byText('[role="tab"]', 'Needs input')); await new Promise(r => setTimeout(r, 300));`);
  check('processes: filter narrows the table', await js(`return document.querySelectorAll('button[class*="trow"]').length;`), 1);

  await js(`${helpers} click(byText('button', 'Collapse sidebar')); await new Promise(r => setTimeout(r, 400));`);
  check('rail: collapses', await js(`return document.querySelector('[data-rail]').getAttribute('data-rail');`), 'collapsed');
  await send('Page.reload');
  await sleep(1200);
  check('rail: collapse persists across reload', await js(`return document.querySelector('[data-rail]').getAttribute('data-rail');`), 'collapsed');

  await goto('/w/ws-research/processes/run-baseline');
  check('run: detail renders its bands', await js(`return document.body.innerText.includes('GIVEN TO WAM');`), true);

  // ---- SP-02: every Overview row opens the object it names, in its own workspace ----
  await goto('/overview');
  await js(`${helpers} click(byText('button', 'protocol-brief')); await new Promise(r => setTimeout(r, 600));`);
  check('overview: needs-you row opens its own run', await js(`return location.pathname;`), '/w/ws-onda/processes/run-onda-brief');

  await goto('/overview');
  await js(`${helpers} click(byText('main button', 'raw-runs.parquet')); await new Promise(r => setTimeout(r, 600));`);
  check('overview: continue row resumes the object', await js(`return location.pathname;`), '/w/ws-research/files/f-raw-runs');

  await goto('/overview');
  // 'Onda Lab' also appears in a needs-you row's meta; the ORG badge is what
  // makes the workspace card unambiguous.
  await js(`
    const card = [...document.querySelectorAll('main button')]
      .find(b => b.textContent.includes('Onda Lab') && b.textContent.includes('ORG'));
    card.click();
    await new Promise(r => setTimeout(r, 600));
  `);
  check('overview: workspace card opens that workspace', await js(`return location.pathname;`), '/w/ws-onda/files');
  await goto('/overview');

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `  → ${JSON.stringify(r.actual)}`}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  ws.close();
  cleanup();
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
