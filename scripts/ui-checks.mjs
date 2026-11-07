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
    (f) => f !== 'scene.ts' && /\.(ts|tsx|css)$/.test(f),
  );
  const boardText = [
    readFileSync(new URL('../src/pages/Boards.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/pages/boards.module.css', import.meta.url), 'utf8'),
    ...boardUnits.map((f) => readFileSync(new URL(f, boardsDir), 'utf8')),
  ].join('\n');
  check('scene: no hardcoded 1032/560 outside scene.ts', /1032|560/.test(boardText), false);
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
  check('scene: geometry is identical after extracting the constants', await js(`
    const svg = document.querySelector('svg[class*="edgeLayer"]');
    const scene = svg?.parentElement;
    if (!scene) return null;
    const cs = getComputedStyle(scene);
    const m = new DOMMatrix(cs.transform);
    return {
      w: Math.round(parseFloat(cs.width)),
      h: Math.round(parseFloat(cs.height)),
      svgW: svg.getAttribute('width'),
      svgH: svg.getAttribute('height'),
      scale: Number(m.a.toFixed(3)),
      cards: document.querySelectorAll('[class*="bcard"]').length,
    };
  `), (v) => !!v && v.w === 1032 && v.h === 560 && v.svgW === '1032' && v.svgH === '560'
    && v.scale > 0.1 && v.scale <= 1 && v.cards > 0);

  await goto('/w/ws-onda/boards/b-onda');
  check('scene: empty board invites the first card instead of blocking the canvas', await js(`
    return document.body.innerText.includes('place the first card');
  `), true);

  // ---- SP-06b: viewport ref, pointer-anchored zoom, pan, clamps ----
  const BOARD = '/w/ws-research/boards/b-lit';
  const probe = () => js(`
    const area = document.querySelector('[class*="canvasArea"]');
    const stage = document.querySelector('[class*="stage"]');
    const scene = document.querySelector('svg[class*="edgeLayer"]').parentElement;
    const m = new DOMMatrix(getComputedStyle(scene).transform);
    const ar = area.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const label = document.querySelector('[class*="zoomValue"]');
    return { a: m.a, e: m.e, f: m.f, stageX: sr.left - ar.left, stageY: sr.top - ar.top,
             areaX: ar.left, areaY: ar.top, areaW: ar.width, areaH: ar.height,
             label: label?.textContent ?? '' };
  `);
  const wheel = (x, y, deltaY, modifiers = 0, deltaX = 0) =>
    send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY, modifiers });
  const keyEvent = (type, k, code, vk, modifiers = 0) =>
    send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers });

  await goto(BOARD);
  let p = await probe();
  check('viewport: dock starts at 100%', p.label, '100%');
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
  const stagePointer = (v) => ({ x: pointer.x - v.areaX - v.stageX, y: pointer.y - v.areaY - v.stageY });
  const scenePoint = (v) => {
    const q = stagePointer(v);
    return { x: (q.x - v.e) / v.a, y: (q.y - v.f) / v.a };
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
  await sleep(90);
  const fitted = await probe();
  check('viewport: Cmd+0 fits the scene', [fitted.label, Math.round(fitted.e), Math.round(fitted.f)], ['100%', 0, 0]);

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

  // ---- SP-06c: cards that can be created, moved, aligned, selected, undone ----
  const sceneOf = () => js(`
    const r = document.querySelector('[data-scene="board"]').getBoundingClientRect();
    return { left: r.left, top: r.top, k: r.width / 1032 };
  `);
  const cardCount = () => js(`return document.querySelectorAll('[data-card-id]').length;`);
  const cardStyle = (id) => js(`
    const el = document.querySelector('[data-card-id="${id}"]');
    if (!el) return null;
    return {
      left: Math.round(parseFloat(el.style.left) || 0),
      top: Math.round(parseFloat(el.style.top) || 0),
      w: Math.round(el.getBoundingClientRect().width),
    };
  `);
  const press = (x, y, clickCount = 1) =>
    send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount });
  const release = (x, y, clickCount = 1) =>
    send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount });
  const dblclick = async (x, y) => {
    await press(x, y, 1);
    await release(x, y, 1);
    await press(x, y, 2);
    await release(x, y, 2);
  };
  const hold = async (b, from, to, steps = 5) => {
    const a = { x: b.left + from.x * b.k, y: b.top + from.y * b.k };
    const z = { x: b.left + to.x * b.k, y: b.top + to.y * b.k };
    await press(a.x, a.y);
    for (let i = 1; i <= steps; i++) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: a.x + ((z.x - a.x) * i) / steps,
        y: a.y + ((z.y - a.y) * i) / steps,
        button: 'left',
        buttons: 1,
      });
      await sleep(16);
    }
    return { a, z };
  };
  const undoKey = async () => {
    await keyEvent('keyDown', 'z', 'KeyZ', 90, 4);
    await keyEvent('keyUp', 'z', 'KeyZ', 90, 4);
    await sleep(220);
  };
  const near1 = (expected) => (v) => typeof v === 'number' && Math.abs(v - expected) <= 1;

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
    return document.body.innerText.includes('6 cards');
  `), true);

  await goto(BOARD);
  await js(`localStorage.removeItem('thylas:board:v1:b-lit'); return true;`);
  await goto(BOARD);

  check('cards: the badge states the number the board really renders', [
    await cardCount(),
    await js(`return [...document.querySelectorAll('span')].map(e => e.textContent.trim()).find(t => /^[0-9]+ CARDS$/.test(t)) ?? '';`),
    await js(`return document.body.innerText.includes('14 cards');`),
  ], [6, '6 CARDS', false]);
  check('cards: toolbar offers only tools that work', await js(`
    const tools = [...document.querySelectorAll('[aria-label="Canvas tools"] button')];
    return { count: tools.length, names: tools.map(b => b.title.split(' ')[0]).join(',') };
  `), (v) => v.count === 3 && v.names === 'Select,Undo,Redo');
  check('cards: no deferred-editing apology anywhere', await js(`
    return /deferred|not wired/.test(document.body.innerText);
  `), false);

  let bd = await sceneOf();
  const blankAt = { x: bd.left + 520 * bd.k, y: bd.top + 505 * bd.k };
  await dblclick(blankAt.x, blankAt.y);
  await sleep(240);
  check('cards: double-click on blank canvas creates a card in edit mode', [
    await cardCount(),
    await js(`return document.activeElement?.getAttribute('aria-label');`),
  ], [7, 'Card title']);

  await send('Input.insertText', { text: 'Refutation needed' });
  await keyEvent('keyDown', 'Enter', 'Enter', 13);
  await keyEvent('keyUp', 'Enter', 'Enter', 13);
  await sleep(240);
  check('cards: the typed title is committed', await js(`
    return document.body.innerText.includes('Refutation needed');
  `), true);
  check('cards: the status bar says what happened', await js(`
    return document.body.innerText.includes('Title changed');
  `), true);

  const newId = await js(`return document.querySelectorAll('[data-card-id]')[6]?.dataset.cardId ?? null;`);
  check('cards: a new card is clamped inside the scene', (await cardStyle(newId))?.top, 456);

  // Drag 160 × 100 scene units up-left, far from every neighbour so no snap applies.
  bd = await sceneOf();
  const created = await js(`
    const el = document.querySelector('[data-card-id="${newId}"]');
    return { x: (parseFloat(el.style.left) || 0) + 40, y: (parseFloat(el.style.top) || 0) + 12 };
  `);
  const moved = await hold(bd, created, { x: created.x - 160, y: created.y - 100 });
  await release(moved.z.x, moved.z.y);
  await sleep(240);
  check('cards: drag moves the card 1:1 in scene units', (await cardStyle(newId))?.left, near1(360));
  check('cards: the vertical delta lands too', (await cardStyle(newId))?.top, near1(356));

  await undoKey();
  check('cards: undo restores the position in one step', (await cardStyle(newId))?.left, near1(520));

  // Snap: 4 scene units off c-2's left edge must land on it exactly.
  bd = await sceneOf();
  const near = await hold(bd, { x: 80, y: 126 }, { x: 84, y: 126 });
  const guideSeen = await js(`
    const g = document.querySelector('[class*="guideX"]');
    return g ? getComputedStyle(g).opacity : '0';
  `);
  await release(near.z.x, near.z.y);
  await sleep(240);
  check('cards: a guide appears while a drop would align', guideSeen, '1');
  check('cards: release snaps exactly onto the neighbour axis', (await cardStyle('c-1'))?.left, 40);
  check('cards: the guide is hidden again after release', await js(`
    return getComputedStyle(document.querySelector('[class*="guideX"]')).opacity;
  `), '0');

  // Marquee over the Evidence section takes exactly its two cards.
  bd = await sceneOf();
  const box = await hold(bd, { x: 330, y: 90 }, { x: 660, y: 430 }, 6);
  await release(box.z.x, box.z.y);
  await sleep(240);
  check('cards: marquee selects the cards it covers', await js(`
    return document.body.innerText.includes('2 selected');
  `), true);
  await keyEvent('keyDown', 'Delete', 'Delete', 46);
  await keyEvent('keyUp', 'Delete', 'Delete', 46);
  await sleep(240);
  check('cards: delete removes the whole selection at once', await cardCount(), 5);
  await undoKey();
  check('cards: one undo brings both cards back', await cardCount(), 7);
  check('cards: undo restored z-order', await js(`
    return [...document.querySelectorAll('[data-card-id]')].map(e => e.dataset.cardId).join(',');
  `), (v) => v.startsWith('c-1,c-2,c-3,c-4,c-5'));

  // Resize through the handle that only exists on a single selection. c-1 is
  // used because c-5 sits against the scene edge and could not grow 40px.
  bd = await sceneOf();
  const c1 = await js(`
    const el = document.querySelector('[data-card-id="c-1"]');
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 14 };
  `);
  await press(c1.x, c1.y);
  await release(c1.x, c1.y);
  await sleep(180);
  const before1 = await cardStyle('c-1');
  const handle = await js(`
    const h = document.querySelector('[data-card-id="c-1"] [data-resize]');
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  check('cards: the resize handle appears only on a single selection', !!handle, true);
  await press(handle.x, handle.y);
  for (let i = 1; i <= 4; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: handle.x + (40 * i) / 4,
      y: handle.y + (30 * i) / 4,
      button: 'left',
      buttons: 1,
    });
    await sleep(16);
  }
  await release(handle.x + 40, handle.y + 30);
  await sleep(240);
  // The rect is scaled, so 40 screen pixels of drag is the expected growth.
  check('cards: resizing widens the card by the drag distance',
    (await cardStyle('c-1')).w - before1.w, near1(40));

  const c5 = await js(`
    const el = document.querySelector('[data-card-id="c-5"]');
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 14 };
  `);
  await press(c5.x, c5.y);
  await release(c5.x, c5.y);
  await sleep(180);

  await keyEvent('keyDown', 'ArrowRight', 'ArrowRight', 39);
  await keyEvent('keyUp', 'ArrowRight', 'ArrowRight', 39);
  await sleep(240);
  check('cards: arrow key nudges 1px', (await cardStyle('c-5'))?.left, 705);
  await keyEvent('keyDown', 'ArrowLeft', 'ArrowLeft', 37, 8);
  await keyEvent('keyUp', 'ArrowLeft', 'ArrowLeft', 37, 8);
  await sleep(240);
  check('cards: shift+arrow nudges 10px', (await cardStyle('c-5'))?.left, 695);

  await js(`
    document.querySelector('[aria-label="Canvas tools"] button[title^="Undo"]').click();
    await new Promise(r => setTimeout(r, 220));
  `);
  check('cards: the toolbar undo button does what the shortcut does', (await cardStyle('c-5'))?.left, 705);

  await sleep(400);
  await goto(BOARD);
  check('cards: edits survive a reload through the versioned store', [
    await cardCount(),
    (await cardStyle('c-5'))?.left,
  ], [7, 705]);
  check('cards: the store envelope is the versioned one', await js(`
    const v = JSON.parse(localStorage.getItem('thylas:board:v1:b-lit'));
    return !!v && v.version === 1 && Array.isArray(v.cards) && v.cards.length === 7;
  `), true);

  await goto(BOARD);
  await js(`
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Reset to sample')?.click();
    await new Promise(r => setTimeout(r, 300));
  `);
  check('cards: reset returns to the sample and forgets the saved copy', [
    (await cardStyle('c-5'))?.left,
    await js(`return localStorage.getItem('thylas:board:v1:b-lit');`),
  ], [704, null]);

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
