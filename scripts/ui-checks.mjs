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
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
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
  // Anything the page throws is collected, so a render crash reads as the bug
  // it is instead of "the canvas suddenly has no cards".
  const pageErrors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      pageErrors.push(m.params?.exceptionDetails?.exception?.description ?? m.params?.exceptionDetails?.text ?? 'exception');
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
      pageErrors.push((m.params.args ?? []).map((a) => a.description ?? a.value ?? '').join(' '));
    }
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

  // A thrown assertion must not hide the ones that already ran: report what was
  // measured, then fail on the step that stopped the run.
  try {
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

  // ---- SP-04a: one table grammar, measured column budgets ----
  const filesCss = readFileSync(new URL('../src/pages/files.module.css', import.meta.url), 'utf8');
  check('files: no page-local notice recipe', (filesCss.match(/^\.notice \{/gm) ?? []).length, 0);
  check('files: header 44px and rows 32px', await js(`
    const h = document.querySelector('[role="columnheader"]').parentElement.getBoundingClientRect().height;
    const r = document.querySelector('[role="row"][aria-selected]').getBoundingClientRect().height;
    return [Math.round(h), Math.round(r)];
  `), (v) => v[0] === 44 && v[1] === 32);
  check('files: numeric columns are tabular', await js(`
    const el = document.querySelector('[role="gridcell"][class*="mono"]');
    return el ? getComputedStyle(el).fontVariantNumeric : '';
  `), 'tabular-nums');
  const measureTable = () => js(`
    const wrap = document.querySelector('[data-scroll-region="files-table"]');
    const heads = [...document.querySelectorAll('[role="columnheader"]')].filter(h => getComputedStyle(h).display !== 'none');
    return { w: wrap.clientWidth, sw: wrap.scrollWidth, cols: heads.length, name: Math.round(heads[0].getBoundingClientRect().width) };
  `);
  for (const [w, cols] of [[1440, 5], [1280, 4], [1180, 4]]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(350);
    const m = await measureTable();
    check(`files: ${w} shows ${cols} columns, no h-scroll, name >= 160px`, m,
      (v) => v.cols === cols && v.sw <= v.w + 1 && v.name >= 160);
  }
  await send('Emulation.clearDeviceMetricsOverride');
  await sleep(300);

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

  // ---- SP-03a: the tab model survives deep links, deletion and two scopes ----
  await js(`sessionStorage.removeItem('thylas:tabs:v2'); sessionStorage.removeItem('thylas:tabs:v1');`);
  await goto('/w/ws-research/files/f-raw-runs');
  check('tabs: deep link inserts exactly one object tab',
    await js(`return document.querySelectorAll('[role="tab"][title]').length;`), 1);
  // History traversal replaces the CDP execution context, so schedule it after
  // the evaluate returns instead of awaiting inside the page.
  await js(`setTimeout(() => history.back(), 0); return true;`);
  await sleep(900);
  check('tabs: back returns to the previous page without a new tab', await js(`return location.pathname;`), '/overview');
  await js(`setTimeout(() => history.forward(), 0); return true;`);
  await sleep(900);
  check('tabs: forward still shows one object tab',
    await js(`return document.querySelectorAll('[role="tab"][title]').length;`), 1);
  check('tabs: persistence uses the versioned envelope', await js(`
    const v = JSON.parse(sessionStorage.getItem('thylas:tabs:v2'));
    return v.version === 2 && Object.keys(v.contexts).includes('ws:ws-research');
  `), true);

  await js(`
    sessionStorage.setItem('thylas:tabs:v2', JSON.stringify({version:2, contexts:{
      'ws:ws-research': [{id:'/w/ws-research/files/f-gone',kind:'object',type:'file',label:'gone.parquet',path:'/w/ws-research/files/f-gone'}]
    }}));
  `);
  await goto('/w/ws-research/files');
  check('tabs: a deleted object survives reconcile as a tombstone', await js(`
    const t = document.querySelector('[data-missing="true"]');
    return !!t && t.textContent.includes('gone.parquet') && !!t.querySelector('[aria-label^="Close"]');
  `), true);
  await js(`document.querySelector('[data-missing="true"] [aria-label^="Close"]').click(); await new Promise(r => setTimeout(r, 250));`);
  check('tabs: a tombstone can be dismissed', await js(`return document.querySelectorAll('[data-missing="true"]').length;`), 0);

  await goto('/w/ws-onda/files/f-onda-spec');
  check('tabs: two workspace contexts never mix', await js(`
    const c = JSON.parse(sessionStorage.getItem('thylas:tabs:v2')).contexts;
    return (c['ws:ws-onda'] || []).some(t => t.path.includes('f-onda-spec'))
      && !(c['ws:ws-research'] || []).some(t => t.path.includes('f-onda-spec'));
  `), true);

  // ---- SP-03b: per-context panel widths, scroll memory, room-preserving switch ----
  await js(`localStorage.setItem('thylas:ui:v2', JSON.stringify({version:2, railCollapsed:false, panelWidth:{workspace:420, notes:300}}));`);
  await goto('/w/ws-research/files');
  check('panel: workspace width comes from its own context',
    await js(`return document.querySelector('[data-panel-context="workspace"]')?.getBoundingClientRect().width;`), 420);
  await goto('/notes/n-method');
  check('panel: notes width stays 300',
    await js(`return document.querySelector('[data-panel-context="notes"]')?.getBoundingClientRect().width;`), 300);
  await goto('/w/ws-research/files');
  check('panel: both widths survive a reload',
    await js(`return document.querySelector('[data-panel-context="workspace"]')?.getBoundingClientRect().width;`), 420);

  await goto('/notes/n-method');
  const grip = await js(`const b = document.querySelector('[aria-label="Resize panel"]').getBoundingClientRect(); return {x: b.x + b.width / 2, y: b.y + b.height / 2};`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: grip.x, y: grip.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: grip.x - 60, y: grip.y, button: 'left', buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: grip.x - 60, y: grip.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(300);
  check('panel: a real drag changes only the notes width',
    await js(`return document.querySelector('[data-panel-context="notes"]')?.getBoundingClientRect().width;`), 360);
  await goto('/w/ws-research/files');
  check('panel: the drag did not touch the workspace width',
    await js(`return document.querySelector('[data-panel-context="workspace"]')?.getBoundingClientRect().width;`), 420);

  await goto('/overview');
  const savedScroll = await js(`
    const el = document.querySelector('[data-scroll-region="page"]');
    el.scrollTop = 9999;
    const y = el.scrollTop;
    el.dispatchEvent(new Event('scroll', { bubbles: true }));
    return y;
  `);
  check('scroll: the list is actually scrollable', savedScroll, (v) => v > 20);
  await goto('/recently');
  await goto('/overview');
  check('scroll: returning to a list restores its offset',
    await js(`return document.querySelector('[data-scroll-region="page"]').scrollTop;`),
    (v) => Math.abs(v - savedScroll) < 2);

  await goto('/w/ws-research/processes');
  await js(`document.querySelector('[data-ws-row="ws-onda"]').click(); await new Promise(r => setTimeout(r, 500));`);
  check('workspace: switching keeps the room', await js(`return location.pathname;`), '/w/ws-onda/processes');
  await goto('/w/ws-research/files/f-raw-runs');
  await js(`document.querySelector('[data-ws-row="ws-onda"]').click(); await new Promise(r => setTimeout(r, 500));`);
  check('workspace: switching from an object lands on the room index',
    await js(`return location.pathname;`), '/w/ws-onda/files');

  const routerChildren = readFileSync(new URL('../src/app/routerChildren.tsx', import.meta.url), 'utf8');
  check('settings: no dead route in the router', /settings/.test(routerChildren), false);
  const routeFile = readFileSync(new URL('../src/lib/routes.ts', import.meta.url), 'utf8');
  check('settings: no dead route builder', /workspaceSettings/.test(routeFile), false);

  // ---- SP-04b: valid controls, keyboard table, honest actions, tombstones ----
  const filesTsx = readFileSync(new URL('../src/pages/Files.tsx', import.meta.url), 'utf8');
  check('files: no click handler on a span', /<span[^>]*onClick/s.test(filesTsx), false);
  check('files: no post-click apology state', filesTsx.includes('setNotice') || filesTsx.includes('Nothing was sent'), false);
  const pageCss = readdirSync(new URL('../src/pages/', import.meta.url)).filter((f) => f.endsWith('.css'));
  const noticeBlocks = pageCss.reduce(
    (n, f) => n + (readFileSync(new URL(`../src/pages/${f}`, import.meta.url), 'utf8').match(/^\.notice \{/gm) ?? []).length,
    0,
  );
  check('grammar: page-local notice recipes <= 3', noticeBlocks, (v) => v <= 3);

  await goto('/w/ws-research/files');
  check('files: Upload is disabled with a stated reason', await js(`
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Upload');
    return !!b && b.disabled && /files service/.test(b.title) && b.getAttribute('aria-describedby') === 'files-limit';
  `), true);
  check('files: New folder is disabled with a stated reason', await js(`
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'New folder');
    return !!b && b.disabled && /files service/.test(b.title);
  `), true);
  check('files: the reason is visible before any click', await js(`
    const el = document.getElementById('files-limit');
    return !!el && el.offsetParent !== null && el.textContent.includes('not connected');
  `), true);
  await js(`document.querySelector('button[title*="files service"]').click(); await new Promise(r => setTimeout(r, 200));`);
  check('files: clicking a disabled action adds no banner', await js(`return document.querySelectorAll('[class*="banner"]').length;`), 0);

  check('files: folder disclosure is a real button with aria-expanded', await js(`
    const b = document.querySelector('button[aria-label^="Collapse datasets"]');
    return !!b && b.getAttribute('aria-expanded') === 'true';
  `), true);
  await js(`document.querySelector('button[aria-label^="Collapse datasets"]').click(); await new Promise(r => setTimeout(r, 250));`);
  check('files: collapsing does not change selection', await js(`
    return document.querySelector('[role="row"][aria-selected="true"] span[class*="fileName"]')?.textContent;
  `), 'raw-runs.parquet');
  check('files: collapsed folder hides its children', await js(`
    return document.querySelector('button[aria-label^="Expand datasets"]')?.getAttribute('aria-expanded');
  `), 'false');

  await goto('/w/ws-research/files');
  const key = (k) => js(`
    const el = document.querySelector('[data-scroll-region="files-table"]');
    el.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true }));
    await new Promise(r => setTimeout(r, 130));
    return document.querySelector('[role="row"][aria-selected="true"] span[class*="fileName"]')?.textContent ?? null;
  `);
  const lastRow = await key('End');
  check('files: End selects the last row', lastRow, (v) => typeof v === 'string' && v.length > 0);
  check('files: Home selects the first row', await key('Home'), 'raw-runs.parquet');
  check('files: ArrowDown moves one row', await key('ArrowDown'), 'eval-log.csv');
  check('files: Escape clears selection', await key('Escape'), null);
  check('files: cleared selection shows an empty panel', await js(`return document.body.innerText.includes('Nothing selected');`), true);
  await key('Home');
  await key('Enter');
  check('files: Enter opens the selected file', await js(`return location.pathname;`), '/w/ws-research/files/f-raw-runs');
  await js(`document.querySelector('[aria-label^="Close raw-runs"]')?.click(); await new Promise(r => setTimeout(r, 400));`);
  check('files: closing the tab returns to the room', await js(`return location.pathname;`), '/w/ws-research/files');

  await goto('/overview');
  await js(`
    sessionStorage.setItem('thylas:tabs:v2', JSON.stringify({version:2, contexts:{
      'ws:ws-research': [{id:'/w/ws-research/files/f-gone',kind:'object',type:'file',label:'gone.parquet',path:'/w/ws-research/files/f-gone'}]
    }}));
  `);
  await goto('/w/ws-research/files');
  check('files: a deleted object survives as both row and tab', await js(`
    return !!document.querySelector('[data-missing="true"]') && !!document.querySelector('[data-tombstone="true"]');
  `), true);
  await js(`document.querySelector('[data-tombstone="true"]').click(); await new Promise(r => setTimeout(r, 200));`);
  check('files: tombstone panel offers Dismiss', await js(`
    return !![...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Dismiss');
  `), true);
  await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Dismiss').click(); await new Promise(r => setTimeout(r, 250));`);
  check('files: dismissing leaves no orphan row or tab', await js(`
    return !document.querySelector('[data-missing="true"]') && !document.querySelector('[data-tombstone="true"]');
  `), true);

  // ---- SP-06a: one source for scene constants, rendering unchanged ----
  const boardsDir = new URL('../src/pages/boards/', import.meta.url);
  const boardUnits = readdirSync(boardsDir).filter(
    (f) => f !== 'scene.ts' && /\.(ts|tsx|css)$/.test(f) && !/\.test\.ts$/.test(f),
  );
  const boardText = [
    readFileSync(new URL('../src/pages/Boards.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/pages/boards.module.css', import.meta.url), 'utf8'),
    ...boardUnits.map((f) => readFileSync(new URL(f, boardsDir), 'utf8')),
  ].join('\n');
  check('scene: the old 1032x560 canvas is gone from the code', /1032|560/.test(boardText), false);
  const allCss = readdirSync(new URL('../src/pages/', import.meta.url))
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(new URL(`../src/pages/${f}`, import.meta.url), 'utf8'))
    .join('\n');
  check('scene: no numeric scene size anywhere in page CSS', /1032|560/.test(allCss), false);
  check('scene: shared sheet token still resolves to the old 560px width', await js(`
    const d = document.createElement('div');
    d.style.width = 'var(--w-sheet)';
    document.body.appendChild(d);
    const w = getComputedStyle(d).width;
    d.remove();
    return w;
  `), '560px');

  await goto('/w/ws-research/boards/b-lit');
  check('scene: the canvas is a 2400x1600 workspace', await js(`
    const svg = document.querySelector('svg[class*="edgeLayer"]');
    const scene = svg?.parentElement;
    if (!scene) return null;
    const cs = getComputedStyle(scene);
    return {
      w: Math.round(parseFloat(cs.width)),
      h: Math.round(parseFloat(cs.height)),
      svgW: svg.getAttribute('width'),
      svgH: svg.getAttribute('height'),
      cards: document.querySelectorAll('[data-card-id]').length,
    };
  `), (v) => !!v && v.w === 2400 && v.h === 1600 && v.svgW === '2400' && v.svgH === '1600'
    && v.cards === 15);

  check('scene: the first view fits the content instead of the 2400x1600 frame', await js(`
    const label = document.querySelector('[class*="zoomValue"]').textContent.trim();
    const scene = document.querySelector('[data-scene="board"]');
    const m = new DOMMatrix(getComputedStyle(scene).transform);
    return { label, zoom: Number(m.a.toFixed(3)) };
  `), (v) => v.zoom > 0.2 && v.zoom < 1 && v.label === Math.round(v.zoom * 100) + '%');

  await goto('/w/ws-onda/boards/b-onda');
  check('scene: empty board invites the first card instead of blocking the canvas', await js(`
    return document.body.innerText.includes('place the first card');
  `), true);

  // ---- SP-06b: viewport ref, pointer-anchored zoom, pan, clamps ----
  const BOARD = '/w/ws-research/boards/b-lit';
  // The scene element's own box already includes the viewport transform, so
  // screen -> scene is one division by the scale. Measuring it this way keeps
  // the probe honest when the chrome around the canvas moves.
  const probe = () => js(`
    const area = document.querySelector('[class*="canvasArea"]');
    const scene = document.querySelector('[data-scene="board"]');
    const m = new DOMMatrix(getComputedStyle(scene).transform);
    const ar = area.getBoundingClientRect();
    const sr = scene.getBoundingClientRect();
    const label = document.querySelector('[class*="zoomValue"]');
    return { a: m.a, e: m.e, f: m.f, sceneX: sr.left - ar.left, sceneY: sr.top - ar.top,
             areaX: ar.left, areaY: ar.top, areaW: ar.width, areaH: ar.height,
             label: label?.textContent ?? '' };
  `);
  const wheel = (x, y, deltaY, modifiers = 0, deltaX = 0) =>
    send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY, modifiers });
  const keyEvent = (type, k, code, vk, modifiers = 0) =>
    send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers });

  await goto(BOARD);
  let p = await probe();
  check('viewport: the first view is a fit, not a fixed 100%', p.label,
    (v) => v !== '100%' && Math.round(p.a * 100) + '%' === v);
  const cx = p.areaX + p.areaW / 2;
  const cy = p.areaY + p.areaH / 2;

  const scales = [];
  for (let i = 0; i < 30; i++) {
    await wheel(cx, cy, -20, 2);
    await sleep(34);
    scales.push((await probe()).a);
  }
  check('viewport: 30 ctrl+wheel gestures produce 30 distinct zoom steps',
    new Set(scales.map((v) => v.toFixed(4))).size, 30);
  check('viewport: accumulated zoom is continuous, not a single step',
    (await probe()).a / p.a, (v) => v > 2 && v < 3);

  await goto(BOARD);
  p = await probe();
  const pointer = { x: p.areaX + p.areaW * 0.45, y: p.areaY + p.areaH * 0.45 };
  const stagePointer = (v) => ({ x: pointer.x - v.areaX - v.sceneX, y: pointer.y - v.areaY - v.sceneY });
  const scenePoint = (v) => {
    const q = stagePointer(v);
    return { x: q.x / v.a, y: q.y / v.a };
  };
  const before = scenePoint(p);
  await wheel(pointer.x, pointer.y, -120, 2);
  await sleep(90);
  const zoomed = await probe();
  const after = scenePoint(zoomed);
  check('viewport: zoom keeps the point under the pointer fixed', Math.abs(after.x - before.x) + Math.abs(after.y - before.y),
    (v) => v < 2);
  await wheel(pointer.x, pointer.y, 120, 2);
  await sleep(90);
  const restored = scenePoint(await probe());
  check('viewport: zooming back returns to the same scene point',
    Math.abs(restored.x - before.x) + Math.abs(restored.y - before.y), (v) => v < 2);

  await goto(BOARD);
  await js(`
    const scene = document.querySelector('svg[class*="edgeLayer"]').parentElement;
    window.__cardMut = 0;
    window.__obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.target === scene && m.attributeName === 'style') continue;
        window.__cardMut++;
      }
    });
    window.__obs.observe(scene, { attributes: true, childList: true, subtree: true });
  `);
  p = await probe();
  for (let i = 0; i < 10; i++) {
    await wheel(p.areaX + p.areaW / 2, p.areaY + p.areaH / 2, 12, 0, 4);
    await sleep(20);
  }
  const panned = await probe();
  check('viewport: wheel pans the scene', Math.abs(panned.f - p.f), (v) => v > 20);
  check('viewport: wheel pan never re-renders cards', await js(`return window.__cardMut;`), 0);
  await js(`window.__obs.disconnect();`);

  await goto(BOARD);
  p = await probe();
  await keyEvent('keyDown', ' ', 'Space', 32);
  check('viewport: space shows the grab cursor', await js(`
    return document.querySelector('[class*="canvasArea"]').hasAttribute('data-space');
  `), true);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + 60, y: cy + 30, button: 'left', buttons: 1 });
  await sleep(60);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx + 60, y: cy + 30, button: 'left', buttons: 0, clickCount: 1 });
  const dragged = await probe();
  check('viewport: space-drag pans 1:1', [Math.round(dragged.e - p.e), Math.round(dragged.f - p.f)], [60, 30]);
  check('viewport: pan session releases its listeners', await js(`
    return !document.querySelector('[class*="canvasArea"]').hasAttribute('data-panning');
  `), true);
  await keyEvent('keyUp', ' ', 'Space', 32);

  for (let i = 0; i < 60; i++) await wheel(cx, cy, 200, 2);
  await sleep(120);
  check('viewport: zoom clamps at 10%', (await probe()).label, '10%');
  for (let i = 0; i < 80; i++) await wheel(cx, cy, -200, 2);
  await sleep(120);
  check('viewport: zoom clamps at 400%', (await probe()).label, '400%');
  await keyEvent('keyDown', '0', 'Digit0', 48, 4);
  await keyEvent('keyUp', '0', 'Digit0', 48, 4);
  await sleep(120);
  // Fit centres the content it measured, not the 2400x1600 frame. The content
  // box reserves one capsule band above the first section, so the top margin is
  // larger than the bottom one by exactly that band.
  const fitted = await js(`
    const area = document.querySelector('[class*="canvasArea"]').getBoundingClientRect();
    const rects = [...document.querySelectorAll('[data-card-id],[data-section-id]')].map(e => e.getBoundingClientRect());
    const m = new DOMMatrix(getComputedStyle(document.querySelector('[data-scene="board"]')).transform);
    return {
      l: Math.round(Math.min(...rects.map(r => r.left)) - area.left),
      r: Math.round(area.right - Math.max(...rects.map(r => r.right))),
      t: Math.round(Math.min(...rects.map(r => r.top)) - area.top),
      b: Math.round(area.bottom - Math.max(...rects.map(r => r.bottom))),
      band: Math.round(30 * m.a),
      label: document.querySelector('[class*="zoomValue"]').textContent.trim(),
    };
  `);
  check('viewport: Cmd+0 fits and centres the content', fitted,
    (v) => Math.abs(v.l - v.r) <= 2 && Math.abs(v.t - v.b - v.band) <= 3 && v.label !== '100%');

  // 150-card frame budget. Cards are plain DOM nodes appended to the scene;
  // a pan must cost one O(1) transform write per frame, never a React render.
  await goto(BOARD);
  await js(`
    const scene = document.querySelector('svg[class*="edgeLayer"]').parentElement;
    for (let i = 0; i < 150; i++) {
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;width:180px;height:88px;left:' + ((i % 15) * 66) + 'px;top:' +
        (Math.floor(i / 15) * 52) + 'px;background:#FBF9F4;border:1px solid #E6DED1;pointer-events:none';
      scene.appendChild(d);
    }
    window.__frames = [];
    let last = performance.now();
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__frames.length < 120) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  `);
  for (let i = 0; i < 60; i++) {
    await wheel(cx, cy, i % 2 ? 8 : -8);
    await sleep(16);
  }
  const frames = await js(`return window.__frames.slice(2);`);
  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted.length ? Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2)) : 999;
  check('viewport: 150-card pan holds P95 <= 20ms', p95, (v) => v > 0 && v <= 20);

  // ---- SP-06c: a workspace you can arrange — sections, fills, edges, chrome ----
  const press = (x, y, clickCount = 1, modifiers = 0) =>
    send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount, modifiers });
  const release = (x, y, clickCount = 1, modifiers = 0) =>
    send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount, modifiers });
  const rightClick = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
    await sleep(180);
  };
  const moveTo = async (x, y, buttons = 0) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: buttons ? 'left' : 'none', buttons });
    await sleep(30);
  };
  const dblclick = async (x, y) => {
    await press(x, y, 1);
    await release(x, y, 1);
    await press(x, y, 2);
    await release(x, y, 2);
    await sleep(250);
  };
  const dragTo = async (a, z, { steps = 6, mid } = {}) => {
    await press(a.x, a.y);
    for (let i = 1; i <= steps; i += 1) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: a.x + ((z.x - a.x) * i) / steps,
        y: a.y + ((z.y - a.y) * i) / steps,
        button: 'left',
        buttons: 1,
      });
      await sleep(16);
    }
    if (mid) await mid();
    await release(z.x, z.y);
    await sleep(250);
  };
  const keyPress = async (key, code, vk, modifiers = 0) => {
    await keyEvent('keyDown', key, code, vk, modifiers);
    await keyEvent('keyUp', key, code, vk, modifiers);
    await sleep(230);
  };
  const undoKey = () => keyPress('z', 'KeyZ', 90, 4);
  const redoKey = () => keyPress('z', 'KeyZ', 90, 12);

  const counts = () => js(`
    return {
      cards: document.querySelectorAll('[data-card-id]').length,
      sections: document.querySelectorAll('[data-section-id]').length,
      edges: document.querySelectorAll('svg[class*="edgeLayer"] [class*="edgeHit"]').length,
    };
  `);
  const badges = () => js(`
    return [...document.querySelectorAll('header span')].map(e => e.textContent.trim())
      .filter(t => /^[0-9]+ (CARDS|SECTIONS|EDGES)$/.test(t));
  `);
  const capsules = () => js(`
    return [...document.querySelectorAll('[data-section-id]')].map(s => {
      const name = s.querySelector('[class*="sectionName"]');
      const n = s.querySelector('[class*="sectionCount"]');
      return (name ? name.textContent.trim() : '?') + ':' + (n ? n.textContent.trim() : '?');
    });
  `);
  const cardState = (id) => js(`
    const el = document.querySelector('[data-card-id="${id}"]');
    if (!el) return null;
    const x = parseFloat(el.style.left) || 0;
    const y = parseFloat(el.style.top) || 0;
    return {
      x: Math.round(x),
      y: Math.round(y),
      right: Math.round(x + el.offsetWidth),
      w: el.offsetWidth,
      h: el.offsetHeight,
      color: el.dataset.color || '',
      folded: el.hasAttribute('data-folded'),
      text: el.innerText.split(String.fromCharCode(10)).join(' '),
    };
  `);
  const centerOf = (id) => js(`
    const el = document.querySelector('[data-card-id="${id}"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(14, r.height / 2), left: r.left, right: r.right,
             top: r.top, bottom: r.bottom };
  `);
  const statusMain = () => js(`return document.querySelector('[class*="statusMain"]')?.textContent.trim() || '';`);
  const statusHint = () => js(`return document.querySelector('[class*="statusHint"]')?.textContent.trim() || '';`);
  const zoom100 = async () => {
    await js(`document.querySelector('[title="Reset to 100%"]')?.click(); await new Promise(r => setTimeout(r, 180));`);
  };
  // Wheel-pan the board until an object sits in the middle of the canvas, so a
  // gesture near its edge cannot fall outside the canvas and belong to the rail.
  const centreInCanvas = async (id) => {
    const d = await js(`
      const area = document.querySelector('[class*="canvasArea"]').getBoundingClientRect();
      const r = document.querySelector('[data-card-id="${id}"]').getBoundingClientRect();
      return {
        x: area.left + area.width / 2,
        y: area.top + area.height / 2,
        dx: Math.round(area.left + area.width / 2 - (r.left + r.width / 2)),
        dy: Math.round(area.top + area.height / 2 - (r.top + r.height / 2)),
      };
    `);
    await wheel(d.x, d.y, -d.dy, 0, -d.dx);
    await sleep(220);
  };
  // A point over the canvas that no card, section capsule or dock covers.
  const findBlank = () => js(`
    const area = document.querySelector('[class*="canvasArea"]').getBoundingClientRect();
    const chrome = '[data-card-id],[class*="toolbar"],[class*="minimap"],[class*="zoomDock"],[class*="statusDock"],[class*="hud"],[class*="menu"],aside,header';
    for (let y = Math.round(area.bottom - 90); y > area.top + 90; y -= 9) {
      for (let x = Math.round(area.left + 90); x < area.right - 90; x += 9) {
        const el = document.elementFromPoint(x, y);
        if (!el || el.closest(chrome)) continue;
        return { x, y };
      }
    }
    return null;
  `);

  await goto('/w/ws-research/boards');
  check('boards: New board is disabled with its reason visible before any click', await js(`
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'New board');
    const reason = document.getElementById('boards-limit');
    return {
      disabled: !!b && b.disabled,
      described: b?.getAttribute('aria-describedby'),
      visible: !!reason && reason.offsetParent !== null && /workspace service/.test(reason.textContent),
    };
  `), { disabled: true, described: 'boards-limit', visible: true });
  check('boards: the index states the real card counts', await js(`
    return document.body.innerText.includes('15 cards');
  `), true);

  await goto(BOARD);
  await js(`localStorage.removeItem('thylas:board:v2:b-lit'); localStorage.removeItem('thylas:board:v1:b-lit'); return true;`);
  await goto(BOARD);
  await sleep(320);

  const base = await counts();
  check('cards: the sample board renders 15 cards, 3 sections and 4 edges', base, { cards: 15, sections: 3, edges: 4 });
  check('cards: the badges state what the canvas really renders', [await badges(), base.cards, base.sections, base.edges],
    (v) => JSON.stringify(v[0]) === JSON.stringify([v[1] + ' CARDS', v[2] + ' SECTIONS', v[3] + ' EDGES']));
  check('sections: each capsule counts its own cards', await capsules(), ['Question:5', 'Evidence:7', 'Counter-evidence:3']);
  check('cards: five fills are in use', await js(`
    return [...new Set([...document.querySelectorAll('[data-card-id]')].map(e => e.dataset.color))].sort();
  `), ['amber', 'clay', 'plain', 'sage', 'stone']);
  check('cards: a folded card is one row tall', [(await cardState('c-11')).h, (await cardState('c-11')).folded], [44, true]);
  check('cards: a folded card shows its title and nothing else', await js(`
    const el = document.querySelector('[data-card-id="c-11"]');
    return { rows: el.querySelectorAll('[class*="cardLine"]').length, text: el.innerText.trim() };
  `), (v) => v.rows === 0 && v.text.includes('Held-out set was never frozen'));
  check('cards: refs and live bindings are rendered as rows', await js(`
    const ref = document.querySelector('[data-card-id="c-4"] [class*="cardRef"]');
    const live = document.querySelector('[data-card-id="c-8"] [class*="cardLive"]');
    return { ref: ref?.textContent.trim() || '', live: live?.textContent.trim() || '' };
  `), (v) => v.ref.includes('manifest-2024.json') && /LIVE/.test(v.live));
  check('cards: the toolbar offers five tools that all work', await js(`
    const tools = [...document.querySelectorAll('[role="toolbar"][aria-label="Canvas tools"] button')];
    return { count: tools.length, names: tools.map(b => b.getAttribute('aria-label').split(' ')[0]).join(',') };
  `), { count: 5, names: 'Select,Card,Section,Undo,Redo' });
  check('cards: nothing on the canvas claims an action it did not take', await js(`
    return /deferred|not wired|Nothing was sent/.test(document.body.innerText);
  `), false);

  await zoom100();
  check('viewport: the dock reset puts the scene at 100%', await js(`
    const m = new DOMMatrix(getComputedStyle(document.querySelector('[data-scene="board"]')).transform);
    return { label: document.querySelector('[class*="zoomValue"]').textContent.trim(), k: Number(m.a.toFixed(3)) };
  `), { label: '100%', k: 1 });

  // ---- cards: create, type, move, snap, resize, nudge ----
  const spot = await js(`
    const s = document.querySelector('[data-section-id="s-e"]').getBoundingClientRect();
    const free = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return !!el && !el.closest('[data-card-id],[class*="minimap"],[class*="toolbar"],[class*="zoomDock"],[class*="statusDock"],[class*="hud"],aside,header');
    };
    for (let y = Math.round(s.bottom - 16); y > s.top + 60; y -= 12) {
      for (let x = Math.round(s.left + 24); x < s.right - 24; x += 12) {
        if (!free(x, y) || !free(x + 132, y + 14)) continue;
        return { x, y };
      }
    }
    return null;
  `);
  check('cards: an empty spot inside a section can be found', !!spot, true);
  await dblclick(spot.x, spot.y);
  check('cards: double-click on empty space creates a card in edit mode', [
    (await counts()).cards,
    await js(`return document.activeElement?.getAttribute('aria-label');`),
  ], [16, 'Card title']);

  await send('Input.insertText', { text: 'Refutation needed' });
  await keyPress('Enter', 'Enter', 13);
  const newId = await js(`
    const els = document.querySelectorAll('[data-card-id]');
    return els[els.length - 1].dataset.cardId;
  `);
  check('cards: the typed title is committed', (await cardState(newId)).text.includes('Refutation needed'), true);
  check('cards: the status bar names the edit', await statusHint(), 'Renamed a card');
  check('sections: a card placed inside a section joins it', (await capsules())[1], 'Evidence:8');
  check('cards: a new card is grabbable anywhere in its body', await js(`
    const r = document.querySelector('[data-card-id="${newId}"]').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + 14);
    return el ? (el.closest('[data-card-id]')?.dataset.cardId || 'nothing cards') : 'nothing';
  `), newId);

  const fresh = await cardState(newId);
  const freshGrab = await centerOf(newId);
  await dragTo(freshGrab, { x: freshGrab.x + 17, y: freshGrab.y - 13 });
  check('cards: the card that was just created moves on the first drag', (await cardState(newId)).x - fresh.x,
    (v) => Math.abs(v - 17) <= 6);

  const born = await cardState('c-10');
  const grab = await centerOf('c-10');
  await dragTo(grab, { x: grab.x + 41, y: grab.y + 29 });
  const afterDrag = await cardState('c-10');
  // A snap may correct the drop by up to the 6-unit threshold; a manual drag is
  // never allowed to drift further than that.
  check('cards: a drag moves the card with the pointer', [afterDrag.x - born.x, afterDrag.y - born.y],
    (v) => Math.abs(v[0] - 41) <= 6 && Math.abs(v[1] - 29) <= 6);
  await undoKey();
  check('cards: one undo puts it back', [(await cardState('c-10')).x, (await cardState('c-10')).y], [born.x, born.y]);
  await redoKey();
  check('cards: one redo re-applies it', (await cardState('c-10')).x, afterDrag.x);

  const snapBefore = await cardState('c-12');
  const snapGrab = await centerOf('c-12');
  let guideLines = 0;
  await dragTo(snapGrab, { x: snapGrab.x + 5, y: snapGrab.y }, {
    steps: 4,
    mid: async () => {
      guideLines = await js(`return document.querySelectorAll('[class*="guides"] line').length;`);
    },
  });
  check('cards: a guide appears while a drop would align', guideLines, (v) => v > 0);
  // The drop is pulled onto an axis — whichever neighbour is nearest — so the
  // assertion is that one of the card's three axes now equals another object's,
  // and that the raw 5px offset was corrected rather than kept.
  check('cards: release lands on a neighbour axis, not 5px off it', await js(`
    const el = document.querySelector('[data-card-id="c-12"]');
    const x = parseFloat(el.style.left);
    const w = el.offsetWidth;
    const axes = [x, x + w / 2, x + w];
    const others = [...document.querySelectorAll('[data-card-id]')]
      .filter(o => o !== el)
      .flatMap(o => { const ox = parseFloat(o.style.left); const ow = o.offsetWidth; return [ox, ox + ow / 2, ox + ow]; });
    return { moved: Math.round(x - ${snapBefore.x}), aligned: axes.some(v => others.some(o => Math.abs(v - o) < 0.6)) };
  `), (v) => v.moved !== 5 && v.aligned === true);
  check('cards: the guide is cleared after release', await js(`
    return document.querySelectorAll('[class*="guides"] line').length;
  `), 0);

  await centreInCanvas('c-6');
  const c6 = await centerOf('c-6');
  await press(c6.x, c6.y);
  await release(c6.x, c6.y);
  await sleep(220);
  check('cards: a single selection shows eight resize handles', await js(`
    const hs = [...document.querySelectorAll('[data-card-id="c-6"] [data-resize]')];
    return { count: hs.length, dirs: hs.map(e => e.dataset.dir).sort().join(',') };
  `), { count: 8, dirs: 'e,n,ne,nw,s,se,sw,w' });

  const sizeBefore = await cardState('c-6');
  const seHandle = await js(`
    const r = document.querySelector('[data-card-id="c-6"] [data-dir="se"]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  await dragTo(seHandle, { x: seHandle.x + 40, y: seHandle.y + 29 });
  const grown = await cardState('c-6');
  check('cards: the se handle grows width and height by the drag',
    [grown.w - sizeBefore.w, grown.h - sizeBefore.h],
    (v) => Math.abs(v[0] - 40) <= 2 && Math.abs(v[1] - 29) <= 2);

  const wHandle = await js(`
    const card = document.querySelector('[data-card-id="c-6"]');
    const h = card ? card.querySelector('[data-dir="w"]') : null;
    if (!h) return { missing: true };
    const r = h.getBoundingClientRect();
    return { missing: false, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  check('cards: the west handle is still there after a southeast resize', wHandle, (v) => v.missing === false);
  if (!wHandle.missing) {
    const westBefore = await cardState('c-6');
    await dragTo(wHandle, { x: wHandle.x - 30, y: wHandle.y });
    const westAfter = await cardState('c-6');
    check('cards: the west handle moves the left edge and leaves the right one alone',
      [westAfter.x - westBefore.x, westAfter.right - westBefore.right],
      (v) => Math.abs(v[0] + 30) <= 2 && v[1] === 0);
  }

  await keyPress('ArrowRight', 'ArrowRight', 39);
  const nudgeBase = await cardState('c-6');
  check('cards: an arrow key nudges 1px', (await cardState('c-6')).x, nudgeBase.x + 1);
  await keyPress('ArrowLeft', 'ArrowLeft', 37, 8);
  check('cards: shift+arrow nudges 10px', (await cardState('c-6')).x, nudgeBase.x - 9);

  // ---- selection: marquee, the floating bar, folding, deleting ----
  // Walking back to the original box also clears the strip of canvas the
  // marquee needs: the resized card was hanging into it.
  for (let i = 0; i < 6 && JSON.stringify(await cardState('c-6')) !== JSON.stringify(sizeBefore); i += 1) {
    await undoKey();
  }
  check('cards: undo walks every resize back to the original box', await cardState('c-6'), sizeBefore);
  await keyPress('Escape', 'Escape', 27);
  const band = await js(`
    const a = document.querySelector('[data-card-id="c-7"]').getBoundingClientRect();
    const b = document.querySelector('[data-card-id="c-9"]').getBoundingClientRect();
    return { from: { x: b.right + 10, y: b.bottom + 10 }, to: { x: a.left - 10, y: a.top - 10 } };
  `);
  await dragTo(band.from, band.to, { steps: 8 });
  check('cards: a marquee selects every card it covers', [
    await statusMain(),
    await js(`return !!document.querySelector('[class*="selectionHud"]');`),
  ], ['3 selected', true]);
  check('cards: the floating bar carries the five fills', await js(`
    return [...document.querySelectorAll('[class*="selectionHud"] [class*="swatch"]')].map(e => e.dataset.color).join(',');
  `), 'plain,sage,amber,clay,stone');

  await js(`
    document.querySelector('[class*="selectionHud"] [aria-label="Colour amber"]')?.click();
    await new Promise(r => setTimeout(r, 240));
  `);
  check('cards: the bar recolours the whole selection', await js(`
    return ['c-7','c-8','c-9'].map(id => document.querySelector('[data-card-id="' + id + '"]').dataset.color).join(',');
  `), 'amber,amber,amber');
  await js(`
    document.querySelector('[class*="selectionHud"] [title="Fold / unfold (F)"]')?.click();
    await new Promise(r => setTimeout(r, 240));
  `);
  check('cards: the bar folds the selection to one row each', await js(`
    return ['c-7','c-8','c-9'].map(id => document.querySelector('[data-card-id="' + id + '"]').offsetHeight).join(',');
  `), '44,44,44');
  await js(`
    document.querySelector('[class*="selectionHud"] [title^="Delete"]')?.click();
    await new Promise(r => setTimeout(r, 260));
  `);
  check('cards: deleting the selection takes the edges that hung off it', await counts(),
    { cards: 13, sections: 3, edges: 3 });
  await undoKey();
  check('cards: one undo brings the cards and their edge back', await counts(),
    { cards: 16, sections: 3, edges: 4 });

  const p7 = await centerOf('c-7');
  await press(p7.x, p7.y);
  await release(p7.x, p7.y);
  await sleep(200);
  const p12 = await centerOf('c-12');
  await press(p12.x, p12.y, 1, 8);
  await release(p12.x, p12.y, 1, 8);
  await sleep(220);
  check('cards: shift-click extends the selection', await statusMain(), '2 selected');
  await js(`
    [...document.querySelectorAll('[aria-label="Align left"]')].filter(b => b.offsetParent !== null)[0]?.click();
    await new Promise(r => setTimeout(r, 240));
  `);
  check('cards: align left gives both cards one x', await js(`
    return [document.querySelector('[data-card-id="c-7"]').style.left, document.querySelector('[data-card-id="c-12"]').style.left];
  `), (v) => v[0] === v[1]);

  const p9 = await centerOf('c-9');
  await press(p9.x, p9.y, 1, 8);
  await release(p9.x, p9.y, 1, 8);
  await sleep(200);
  await js(`
    [...document.querySelectorAll('[aria-label="Distribute vertically"]')].filter(b => b.offsetParent !== null)[0]?.click();
    await new Promise(r => setTimeout(r, 240));
  `);
  check('cards: distribute vertically equalises the gaps', await js(`
    const r = ['c-7','c-12','c-9']
      .map(id => document.querySelector('[data-card-id="' + id + '"]'))
      .map(el => ({ y: parseFloat(el.style.top), h: el.offsetHeight }))
      .sort((a, b) => a.y - b.y);
    return [Math.round(r[1].y - (r[0].y + r[0].h)), Math.round(r[2].y - (r[1].y + r[1].h))];
  `), (v) => Math.abs(v[0] - v[1]) <= 2);
  await undoKey();
  await undoKey();

  // ---- sections: the capsule is the handle, the frame is not the cards ----
  const capsule = await js(`
    const area = document.querySelector('[class*="canvasArea"]').getBoundingClientRect();
    const r = document.querySelector('[data-section-id="s-c"] [class*="sectionCapsule"]').getBoundingClientRect();
    const left = Math.max(r.left, area.left + 6);
    const right = Math.min(r.right, area.right - 6);
    const top = Math.max(r.top, area.top + 4);
    const bottom = Math.min(r.bottom, area.bottom - 4);
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  `);
  await press(capsule.x, capsule.y);
  await release(capsule.x, capsule.y);
  await sleep(230);
  check('sections: the capsule selects the frame', await statusMain(), 'Section · Counter-evidence');
  await js(`
    [...document.querySelectorAll('[class*="panelActions"] button')].filter(b => b.textContent.trim() === 'Delete')[0]?.click();
    await new Promise(r => setTimeout(r, 260));
  `);
  check('sections: deleting a frame keeps the cards it held', await counts(),
    { cards: 16, sections: 2, edges: 4 });
  await undoKey();
  check('sections: undo restores the frame', await counts(), { cards: 16, sections: 3, edges: 4 });

  // ---- context menus: object and blank canvas ----
  const c8 = await centerOf('c-8');
  await rightClick(c8.x, c8.y);
  check('menu: right-clicking a card offers object actions', await js(`
    return [...document.querySelectorAll('[role="menuitem"]')].map(b => b.firstElementChild.textContent.trim());
  `), ['Edit card', 'Rename section', 'Fold / unfold', 'Duplicate', 'Delete']);
  await js(`
    [...document.querySelectorAll('[role="menuitem"]')].find(b => b.textContent.includes('Duplicate'))?.click();
    await new Promise(r => setTimeout(r, 260));
  `);
  check('menu: duplicate copies the card', (await counts()).cards, 17);

  const blank = await findBlank();
  await rightClick(blank.x, blank.y);
  check('menu: right-clicking empty canvas offers creation', await js(`
    return [...document.querySelectorAll('[role="menuitem"]')].map(b => b.firstElementChild.textContent.trim());
  `), ['New card', 'New section', 'Fit the board', 'Undo']);
  await js(`
    [...document.querySelectorAll('[role="menuitem"]')].find(b => b.textContent.includes('New card'))?.click();
    await new Promise(r => setTimeout(r, 260));
  `);
  check('menu: New card places a card and opens it', [
    (await counts()).cards,
    await js(`return document.activeElement?.getAttribute('aria-label');`),
  ], [18, 'Card title']);
  await keyPress('Escape', 'Escape', 27);
  check('menu: an empty new card is discarded, not stored', (await counts()).cards, 17);

  // ---- edges: select, bend, shape, arrows, label, delete ----
  // A line is only clickable where nothing lies on top of it, so the probe
  // samples several points along each edge and keeps the first one that really
  // hit-tests as the edge's own stroke.
  const edgeAt = () => js(`
    const area = document.querySelector('[class*="canvasArea"]').getBoundingClientRect();
    const groups = [...document.querySelectorAll('svg[class*="edgeLayer"] > g[class*="edge"]')];
    for (const g of groups) {
      const hit = g.querySelector('[class*="edgeHit"]');
      const total = hit.getTotalLength();
      for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.25, 0.75]) {
        const s = hit.getPointAtLength(total * t).matrixTransform(hit.getScreenCTM());
        if (s.x < area.left + 40 || s.x > area.right - 40 || s.y < area.top + 60 || s.y > area.bottom - 80) continue;
        const el = document.elementFromPoint(s.x, s.y);
        if (el && (el.getAttribute('class') || '').includes('edgeHit')) return { x: s.x, y: s.y };
      }
    }
    return null;
  `);
  const selectedEdgeD = () => js(`
    const g = document.querySelector('svg[class*="edgeLayer"] > g[data-selected]');
    return g ? g.querySelector('[class*="edgeLine"]').getAttribute('d') : null;
  `);
  const line = await edgeAt();
  check('edges: one line is reachable in the viewport', !!line, true);
  if (line) {
    await press(line.x, line.y);
    await release(line.x, line.y);
    await sleep(240);
    check('edges: clicking a line selects it and shows its bar', [
      await statusMain(),
      await js(`return !!document.querySelector('[class*="edgeHud"]');`),
    ], (v) => v[0].startsWith('Edge · ') && v[1] === true);

    const bendPoint = () => js(`
      const c = document.querySelector('[class*="bendHandle"]');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    `);
    const dBefore = await selectedEdgeD();
    const bendAt = await bendPoint();
    check('edges: a selected curve offers a bend handle', !!bendAt, true);
    if (bendAt) {
      await dragTo(bendAt, { x: bendAt.x + 22, y: bendAt.y - 26 });
      check('edges: dragging the handle bends the curve', (await selectedEdgeD()) !== dBefore, true);
      const bendAt2 = await bendPoint();
      await dblclick(bendAt2.x, bendAt2.y);
      check('edges: double-clicking the handle straightens it again', await selectedEdgeD(), dBefore);
    }

  await js(`
    [...document.querySelectorAll('[class*="edgeHud"] button')].find(b => b.textContent.trim() === 'Elbow')?.click();
    await new Promise(r => setTimeout(r, 240));
  `);
  check('edges: Elbow replaces the curve with right angles', await selectedEdgeD(),
    (v) => typeof v === 'string' && !v.includes('C') && v.includes('L'));
  check('edges: an elbow edge has no bend handle', await js(`
    return !!document.querySelector('[class*="bendHandle"]');
  `), false);
  await js(`
    [...document.querySelectorAll('[class*="edgeHud"] button')].find(b => b.textContent.trim() === '↔')?.click();
    await new Promise(r => setTimeout(r, 240));
  `);
  check('edges: both ends get an arrowhead', await js(`
    const g = document.querySelector('svg[class*="edgeLayer"] > g[data-selected]');
    return g ? g.querySelectorAll('[class*="edgeHead"]').length : 0;
  `), 2);
  await js(`
    const input = document.querySelector('[class*="panelInput"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, 'contradicts');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
    await new Promise(r => setTimeout(r, 280));
  `);
  check('edges: the label is drawn on the line', await js(`
    return [...document.querySelectorAll('svg[class*="labelLayer"] text')].map(t => t.textContent).join('|');
  `), (v) => v.includes('contradicts'));
  await js(`
    document.querySelector('[class*="edgeHud"] [title="Delete the edge"]')?.click();
    await new Promise(r => setTimeout(r, 280));
  `);
  check('edges: the bar deletes only that line', await counts(), { cards: 17, sections: 3, edges: 3 });
  await undoKey();
  check('edges: undo brings the labelled line back', (await counts()).edges, 4);

  }

  // ---- edges: draw them from a card's side dot ----
  await keyPress('Escape', 'Escape', 27);
  const hoverCard = async (id) => {
    const c = await centerOf(id);
    await moveTo(c.x, c.y);
    await sleep(80);
  };
  const anchorOf = (id, side) => js(`
    const r = document.querySelector('[data-card-id="${id}"] [data-anchor="${side}"]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  await hoverCard('c-6');
  const fromAnchor = await anchorOf('c-6', 'r');
  await moveTo(fromAnchor.x, fromAnchor.y);
  const onto = await centerOf('c-10');
  await dragTo(fromAnchor, onto, { steps: 8 });
  check('edges: dragging a side dot onto a card connects them', (await counts()).edges, 5);
  check('edges: the new line is what the status bar names', await statusMain(), (v) => v.startsWith('Edge · '));

  await keyPress('Escape', 'Escape', 27);
  await hoverCard('c-10');
  const downAnchor = await anchorOf('c-10', 'b');
  await moveTo(downAnchor.x, downAnchor.y);
  const emptySpot = await findBlank();
  await dragTo(downAnchor, emptySpot, { steps: 8 });
  check('edges: releasing on empty canvas grows a connected card', [
    (await counts()).cards,
    (await counts()).edges,
    await js(`return document.activeElement?.getAttribute('aria-label');`),
  ], [18, 6, 'Card title']);
  await keyPress('Escape', 'Escape', 27);
  check('edges: discarding that card takes its edge with it', await counts(),
    { cards: 17, sections: 3, edges: 5 });

  // ---- canvas: auto-pan, minimap, docks ----
  const areaBox = await js(`
    const r = document.querySelector('[class*="canvasArea"]').getBoundingClientRect();
    return { right: r.right, top: r.top, bottom: r.bottom };
  `);
  const panGrab = await centerOf('c-8');
  await press(panGrab.x, panGrab.y);
  await moveTo(panGrab.x + 24, panGrab.y);
  await moveTo(areaBox.right - 18, panGrab.y, 1);
  await sleep(80);
  const panA = await probe();
  await sleep(420);
  const panB = await probe();
  check('canvas: holding a drag at the edge pans the board', Math.round(panB.e - panA.e), (v) => v < -10);
  await release(areaBox.right - 18, panGrab.y);
  await sleep(260);

  const beforeMap = await probe();
  const stage = await js(`
    const r = document.querySelector('[class*="minimapStage"]').getBoundingClientRect();
    return { x: r.left + r.width * 0.8, y: r.top + r.height * 0.3 };
  `);
  await press(stage.x, stage.y);
  await release(stage.x, stage.y);
  await sleep(280);
  const afterMap = await probe();
  check('canvas: a click on the minimap recentres the board',
    Math.abs(afterMap.e - beforeMap.e) + Math.abs(afterMap.f - beforeMap.f), (v) => v > 5);
  check('canvas: the minimap draws the view window', await js(`
    const r = document.querySelector('[class*="minimapView"]').getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  `), (v) => v.w > 4 && v.h > 4);

  // ---- store: v2 envelope, reload, reset, v1 migration ----
  await sleep(420);
  const live = await counts();
  check('store: the saved envelope is v2 and matches the canvas', await js(`
    const raw = localStorage.getItem('thylas:board:v2:b-lit');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return { version: v.version, cards: v.cards.length, sections: v.sections.length, edges: v.edges.length };
  `), (v) => !!v && v.version === 2 && v.cards === live.cards && v.sections === live.sections && v.edges === live.edges);

  await goto(BOARD);
  check('store: the board comes back after a reload', await counts(), live);
  check('store: a fill, a fold and a label survive the reload', [
    await js(`return [...document.querySelectorAll('[data-card-id]')].some(e => e.dataset.color === 'amber' && e.hasAttribute('data-folded'));`),
    await js(`return [...document.querySelectorAll('svg[class*="labelLayer"] text')].some(t => t.textContent.includes('contradicts'));`),
  ], [true, true]);

  await keyPress('Escape', 'Escape', 27);
  await js(`
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Reset to sample')?.click();
    await new Promise(r => setTimeout(r, 340));
  `);
  check('store: Reset returns to the sample and forgets the copy', [
    await counts(),
    await js(`return localStorage.getItem('thylas:board:v2:b-lit');`),
    (await cardState('c-11')).h,
  ], [{ cards: 15, sections: 3, edges: 4 }, null, 44]);

  await js(`
    localStorage.removeItem('thylas:board:v2:b-lit');
    localStorage.setItem('thylas:board:v1:b-lit', JSON.stringify({
      version: 1, id: 'b-lit', name: 'lit-review', updated: 'now',
      sections: [{ id: 's-old', title: 'Legacy', x: 80, y: 120, w: 400, h: 400, tint: 'rgba(94, 107, 80, 1)' }],
      cards: [{ id: 'c-old', sectionId: 's-old', x: 96, y: 160, w: 264, eyebrow: 'OLD', title: 'From v1', lines: ['kept'] }],
      edges: [],
    }));
    return true;
  `);
  await goto(BOARD);
  check('store: a v1 board is read without losing work', [
    (await counts()).cards,
    (await cardState('c-old')).text.includes('From v1'),
  ], [1, true]);
  const legacyCard = await centerOf('c-old');
  await dragTo(legacyCard, { x: legacyCard.x + 12, y: legacyCard.y });
  await sleep(440);
  check('store: the next edit rewrites it as v2', await js(`
    const raw = localStorage.getItem('thylas:board:v2:b-lit');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return { version: v.version, color: v.cards[0].color, section: v.sections[0].color };
  `), { version: 2, color: 'plain', section: 'sage' });
  await js(`localStorage.removeItem('thylas:board:v1:b-lit'); localStorage.removeItem('thylas:board:v2:b-lit'); return true;`);

  } catch (err) {
    results.push({ name: 'the run stopped before the last check', pass: false, actual: String(err?.message ?? err).slice(0, 400) });
  }

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
