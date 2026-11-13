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
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* 5180 rather than Vite's 5173: the run owns its server, so the AI stub below
   can be guaranteed to be the upstream. Reusing a server someone left running
   would put the AI checks in front of an endpoint with no stub and no key. */
const BASE = process.env.E2E_BASE ?? 'http://localhost:5180';
const AI_STUB_PORT = 8798;

/** Long enough to see three bars, short enough not to slow the run. */
const ANSWER_TEXT =
  'A boundary is where one thing stops being itself and another begins.\n\n```\nconst edge = 1;\n```';
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

/**
 * A local stand-in for DeepSeek. The AI surface is real code against a real
 * middleware; only the far end is fake, and it is fake in a way the checks can
 * steer (`aiMode`) without a key or a network.
 */
let aiMode = 'ok';
const aiCalls = [];

function startAiStub() {
  const stub = createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!req.url?.endsWith('/chat/completions')) {
        res.statusCode = 404;
        res.end('{}');
        return;
      }
      let stream = false;
      try {
        stream = JSON.parse(body || '{}').stream === true;
      } catch {
        /* not JSON: the non-streaming path answers it */
      }
      const mode = aiMode;
      aiCalls.push(stream ? `${mode}:stream` : mode);
      const reply = (code, payload) => {
        res.statusCode = code;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
      };

      if (mode === 'ratelimit') {
        reply(429, { error: { message: 'stub rate limit' } });
        return;
      }

      if (stream) {
        /* SSE, the way the real upstream speaks: start event, deltas, done. */
        res.writeHead(200, { 'content-type': 'text/event-stream', });
        const parts = ANSWER_TEXT.match(/[\s\S]{1,48}/g) ?? [];
        let i = 0;
        const timer = setInterval(
          () => {
            if (i < parts.length) {
              res.write(`data: ${JSON.stringify({ model: 'deepseek-chat', choices: [{ delta: { content: parts[i++] } }] })}\n\n`);
              return;
            }
            clearInterval(timer);
            res.write('data: [DONE]\n\n');
            res.end();
          },
          mode === 'slow' ? 600 : 40,
        );
        res.on('close', () => {
          if (!res.writableEnded) clearInterval(timer);
        });
        return;
      }

      setTimeout(
        () => {
          reply(200, { model: 'deepseek-chat', choices: [{ message: { content: ANSWER_TEXT } }] });
        },
        mode === 'slow' ? 3000 : 320,
      );
    });
  });
  return new Promise((resolve) => stub.listen(AI_STUB_PORT, '127.0.0.1', () => resolve(stub)));
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('No Chrome found. Set CHROME_PATH to a Chrome/Chromium binary.');
    process.exit(2);
  }

  let server = null;
  const aiStub = await startAiStub();
  if (!(await up())) {
    console.log('starting dev server…');
    server = spawn('npm', ['run', 'dev', '--', '--port', '5180', '--strictPort'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        /* A stub key, so the endpoint is configured and the surface is live; the
           upstream is the local stub, so nothing leaves the machine. */
        DEEPSEEK_API_KEY: 'sk-e2e-stub',
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${AI_STUB_PORT}`,
        DEEPSEEK_TIMEOUT_MS: '5000',
      },
    });
    for (let i = 0; i < 60 && !(await up()); i++) await sleep(500);
    if (!(await up())) {
      console.error('Dev server did not start.');
      server.kill();
      aiStub.close();
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

  let keylessServer = null;
  const cleanup = () => {
    chrome.kill();
    server?.kill();
    keylessServer?.kill();
    aiStub.close();
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

  /* The editor is a lazy chunk: waiting a fixed 1.2 s guesses at a network
     fetch. Poll for the node instead. */
  const waitForSelector = async (selector, timeout = 6000) => {
    for (let waited = 0; waited < timeout; waited += 100) {
      if (await js(`return !!document.querySelector(${JSON.stringify(selector)});`)) return true;
      await sleep(100);
    }
    return false;
  };

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
  check('overview: the field states what it will not do', await js(`
    const el = document.getElementById('intent-reason');
    return !!el && el.offsetParent !== null && el.textContent.includes('Nothing is started');
  `), true);
  /* SP-11 replaced the old "creating one is not available" footnote with a
     working form, so the assertion that guarded the absence is now its inverse. */
  check('overview: no apology about creating a workspace', await js(`return !document.body.innerText.includes('not available in this build');`), true);
  check('overview: no small text outside glyph tiles', await js(`
    return [...document.querySelectorAll('main *')]
      .filter(el => el.textContent.trim() && !el.className.toString().includes('glyph'))
      .every(el => parseFloat(getComputedStyle(el).fontSize) >= 11);
  `), true);
  const overviewCss = readFileSync(new URL('../src/pages/overview.module.css', import.meta.url), 'utf8');
  check('overview: accent confined to shared primitives', (overviewCss.match(/var\(--accent/g) ?? []).length, 0);

  // ---- SP-11: a workspace can be made and removed here ----
  check('workspaces: the grid offers creation', await js(`
    return [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'New workspace');
  `), true);

  await js(`${helpers} click(byText('button', 'New workspace')); await new Promise(r => setTimeout(r, 200)); return 1;`);
  check('workspaces: the form opens with focus and a label', await js(`
    const input = document.getElementById('new-workspace-name');
    return {
      focused: document.activeElement === input,
      label: document.querySelector('label[for="new-workspace-name"]')?.textContent.trim(),
    };
  `), { focused: true, label: 'New workspace' });

  const submitName = async (name) => js(`
    const input = document.getElementById('new-workspace-name');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, ${JSON.stringify(name)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    input.form.requestSubmit();
    await new Promise(r => setTimeout(r, 350));
    return location.pathname;
  `);

  check('workspaces: a duplicate name is refused in place', await js(`
    const input = document.getElementById('new-workspace-name');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, 'Research');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    input.form.requestSubmit();
    await new Promise(r => setTimeout(r, 300));
    return {
      path: location.pathname,
      error: document.getElementById('new-workspace-error')?.textContent.trim() ?? null,
      cards: document.querySelectorAll('[data-workspace-card]').length,
    };
  `), (v) => v.path === '/overview' && typeof v.error === 'string' && v.error.includes('already exists') && v.cards === 2);

  check('workspaces: creating one lands inside it', await submitName('Field notes'), (v) => typeof v === 'string' && v.startsWith('/w/ws-field-notes-') && v.endsWith('/files'));
  const fieldPath = await js(`return location.pathname;`);
  const fieldId = fieldPath.split('/')[2];

  check('workspaces: a new workspace is empty and says so', await js(`
    return {
      empty: document.body.innerText.includes('This folder is empty'),
      rail: [...document.querySelectorAll('[data-ws-row]')].some(r => r.textContent.includes('Field notes')),
      count: document.querySelector('[class*="railCount"]')?.textContent.trim(),
    };
  `), { empty: true, rail: true, count: '3' });

  await goto('/overview');
  check('workspaces: a card counts what is really there', await js(`
    const card = document.querySelector('[data-workspace-card="${fieldId}"]');
    /* No regex here: inside a template literal a backslash is eaten, so /\s+/g
       arrives as /s+/g and deletes every letter s ("Field notes" -> "Field note"). */
    return card ? card.innerText.split(String.fromCharCode(10)).join(' ').replace(/ +/g, ' ').trim() : null;
  `), (v) => typeof v === 'string' && v.includes('0 files · 0 boards · 0 processes'));

  await goto(fieldPath);
  await goto('/overview');
  await js(`${helpers} click(document.querySelector('button[aria-label="Delete Field notes"]')); await new Promise(r => setTimeout(r, 250)); return 1;`);
  check('workspaces: delete asks first and says what goes', await js(`
    const box = document.querySelector('[data-confirm]');
    return box ? box.innerText.split(String.fromCharCode(10)).join(' ').replace(/ +/g, ' ').trim() : null;
  `), (v) => typeof v === 'string' && v.includes('Delete “Field notes”?') && v.includes('It is empty') && v.includes('no undo'));

  await js(`${helpers} click([...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Delete')); await new Promise(r => setTimeout(r, 400)); return 1;`);
  check('workspaces: deleting removes the card and the rail row', await js(`
    return {
      cards: document.querySelectorAll('[data-workspace-card]').length,
      rail: [...document.querySelectorAll('[data-ws-row]')].map(r => r.textContent).join('|'),
      count: document.querySelector('[class*="railCount"]')?.textContent.trim(),
    };
  `), (v) => v.cards === 2 && !v.rail.includes('Field notes') && v.count === '2');

  await goto(fieldPath);
  check('workspaces: a deleted workspace says it is gone', await js(`
    return document.body.innerText.includes('Workspace not found');
  `), true);
  await goto('/overview');
  await js('await new Promise(r => setTimeout(r, 600)); return 1;');

  // ---- SP-07b: one answer, and no claim that work started ----
  const setField = async (value) => js(`
    const input = document.querySelector('input[aria-label="Ask one question"]');
    input.focus();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    return input.value.length;
  `);
  const sendKey = async (key, code, keyCode, modifiers = 0) => {
    const base = {
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      modifiers,
    };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  };

  check('ask: the panel is absent until the field is used', await js(`
    return !!document.querySelector('aside[data-panel-context] [class*="askIdle"]');
  `), false);
  /* A real click, not `.focus()`: focus is what the surface listens for, and a
     scripted focus in a headless window does not always arrive as an event. */
  const fieldBox = await js(`
    const r = document.querySelector('input[aria-label="Ask one question"]').getBoundingClientRect();
    return { x: Math.round(r.left + 40), y: Math.round(r.top + r.height / 2) };
  `);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: fieldBox.x, y: fieldBox.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: fieldBox.x, y: fieldBox.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(250);
  check('ask: using the field opens a panel that says what it is', await js(`
    const el = document.querySelector('aside[data-panel-context]');
    return {
      active: document.activeElement ? document.activeElement.tagName + '/' + (document.activeElement.getAttribute('aria-label') ?? '') : 'none',
      panel: el ? el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120) : null,
    };
  `), (v) => typeof v.panel === 'string' && v.panel.includes('Answers one question with DeepSeek') && v.panel.includes('does not start a process'));
  check('ask: the send control is an icon button with a name', await js(`
    const b = document.querySelector('button[aria-label="Send"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { label: b.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height), text: b.textContent.trim() };
  `), { label: 'Send', w: 32, h: 32, text: '' });

  check('ask: Ask is disabled while the field is empty', await js(`
    const btn = document.querySelector('button[aria-label="Send"]');
    return { disabled: btn ? btn.disabled : 'missing', described: btn ? btn.getAttribute('aria-describedby') : '' };
  `), { disabled: true, described: 'intent-reason' });

  aiMode = 'ok';
  await setField('What is a boundary?');
  await sendKey('Enter', 'Enter', 13, 2);
  check('ask: three bars appear while the answer is in flight', await js(`
    return document.querySelectorAll('aside[data-panel-context] [class*="askBars"] i').length;
  `), 3);
  await sleep(1000);
  check('ask: the answer arrives in the panel', await js(`
    const el = document.querySelector('aside[data-panel-context]');
    return el ? el.textContent.includes('A boundary is where') : false;
  `), true);
  check('ask: fenced code is set in mono', await js(`
    const pre = document.querySelector('aside[data-panel-context] pre[class*="codeBlock"]');
    if (!pre) return 'no pre';
    return getComputedStyle(pre).fontFamily.toLowerCase().includes('mono');
  `), true);
  check('ask: the footer states model, endpoint kind and latency', await js(`
    const el = document.querySelector('aside[data-panel-context] [class*="answerFoot"]');
    return el ? el.textContent.trim() : null;
  `), (v) => typeof v === 'string' && /^deepseek-chat · dev endpoint · \d+ ms$/.test(v));
  check('ask: the latency is the stub delay, not a constant', await js(`
    const el = document.querySelector('aside[data-panel-context] [class*="answerFoot"]');
    return parseInt((el ? el.textContent : '').split('·').pop(), 10);
  `), (v) => typeof v === 'number' && v >= 250 && v <= 2000);
  check('ask: the panel never claims a run started', await js(`
    const el = document.querySelector('aside[data-panel-context]');
    return /\\b(started|is running|process is)\\b/i.test(el ? el.textContent : '');
  `), false);

  aiMode = 'slow';
  await setField('What is a boundary?');
  await sendKey('Enter', 'Enter', 13, 2);
  await sleep(450);
  check('ask: Stop is offered while a request is in flight', await js(`
    return [...document.querySelectorAll('aside[data-panel-context] button')].some(b => b.textContent.trim() === 'Stop');
  `), true);
  await js(`
    [...document.querySelectorAll('aside[data-panel-context] button')].find(b => b.textContent.trim() === 'Stop')?.click();
    await new Promise(r => setTimeout(r, 300));
    return 1;
  `);
  check('ask: Stop leaves the panel idle, with neither answer nor error', await js(`
    const el = document.querySelector('aside[data-panel-context]');
    return {
      idle: !!el.querySelector('[class*="askIdle"]'),
      answer: !!el.querySelector('[class*="askAnswer"]'),
      banner: !!el.querySelector('[role="alert"]'),
    };
  `), { idle: true, answer: false, banner: false });

  await setField('something to clear');
  await sendKey('Escape', 'Escape', 27);
  check('ask: esc clears the field', await js(`
    return document.querySelector('input[aria-label="Ask one question"]').value;
  `), '');

  aiMode = 'ratelimit';
  await setField('What is a boundary?');
  await sendKey('Enter', 'Enter', 13, 2);
  await sleep(1000);
  check('ask: a rate limit becomes a banner with a retry', await js(`
    const el = document.querySelector('aside[data-panel-context]');
    const alert = el ? el.querySelector('[role="alert"]') : null;
    return {
      alert: !!alert,
      text: alert ? alert.textContent.trim() : '',
      retry: [...(el ? el.querySelectorAll('button') : [])].some(b => b.textContent.trim() === 'Ask again'),
    };
  `), (v) => v.alert === true && /rate limiting/i.test(v.text) && v.retry === true);

  await setField('x'.repeat(8001));
  check('ask: an over-long question is refused with the limit stated', await js(`
    const reason = document.getElementById('intent-reason');
    const btn = document.querySelector('button[aria-label="Send"]');
    return { text: reason.textContent.trim(), disabled: btn ? btn.disabled : 'missing' };
  `), (v) => v.disabled === true && /8001 characters; the limit is 8000/.test(v.text));
  await setField('');

  // ---- SP-07b acceptance 2: no key disables the control before the click ----
  keylessServer = spawn('npm', ['run', 'dev', '--', '--port', '5179', '--strictPort'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
    env: { ...process.env, DEEPSEEK_API_KEY: '', DEEPSEEK_BASE_URL: `http://127.0.0.1:${AI_STUB_PORT}` },
  });
  const keylessUp = async () => {
    try {
      const res = await fetch('http://localhost:5179/overview', { signal: AbortSignal.timeout(1200) });
      return res.ok;
    } catch {
      return false;
    }
  };
  for (let i = 0; i < 40 && !(await keylessUp()); i++) await sleep(500);
  await send('Page.navigate', { url: 'http://localhost:5179/overview' });
  await sleep(1300);
  check('ask: without a key the control is disabled and names the variable', await js(`
    for (let i = 0; i < 30; i++) {
      const reason = document.getElementById('intent-reason');
      if (reason && reason.textContent.includes('DEEPSEEK_API_KEY')) break;
      await new Promise(r => setTimeout(r, 150));
    }
    const reason = document.getElementById('intent-reason');
    const btn = document.querySelector('button[aria-label="Send"]');
    return {
      disabled: btn ? btn.disabled : 'missing',
      names: reason ? reason.textContent.includes('DEEPSEEK_API_KEY') : false,
    };
  `), (v) => v.disabled === true && v.names === true);
  keylessServer.kill();
  keylessServer = null;
  await goto('/overview');

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

  // ---- SP-05b: writing ----
  check('notes: reading mode offers an edit control', await js(`
    return [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Edit');
  `), true);

  await js(`${helpers} click(byText('button', 'Edit')); return 1;`);
  await waitForSelector('.cm-editor');
  await sleep(300);
  check('notes: the editor mounts with an accessible name', await js(`
    const c = document.querySelector('.cm-content');
    if (!c) return null;
    const line = document.querySelector('.cm-line');
    const cs = line ? getComputedStyle(line) : null;
    return {
      role: c.getAttribute('role'),
      label: c.getAttribute('aria-label'),
      multiline: c.getAttribute('aria-multiline'),
      fontSize: cs ? cs.fontSize : null,
    };
  `), { role: 'textbox', label: 'Note body, Markdown', multiline: 'true', fontSize: '16px' });

  await js(`document.querySelector('.cm-content')?.focus(); return 1;`);
  await send('Input.insertText', { text: '\n\nA line typed by the check.' });
  await sleep(1400);
  check('notes: typing is saved after the idle delay', await js(`
    return document.body.innerText.includes('Saved');
  `), true);

  await send('Page.reload');
  await sleep(1600);
  check('notes: the edit survives a reload', await js(`
    return document.body.innerText.includes('A line typed by the check.');
  `), true);

  await js(`${helpers} click(byText('button', 'Edit')); return 1;`);
  await waitForSelector('.cm-editor');
  await js(`document.querySelector('.cm-content')?.focus(); return 1;`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(500);
  check('notes: Esc leaves the editor instead of trapping the keyboard', await js(`
    return { editor: !!document.querySelector('.cm-editor'), edit: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Edit') };
  `), { editor: false, edit: true });

  await js(`${helpers} click(byText('button', 'Edit')); return 1;`);
  await waitForSelector('.cm-editor');
  await js(`document.querySelector('.cm-content')?.focus(); return 1;`);
  await send('Input.insertText', { text: ' unsaved' });
  await sleep(150);
  check('notes: closing a dirty tab asks before discarding', await js(`
    const close = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('Close Method'));
    close.click();
    await new Promise(r => setTimeout(r, 250));
    const warn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('Discard unsaved'));
    return { open: !!document.querySelector('.cm-editor'), warning: !!warn };
  `), { open: true, warning: true });

  /* Discard, so the rest of the run sees the shell it expects. */
  await js(`
    const warn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('Discard unsaved'));
    warn.click();
    await new Promise(r => setTimeout(r, 600));
    return 1;
  `);
  check('notes: a second press closes the tab', await js(`
    return { path: location.pathname, editor: !!document.querySelector('.cm-editor') };
  `), { path: '/notes', editor: false });

  /* Reopen a note: the panel assertions below look for `aside[aria-label="Scope"]`,
     which only exists while a note is selected. */
  await goto('/notes/n-method');

  // ---- SP-05c: search, links, backlinks, delete ----
  await goto('/notes');
  const typeSearch = async (text) => js(`
    const input = document.querySelector('input[aria-label="Search notes"]');
    input.focus();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, ${JSON.stringify(text)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    return 1;
  `);

  await typeSearch('tokenizer');
  check('notes: search reaches the body, not only the titles', await js(`
    const rows = [...document.querySelectorAll('[data-note-row]')].map(r => r.textContent);
    return { count: rows.length, method: rows.some(t => t.includes('Method')) };
  `), (v) => v.count >= 2 && v.method === true);

  await typeSearch('zzzznothing');
  check('notes: an empty search names the term and the scope', await js(`
    return document.querySelector('[class*="listEmpty"]')?.textContent.trim();
  `), (v) => typeof v === 'string' && v.includes('zzzznothing'));
  await typeSearch('');

  check('notes: arrow keys move between rows', await js(`
    const rows = [...document.querySelectorAll('[data-note-row]')];
    rows[0].focus();
    document.querySelectorAll('[data-note-row]')[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    return document.activeElement?.hasAttribute('data-note-row') ? 'row' : document.activeElement?.tagName;
  `), 'row');

  /* A link written in the editor must become a chip, and a name that does not
     exist must offer to be written. */
  await goto('/notes/n-method');
  await js(`${helpers} click(byText('button', 'Edit')); return 1;`);
  await waitForSelector('.cm-editor');
  await js(`document.querySelector('.cm-content')?.focus(); return 1;`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35, nativeVirtualKeyCode: 35, modifiers: 2 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35, nativeVirtualKeyCode: 35, modifiers: 2 });
  await sleep(120);
  await send('Input.insertText', { text: '\n\nSee [[Questions for the WAM team]] and [[Ghost note]].' });
  await sleep(1400);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(500);

  check('notes: a written link resolves and an unknown one dangles', await js(`
    return {
      resolved: document.querySelectorAll('article button[class*="chip"]:not([class*="chipOff"])').length,
      dangling: document.querySelectorAll('article button[class*="chipOff"]').length,
    };
  `), { resolved: 1, dangling: 1 });

  /* `includes`, not a regex: inside a template literal a backslash is consumed,
     so `\(` silently becomes a capture group and the test never matches. */
  check('notes: the panel lists both directions', await js(`
    const aside = document.querySelector('aside[data-panel-context]');
    const text = aside ? aside.innerText.toUpperCase() : '';
    return {
      has: !!aside,
      out: text.includes('LINKS OUT (1)'),
      from: text.includes('LINKED FROM (0)'),
      head: text.split(String.fromCharCode(10)).join(' ').slice(0, 120),
    };
  `), (v) => v.has === true && v.out === true && v.from === true);

  await js(`${helpers} click(byText('article button', 'Ghost note')); await new Promise(r => setTimeout(r, 800));`);
  check('notes: a dangling link creates the note it names', await js(`
    return { path: location.pathname, title: document.querySelector('input[aria-label="Note title"]')?.value ?? document.querySelector('article h1')?.textContent };
  `), (v) => v.path !== '/notes/n-method' && v.title === 'Ghost note');

  const ghostPath = await js(`return location.pathname;`);

  await goto('/notes/n-questions');
  check('notes: the linked note reports its backlink', await js(`
    const text = (document.querySelector('aside[data-panel-context]')?.innerText ?? '').toUpperCase();
    return { from: text.includes('LINKED FROM (1)'), names: text.includes('METHOD') };
  `), { from: true, names: true });

  await goto(ghostPath);
  await js(`${helpers} click(byText('button', 'Delete note…')); await new Promise(r => setTimeout(r, 300));`);
  check('notes: delete asks once before removing', await js(`
    return { asked: document.body.innerText.includes('There is no undo'), path: location.pathname };
  `), (v) => v.asked === true && v.path.startsWith('/notes/'));
  await js(`${helpers} click(byText('button', 'Delete permanently')); await new Promise(r => setTimeout(r, 600));`);
  check('notes: deleting returns to the list without the note', await js(`
    const rows = [...document.querySelectorAll('[data-note-row]')].map(r => r.textContent);
    return { path: location.pathname, ghost: rows.some(t => t.includes('Ghost note')) };
  `), { path: '/notes', ghost: false });

  await js(`window.dispatchEvent(new KeyboardEvent('keydown', {key:'k', metaKey:true, bubbles:true})); await new Promise(r => setTimeout(r, 250));`);
  check('palette: opens on mod+k', await js(`return !!document.querySelector('[role="dialog"]');`), true);
  await js(`document.querySelector('[role="dialog"] input').dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); await new Promise(r => setTimeout(r, 200));`);
  check('palette: closes on escape', await js(`return !!document.querySelector('[role="dialog"]');`), false);

  // ---- SP-10e: the keyboard stays inside the palette, and comes back ----
  await js(`
    document.querySelector('button[aria-label^="Search or jump to"]').focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    return 1;
  `);
  check('palette: the field is a named combobox pointing at the highlighted option', await js(`
    const input = document.querySelector('[role="dialog"] input');
    const id = input.getAttribute('aria-activedescendant');
    const option = id ? document.getElementById(id) : null;
    return {
      name: input.getAttribute('aria-label'),
      role: input.getAttribute('role'),
      points: !!option,
      selected: option ? option.getAttribute('aria-selected') : null,
    };
  `), { name: 'Search commands', role: 'combobox', points: true, selected: 'true' });

  /* Real key events: a synthetic KeyboardEvent moves no focus, so a trap that
     works would look broken and a trap that is broken would look fine. */
  for (let i = 0; i < 8; i++) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  }
  check('palette: eight tabs stay inside the dialog', await js(`
    const a = document.activeElement;
    return { inside: !!a.closest('[role="dialog"]'), tag: a.tagName };
  `), (v) => v.inside === true);

  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(350);
  check('palette: escape closes it and returns focus to the opener', await js(`
    return {
      open: !!document.querySelector('[role="dialog"]'),
      focus: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName,
    };
  `), (v) => v.open === false && typeof v.focus === 'string' && v.focus.startsWith('Search or jump to'));

  check('rail: a workspace row announces a sentence, not a concatenation', await js(`
    return [...document.querySelectorAll('[data-ws-row]')].map(r => r.getAttribute('aria-label'));
  `), (v) => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'string' && /^[^,]+, (personal|organisation) workspace/.test(n)));

  /* Named, not global: Notes in the rail and Notes in the strip are two doors
     to one room, which is fine. The three names below were one control each,
     duplicated — that is what makes a screen reader hear the same thing twice. */
  check('shell: one control per named action', await js(`
    const names = [...document.querySelectorAll('button, a[href]')]
      .filter(el => el.offsetParent !== null)
      .map(el => (el.getAttribute('aria-label') || el.textContent || '').replace(/ +/g, ' ').trim().toLowerCase());
    const count = (n) => names.filter(x => x === n).length;
    return { collapse: count('collapse sidebar'), create: count('create workspace') };
  `), { collapse: 1, create: 1 });

  await js(`${helpers} window.dispatchEvent(new KeyboardEvent('keydown', {key:'\\\\', metaKey:true, bubbles:true})); await new Promise(r => setTimeout(r, 300));`);
  check('panel: hidden by shortcut', await js(`return !!document.querySelector('aside[data-panel-context]');`), false);
  await js(`${helpers} window.dispatchEvent(new KeyboardEvent('keydown', {key:'\\\\', metaKey:true, bubbles:true})); await new Promise(r => setTimeout(r, 300));`);
  check('panel: restored by shortcut', await js(`return !!document.querySelector('aside[data-panel-context]');`), true);

  await js(`${helpers} click(byText('button', 'Onda Lab')); await new Promise(r => setTimeout(r, 700));`);
  check('workspace: switching changes scope', await js(`return location.pathname;`), '/w/ws-onda/files');

  await js(`${helpers} click(byText('button', 'Processes')); await new Promise(r => setTimeout(r, 600));`);
  await js(`${helpers} click(byText('[aria-label="Filter processes"] [role="tab"]', 'Needs you')); await new Promise(r => setTimeout(r, 300));`);
  check('processes: filter narrows the table', await js(`return document.querySelectorAll('button[class*="trow"]').length;`), 1);

  // ---- SP-10d: the four states, forced and measured ----
  /* `:hover` cannot be produced by a synthetic event, so the states are forced
     through the CSS domain and the computed style is compared before and after.
     A transition reads its start value at t=0, hence the wait. */
  await send('DOM.enable');
  await send('CSS.enable');
  /* requestNode resolves against the DOM agent's tree, so the tree has to exist
     once before the first probe; after that each probe converts a fresh object
     rather than querying a snapshot that React has already replaced. */
  await send('DOM.getDocument', { depth: -1 });
  const forcedStates = async (selector) => {
    await js(`
      document.querySelectorAll('[data-state-probe]').forEach(e => e.removeAttribute('data-state-probe'));
      document.querySelector(${JSON.stringify(selector)})?.setAttribute('data-state-probe', '1');
      return 1;
    `);
    /* Ask the page for the node and convert its remote object: `DOM.querySelector`
       answers from a cached tree, so a node React re-rendered a moment ago is
       simply not in it. */
    const remote = await send('Runtime.evaluate', {
      expression: `document.querySelector('[data-state-probe="1"]')`,
    });
    if (!remote.result.objectId) return { missing: true };
    const found = await send('DOM.requestNode', { objectId: remote.result.objectId });
    const read = async (forced) => {
      await send('CSS.forcePseudoState', { nodeId: found.nodeId, forcedPseudoClasses: forced });
      await sleep(200);
      return js(`
        const el = document.querySelector('[data-state-probe="1"]');
        const cs = getComputedStyle(el);
        const pb = getComputedStyle(el, '::before');
        return [cs.backgroundColor, cs.borderColor, cs.color, cs.boxShadow, cs.transform, cs.outlineStyle, pb.backgroundColor].join('|');
      `);
    };
    const base = await read([]);
    const out = {};
    for (const state of ['hover', 'active', 'focus-visible']) out[state] = (await read([state])) !== base;
    await send('CSS.forcePseudoState', { nodeId: found.nodeId, forcedPseudoClasses: [] });
    return out;
  };

  await js(`return 1;`);
  check('states: a process row answers hover, press and keyboard focus', await forcedStates('button[class*="trow"]'), {
    hover: true,
    active: true,
    'focus-visible': true,
  });
  check('states: a filter chip answers all three', await forcedStates('[aria-label="Filter processes"] [role="tab"]'), {
    hover: true,
    active: true,
    'focus-visible': true,
  });
  /* The rail row rather than a Button: this route has no `.button` instance
     (its controls are rows, chips and an empty-state action), and a probe that
     finds nothing reports a failure of the selector, not of the state. */
  check('states: a rail row answers all three', await forcedStates('[data-rail-item]'), {
    hover: true,
    active: true,
    'focus-visible': true,
  });

  await js(`${helpers} click(byText('button', 'Collapse sidebar')); await new Promise(r => setTimeout(r, 400));`);
  check('rail: collapses', await js(`return document.querySelector('[data-rail]').getAttribute('data-rail');`), 'collapsed');
  await send('Page.reload');
  await sleep(1200);
  check('rail: collapse persists across reload', await js(`return document.querySelector('[data-rail]').getAttribute('data-rail');`), 'collapsed');

  await goto('/w/ws-research/processes/run-baseline');
  check('run: detail renders its bands', await js(`return document.body.innerText.includes('GIVEN TO WAM');`), true);

  // ---- SP-07c: the filter is a link, the controls are capabilities, the simulator says so ----
  await goto('/w/ws-research/processes?state=needs_input');
  check('processes: the filter comes from the URL', await js(`
    const rows = [...document.querySelectorAll('button[class*="trow"]')];
    const on = [...document.querySelectorAll('[aria-label="Filter processes"] [role="tab"]')].find(t => t.getAttribute('aria-selected') === 'true');
    return {
      rows: rows.length,
      states: rows.map(r => r.children[2].textContent.trim()),
      selected: on ? on.textContent.replace(/\\d+/g, '').trim() : null,
    };
  `), { rows: 1, states: ['needs you'], selected: 'Needs you' });

  await send('Page.reload');
  await sleep(1300);
  check('processes: a reload keeps the filtered view', await js(`
    return { q: location.search, rows: document.querySelectorAll('button[class*="trow"]').length };
  `), { q: '?state=needs_input', rows: 1 });

  await goto('/w/ws-onda/processes?state=running');
  check('processes: an empty filter names itself and offers a way out', await js(`
    const main = document.querySelector('main');
    return {
      rows: document.querySelectorAll('button[class*="trow"]').length,
      names: main.innerText.includes('No run in this workspace is running.'),
      showAll: [...main.querySelectorAll('button')].some(b => b.textContent.trim() === 'Show all'),
      counts: [...document.querySelectorAll('[aria-label="Filter processes"] [role="tab"]')].map(t => t.textContent.trim()).join('|'),
    };
  `), (v) => v.rows === 0 && v.names === true && v.showAll === true && v.counts.includes('Running0'));

  await js(`${helpers} click(byText('button', 'Show all')); await new Promise(r => setTimeout(r, 450));`);
  check('processes: Show all clears the filter and the link', await js(`
    return { q: location.search, rows: document.querySelectorAll('button[class*="trow"]').length };
  `), { q: '', rows: 2 });

  await goto('/w/ws-research/processes?fail=1');
  check('processes: the failure band offers a retry', await js(`
    const alert = document.querySelector('[role="alert"]');
    return {
      alert: !!alert,
      typed: alert ? alert.textContent.includes('?fail=1') : false,
      retry: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Try again'),
    };
  `), { alert: true, typed: true, retry: true });

  await js(`${helpers} click(byText('button', 'Try again')); return 1;`);
  check('processes: the retry draws three static rows while it reads', await js(`
    return document.querySelectorAll('[class*="skeleton"] i').length;
  `), 3);
  await sleep(1100);
  check('processes: the retry clears the failure', await js(`
    return {
      alert: !!document.querySelector('[role="alert"]'),
      rows: document.querySelectorAll('button[class*="trow"]').length,
      q: location.search,
    };
  `), (v) => v.alert === false && v.rows >= 5 && v.q === '');

  await goto('/w/ws-research/processes/run-baseline');
  check('run: controls mirror the capability list', await js(`
    const labels = [...document.querySelectorAll('aside[data-panel-context] button')].map(b => b.textContent.trim());
    return labels.filter(l => ['Pause', 'Stop', 'Answer', 'Approve', 'Re-run', 'Resume'].includes(l));
  `), ['Stop', 'Pause']);
  await goto('/w/ws-research/processes/run-lit');
  check('run: a run without pause does not draw a Pause button', await js(`
    const labels = [...document.querySelectorAll('aside[data-panel-context] button')].map(b => b.textContent.trim());
    return labels.filter(l => ['Pause', 'Stop', 'Answer', 'Approve', 'Re-run', 'Resume'].includes(l));
  `), ['Answer', 'Stop']);

  await send('Page.navigate', { url: `${BASE}/w/ws-research/processes/run-baseline` });
  await sleep(1200);
  await js(`${helpers} click(byText('aside[data-panel-context] button', 'Pause')); await new Promise(r => setTimeout(r, 400));`);
  check('run: a control changes the local copy and says so', await js(`
    const kicker = document.querySelector('header [class*="runKicker"]');
    return {
      kicker: kicker ? kicker.innerText.replace(/\\s+/g, ' ').trim() : '',
      simulated: document.body.innerText.includes('simulated'),
      event: document.body.innerText.includes('did not move'),
    };
  `), (v) => v.kicker.includes('queued') && v.simulated === true && v.event === true);

  await js(`${helpers} click(byText('button', 'Restore the sample')); await new Promise(r => setTimeout(r, 400));`);
  check('run: a changed run can be restored to the sample', await js(`
    const kicker = document.querySelector('header [class*="runKicker"]');
    return {
      kicker: kicker ? kicker.innerText.replace(/\\s+/g, ' ').trim() : '',
      restore: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Restore the sample'),
      event: document.body.innerText.includes('did not move'),
    };
  `), (v) => v.kicker.includes('running') && v.restore === false && v.event === false);

  await goto('/w/ws-research/processes/run-lit');
  await js(`${helpers} click(byText('button', 'Simulate next state')); await new Promise(r => setTimeout(r, 250));`);
  check('run: the simulator shows that it is working', await js(`
    return document.body.innerText.includes('Simulating');
  `), true);
  await sleep(900);
  check('run: the simulator advances and keeps the label', await js(`
    const kicker = document.querySelector('header [class*="runKicker"]');
    return {
      kicker: kicker ? kicker.innerText.replace(/\\s+/g, ' ').trim() : '',
      label: document.body.innerText.includes('simulated'),
    };
  `), (v) => v.kicker.includes('done') && v.label === true);

  await js(`${helpers} click(byText('button', 'Processes')); await new Promise(r => setTimeout(r, 700));`);
  check('processes: the list reflects a simulated state without a reload', await js(`
    const row = [...document.querySelectorAll('button[class*="trow"]')].find(r => r.textContent.includes('lit-review'));
    return row ? row.innerText.replace(/\\s+/g, ' ').trim() : null;
  `), (v) => typeof v === 'string' && v.includes('done') && v.includes('simulated'));

  /* Acceptance 5 is a property of the source, not of a rendered frame: the only
     honest way to check it is to read the source. */
  const srcFiles = [];
  const walkSrc = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walkSrc(full);
      else srcFiles.push(full);
    }
  };
  walkSrc(fileURLToPath(new URL('../src/', import.meta.url)));
  check(
    'processes: no post-click apology survives in src/',
    srcFiles.filter((f) => readFileSync(f, 'utf8').includes('Nothing was sent')).length,
    0,
  );

  // ---- SP-02: every Overview row opens the object it names, in its own workspace ----
  await goto('/overview');
  await js(`${helpers} click(byText('button', 'protocol-brief')); await new Promise(r => setTimeout(r, 600));`);
  check('overview: needs-you row opens its own run', await js(`return location.pathname;`), '/w/ws-onda/processes/run-onda-brief');

  await goto('/overview');
  await js(`${helpers} click(byText('main button', 'raw-runs.parquet')); await new Promise(r => setTimeout(r, 600));`);
  check('overview: continue row resumes the object', await js(`return location.pathname;`), '/w/ws-research/files/f-raw-runs');

  await goto('/overview');
  // 'Onda Lab' also appears in needs-you/continue rows' meta; the members line
  // is what makes the workspace card unambiguous.
  await js(`
    const card = [...document.querySelectorAll('main button')]
      .find(b => b.textContent.includes('Onda Lab') && b.textContent.includes('members'));
    if (!card) return 'no card';
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
  await js('await new Promise(r => setTimeout(r, 700)); return 1;');
  check('files: Upload is disabled with a stated reason', await js(`
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Upload');
    return !!b && b.disabled && /files service/i.test(b.title) && b.getAttribute('aria-describedby') === 'files-limit';
  `), true);
  check('files: New folder is disabled with a stated reason', await js(`
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'New folder');
    return !!b && b.disabled && /files service/i.test(b.title);
  `), true);
  check('files: the reason is visible before any click', await js(`
    const el = document.getElementById('files-limit');
    return !!el && el.offsetParent !== null && el.textContent.includes('files service');
  `), true);
  await js(`document.querySelector('button[title*="Files service" i]').click(); await new Promise(r => setTimeout(r, 200));`);
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

  await centreInCanvas('c-12');
  await centreInCanvas('c-10');
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

  // The board was just panned to c-10; c-12 is a row below it and can sit under
  // the header, where a press belongs to the chrome. Centre it first.
  await centreInCanvas('c-12');
  const snapBefore = await cardState('c-12');
  const snapGrab = await centerOf('c-12');
  check('cards: the card used for the snap test is grabbable where it is pressed', await js(`
    const el = document.elementFromPoint(${Math.round(snapGrab.x)}, ${Math.round(snapGrab.y)});
    return el ? (el.closest('[data-card-id]')?.dataset.cardId || 'nothing cards') : 'nothing';
  `), 'c-12');
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
    // Cards and frames are both neighbours: the frame edge counts as an axis.
    const others = [...document.querySelectorAll('[data-card-id],[data-section-id]')]
      .filter(o => o !== el)
      .flatMap(o => { const ox = parseFloat(o.style.left); const ow = o.offsetWidth; return [ox, ox + ow / 2, ox + ow]; });
    const hit = axes.map(v => Math.min(...others.map(o => Math.abs(v - o))));
    return {
      moved: Math.round(x - ${snapBefore.x}),
      aligned: hit.some(d => d < 0.6),
      nearest: Math.min(...hit),
    };
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
  const nudgeBase = (await cardState('c-6')).x;
  await keyPress('ArrowRight', 'ArrowRight', 39);
  check('cards: an arrow key nudges 1px', (await cardState('c-6')).x - nudgeBase, 1);
  await keyPress('ArrowLeft', 'ArrowLeft', 37, 8);
  check('cards: shift+arrow nudges 10px', (await cardState('c-6')).x - nudgeBase, -9);

  // ---- selection: marquee, the floating bar, folding, deleting ----
  // Walking back to the original box also clears the strip of canvas the
  // marquee needs: the resized card was hanging into it.
  for (let i = 0; i < 6 && JSON.stringify(await cardState('c-6')) !== JSON.stringify(sizeBefore); i += 1) {
    await undoKey();
  }
  check('cards: undo walks every resize back to the original box', await cardState('c-6'), sizeBefore);
  await keyPress('Escape', 'Escape', 27);
  await centreInCanvas('c-8');
  const band = await js(`
    const a = document.querySelector('[data-card-id="c-7"]').getBoundingClientRect();
    const b = document.querySelector('[data-card-id="c-9"]').getBoundingClientRect();
    return { from: { x: b.right + 10, y: b.bottom + 10 }, to: { x: a.left - 10, y: a.top - 10 } };
  `);
  await dragTo(band.from, band.to, { steps: 8 });
  check('cards: a marquee selects every card it covers', await js(`
    const picked = [...document.querySelectorAll('[data-card-id][data-selected]')].map(e => e.dataset.cardId);
    return {
      picked: ['c-7','c-8','c-9'].filter(id => picked.includes(id)),
      count: picked.length,
      status: document.querySelector('[class*="statusMain"]')?.textContent.trim() || '',
      hud: !!document.querySelector('[class*="selectionHud"]'),
    };
  `), (v) => v.picked.length === 3 && v.status === v.count + ' selected' && v.hud === true);
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
  const beforeDel = await counts();
  const pickedCount = await js(`return document.querySelectorAll('[data-card-id][data-selected]').length;`);
  await js(`
    document.querySelector('[class*="selectionHud"] [title^="Delete"]')?.click();
    await new Promise(r => setTimeout(r, 260));
  `);
  const afterDel = await counts();
  check('cards: deleting the selection removes exactly it and the edges it held',
    [beforeDel.cards - afterDel.cards, beforeDel.edges - afterDel.edges, beforeDel.sections - afterDel.sections],
    (v) => v[0] === pickedCount && v[1] >= 1 && v[2] === 0);
  await undoKey();
  check('cards: one undo brings the cards and their edges back', await counts(), beforeDel);

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
      .map(el => ({ id: el.dataset.cardId, y: parseFloat(el.style.top), h: el.offsetHeight }))
      .sort((a, b) => a.y - b.y);
    return {
      gaps: [Math.round(r[1].y - (r[0].y + r[0].h)), Math.round(r[2].y - (r[1].y + r[1].h))],
      // c-12 is the tall one, so it must end up between the two folded rows.
      order: r.map(o => o.id).join(','),
      heights: r.map(o => o.h).join(','),
      rows: r.map(o => o.id + '@' + Math.round(o.y) + '+' + o.h).join(' '),
    };
  `), (v) => Math.abs(v.gaps[0] - v.gaps[1]) <= 2 && v.order === 'c-7,c-12,c-9');
  await undoKey();
  await undoKey();

  // ---- sections: the capsule is the handle, the frame is not the cards ----
  await centreInCanvas('c-13');
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
  await centreInCanvas('c-8');
  // A right-click inside a multi-selection keeps it, so the menu has to speak
  // for all three objects rather than for the one under the cursor.
  const first = await centerOf('c-8');
  await press(first.x, first.y);
  await release(first.x, first.y);
  await sleep(200);
  for (const id of ['c-9', 'c-12']) {
    await centreInCanvas(id);
    const p = await centerOf(id);
    await press(p.x, p.y, 1, 8);
    await release(p.x, p.y, 1, 8);
    await sleep(200);
  }
  check('menu: shift-clicking builds a three-object selection', await statusMain(), '3 selected');
  await centreInCanvas('c-8');
  const c8 = await centerOf('c-8');
  await rightClick(c8.x, c8.y);
  check('menu: with three objects picked the menu counts them', await js(`
    return [...document.querySelectorAll('[role="menuitem"]')].map(b => b.firstElementChild.textContent.trim());
  `), ['Fold / unfold', 'Duplicate 3', 'Delete 3']);

  // Clearing the selection first is what makes the next menu a single-object one.
  const clear = await findBlank();
  await press(clear.x, clear.y);
  await release(clear.x, clear.y);
  await sleep(200);
  await rightClick(c8.x, c8.y);
  check('menu: right-clicking one card offers object actions', await js(`
    return [...document.querySelectorAll('[role="menuitem"]')].map(b => b.firstElementChild.textContent.trim());
  `), ['Edit card', 'Fold / unfold', 'Duplicate', 'Delete']);
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
        if (el && (el.getAttribute('class') || '').includes('edgeHit')) {
          const a = hit.getPointAtLength(total * (t - 0.04)).matrixTransform(hit.getScreenCTM());
          const b = hit.getPointAtLength(total * (t + 0.04)).matrixTransform(hit.getScreenCTM());
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          return { x: s.x, y: s.y, nx: -(b.y - a.y) / len, ny: (b.x - a.x) / len };
        }
      }
    }
    return null;
  `);
  // Steps off the line along its normal and reports what is under the cursor.
  const offLine = (spot, d) => js(`
    const probe = (sign) => {
      const el = document.elementFromPoint(${spot.x} + ${spot.nx} * ${d} * sign, ${spot.y} + ${spot.ny} * ${d} * sign);
      return el ? ((el.getAttribute('class') || '').includes('edgeHit') ? 'edge' : 'other') : 'nothing';
    };
    const sides = [probe(1), probe(-1)];
    return sides.includes('edge') ? 'edge' : 'other';
  `);
  const selectedEdgeD = () => js(`
    const g = document.querySelector('svg[class*="edgeLayer"] > g[data-selected]');
    return g ? g.querySelector('[class*="edgeLine"]').getAttribute('d') : null;
  `);
  const line = await edgeAt();
  check('edges: one line is reachable in the viewport', !!line, true);
  if (line) {
    // A line is a hairline to look at but a 24px target to click: 9px off the
    // stroke must still hit it, 20px off must not. Zoom-independent.
    check('edges: the target is 24px wide on screen, whatever the zoom',
      [await offLine(line, 9), await offLine(line, 20)], ['edge', 'other']);
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
    const input = document.querySelector('input[class*="panelInput"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    if (!input) throw new Error('no edge label input in the panel');
    input.focus();
    set.call(input, 'contradicts');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
    await new Promise(r => setTimeout(r, 280));
  `);
  check('edges: the label is drawn on the line', await js(`
    return [...document.querySelectorAll('svg[class*="labelLayer"] text')].map(t => t.textContent).join('|');
  `), (v) => v.includes('contradicts'));
  // The chip is an object too: clicking it selects the line it sits on.
  const away = await findBlank();
  await press(away.x, away.y);
  await release(away.x, away.y);
  await sleep(200);
  const chip = await js(`
    const t = [...document.querySelectorAll('svg[class*="labelLayer"] text')].find(n => n.textContent === 'contradicts');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  if (chip) {
    await press(chip.x, chip.y);
    await release(chip.x, chip.y);
    await sleep(240);
    check('edges: clicking the label selects its line', [
      (await statusMain()).startsWith('Edge · '),
      await js(`return !!document.querySelector('[class*="edgeHud"]');`),
    ], [true, true]);
  }
  await js(`
    document.querySelector('[class*="edgeHud"] [title="Delete the edge"]')?.click();
    await new Promise(r => setTimeout(r, 280));
  `);
  check('edges: the bar deletes only that line', await counts(), { cards: 17, sections: 3, edges: 3 });
  await undoKey();
  check('edges: undo brings the labelled line back', (await counts()).edges, 4);

  // The bar used to float over the middle of the selected line, where it landed
  // on the card the line points at — and its buttons ate the click. It is docked
  // above the status line now, so a card click always belongs to the card.
  const win = await edgeAt();
  check('edges: another line is still reachable for the hand-off test', !!win, true);
  if (win) {
    await press(win.x, win.y);
    await release(win.x, win.y);
    await sleep(240);
    const title = await js(`
      const r = document.querySelector('[data-card-id="c-8"]').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + 14, over: document.elementFromPoint(r.left + r.width / 2, r.top + 14)?.closest('[class*="edgeHud"]') ? 'hud' : 'card' };
    `);
    check('edges: the bar no longer covers a card title', title.over, 'card');
    await press(title.x, title.y);
    await release(title.x, title.y);
    await sleep(260);
    check('edges: clicking a card drops the edge selection', [
      (await statusMain()).startsWith('Selected · '),
      await js(`return { hud: !!document.querySelector('[class*="edgeHud"]'), card: document.querySelector('[data-card-id="c-8"]').hasAttribute('data-selected') };`),
    ], [true, { hud: false, card: true }]);
  }

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
  // Both ends have to be on screen at 100%, so the pair is the column below c-6.
  await centreInCanvas('c-6');
  await hoverCard('c-6');
  const fromAnchor = await anchorOf('c-6', 'b');
  // The dot is drawn 9px across; the target around it is wider, so the gesture
  // does not need the pointer to land on the dot itself.
  check('cards: the link dot takes a click 6px off its centre', await js(`
    const dot = document.querySelector('[data-card-id="c-6"] [data-anchor="b"]');
    const r = dot.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = (x, y) => !!(document.elementFromPoint(x, y)?.closest('[data-anchor]'));
    return { far: hit(cx + 6, cy) || hit(cx - 6, cy), dot: Math.round(r.width) };
  `), (v) => v.far === true);
  await moveTo(fromAnchor.x, fromAnchor.y);
  const onto = await centerOf('c-7');
  await dragTo(fromAnchor, onto, { steps: 8 });
  check('edges: dragging a side dot onto a card connects them', (await counts()).edges, 5);
  check('edges: the new line is what the status bar names', await statusMain(), (v) => v.startsWith('Edge · '));

  await keyPress('Escape', 'Escape', 27);
  await hoverCard('c-6');
  const sideAnchor = await anchorOf('c-6', 'l');
  await moveTo(sideAnchor.x, sideAnchor.y);
  const emptySpot = await findBlank();
  const beforeLink = await counts();
  await dragTo(sideAnchor, emptySpot, { steps: 8 });
  check('edges: releasing on empty canvas grows a connected card', [
    (await counts()).cards, (await counts()).edges,
    await js(`return document.activeElement?.getAttribute('aria-label');`),
  ], [beforeLink.cards + 1, beforeLink.edges + 1, 'Card title']);
  await keyPress('Escape', 'Escape', 27);
  check('edges: discarding that card takes its edge with it', await counts(),
    { cards: beforeLink.cards, sections: beforeLink.sections, edges: beforeLink.edges });

  // ---- canvas: auto-pan, minimap, docks ----
  const areaBox = await js(`
    const r = document.querySelector('[class*="canvasArea"]').getBoundingClientRect();
    return { right: r.right, top: r.top, bottom: r.bottom };
  `);
  await centreInCanvas('c-8');
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

  // ---- Compute v2: backends, run, instances, activity, marketplace ----
  /* Fills by aria-label (the app labels its controls, not with <label>), and
     dispatches both input and change so React sees selects too. */
  const fillAria = async (label, value) => js(`
    const input = document.querySelector('[aria-label=${JSON.stringify(label)}]');
    if (!input) return null;
    const set = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set;
    set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 90));
    return 1;
  `);

  await goto('/compute');
  check('compute: the rail opens an overview that leads with usable state', await js(`
    const text = document.body.innerText;
    return {
      rail: [...document.querySelectorAll('[data-rail-item]')].some(a => a.textContent.trim() === 'Compute'),
      h1: document.querySelector('h1')?.textContent.trim(),
      stats: [...document.querySelectorAll('[class*="statLabel"]')].map(l => l.textContent.trim()),
      envs: text.includes('This machine') && text.includes('Cluster (Slurm)') && text.includes('Kubernetes'),
    };
  `), (v) => v.rail && v.h1 === 'Compute' && v.stats.includes('Backends ready') && v.stats.includes('Usable now') && v.envs === true);

  await goto('/compute/backends');
  check('compute: backends separate configuration from machines and mark the boundary', await js(`
    const text = document.body.innerText;
    return {
      slurm: [...document.querySelectorAll('[data-backend-row]')].some(r => r.textContent.includes('Slurm') && r.textContent.includes('no instances')),
      planned: text.includes('No flow to open'),
      catalog: text.includes('Available to configure'),
      default: text.includes('DEFAULT'),
    };
  `), { slurm: true, planned: true, catalog: true, default: true });

  await goto('/compute/backends/b-slurm');
  check('compute: an environment without instances says so instead of faking machines', await js(`
    const text = document.body.innerText;
    return {
      h1: document.querySelector('h1')?.textContent.trim(),
      honest: text.includes('There is no machine here to list'),
      form: !!document.querySelector('input[aria-label="Login node"]'),
    };
  `), { h1: 'Cluster (Slurm)', honest: true, form: true });

  await goto('/compute/backends/new?type=ray');
  await fillAria('Head address', 'ray://unreachable.host:10001');
  await js(`${helpers} click(byText('button', 'Test and save')); await new Promise(r => setTimeout(r, 1500)); return 1;`);
  check('compute: a backend that does not answer is saved unreachable, with the failure stated', await js(`
    const text = document.body.innerText;
    return {
      status: text.includes('Unreachable'),
      path: location.pathname.startsWith('/compute/backends/b-ray-'),
    };
  `), (v) => v.status === true && v.path === true);

  await goto('/compute/run');
  await fillAria('Workload name', 'eval-9');
  await js(`${helpers} click(byText('button', 'Required')); await new Promise(r => setTimeout(r, 120)); return 1;`);
  await fillAria('Minimum GPU memory in GB', '80');
  await js(`${helpers} click(byText('button', 'Find targets')); await new Promise(r => setTimeout(r, 300)); return 1;`);
  check('compute: run ranks targets and the recommendation carries reasons', await js(`
    const cards = [...document.querySelectorAll('li[class*="rec"]')];
    return {
      count: cards.length,
      first: cards[0]?.textContent.includes('h100-x1') ?? false,
      reasons: cards[0]?.textContent.includes('Idle') ?? false,
      noBackendTargets: ![...cards].some(c => c.textContent.includes('Cluster (Slurm)')),
    };
  `), { count: 1, first: true, reasons: true, noBackendTargets: true });

  await js(`${helpers} click(byText('button', 'Choose this')); await new Promise(r => setTimeout(r, 400)); return 1;`);
  check('compute: confirming a target queues work and claims nothing more', await js(`
    const band = document.querySelector('[data-run-assigned]');
    return {
      queued: band?.textContent.includes('Queued') ?? false,
      honest: band?.textContent.includes('does not start work in this build') ?? false,
    };
  `), { queued: true, honest: true });

  await goto('/compute/run');
  await js(`${helpers} click(byText('button', 'Find targets')); await new Promise(r => setTimeout(r, 300)); return 1;`);
  await js(`${helpers} click(byText('button', 'Show all 3 targets for manual selection')); await new Promise(r => setTimeout(r, 250)); return 1;`);
  await js(`${helpers} click(document.querySelector('[data-choose-target="b-slurm"]')); await new Promise(r => setTimeout(r, 400)); return 1;`);
  check('compute: manual selection reaches the same outcome through the same pool', await js(`
    const band = document.querySelector('[data-run-assigned]');
    return { scheduler: band?.textContent.includes('Cluster (Slurm)') ?? false };
  `), { scheduler: true });

  await goto('/compute/instances?availability=unknown');
  check('compute: the unknown-availability filter isolates unreachable machines', await js(`
    return [...document.querySelectorAll('[data-instance-row]')].map(r => r.textContent.trim().slice(0, 20));
  `), (v) => v.length === 1 && v[0].includes('office-box'));

  await goto('/compute/instances/r-aws-h100');
  check('compute: an acquired machine shows its sample rate, and terminating asks first', await js(`
    const text = document.body.innerText;
    return {
      rate: text.includes('2.49') && text.includes('representative'),
      acquired: text.includes('acquired'),
      confirmBefore: !document.querySelector('[data-instance-confirm]'),
    };
  `), { rate: true, acquired: true, confirmBefore: true });
  await js(`${helpers} click(byText('button', 'Terminate')); await new Promise(r => setTimeout(r, 150)); return 1;`);
  await js(`${helpers} click(byText('button', 'Terminate')); await new Promise(r => setTimeout(r, 400)); return 1;`);
  check('compute: terminating removes the machine from the pool', await js(`
    return { path: location.pathname, rows: document.querySelectorAll('[data-instance-row]').length };
  `), { path: '/compute/instances', rows: 5 });

  await goto('/compute/activity?state=queued');
  check('compute: activity lists the queued selections with their targets', await js(`
    const rows = [...document.querySelectorAll('[data-workload-row]')];
    return {
      count: rows.length,
      eval9: rows.some(r => r.textContent.includes('eval-9')),
    };
  `), { count: 3, eval9: true });

  await goto('/compute/activity/wl-cluster-brief');
  check('compute: a cluster-targeted run names its backend, not a machine', await js(`
    return document.body.innerText.includes('the environment takes the work directly');
  `), true);

  await goto('/compute/marketplace');
  check('compute: marketplace labels its prices as samples before showing them', await js(`
    const text = document.body.innerText;
    return {
      banner: text.includes('representative samples'),
      rows: document.querySelectorAll('[data-listing-row]').length,
    };
  `), { banner: true, rows: 6 });

  await fillAria('Minimum GPU memory in GB', '80');
  check('compute: marketplace filters by hardware requirement', await js(`
    return [...document.querySelectorAll('[data-listing-row]')].map(r => r.textContent.includes('H100'));
  `), [true, true]);
  await fillAria('Minimum GPU memory in GB', '');

  await goto('/compute/marketplace/l-h100-1');
  await js(`${helpers} click(byText('button', 'Acquire')); await new Promise(r => setTimeout(r, 200)); return 1;`);
  check('compute: acquiring explains instead of provisioning', await js(`
    return document.querySelector('[data-acquire-notice]')?.textContent ?? null;
  `), (v) => typeof v === 'string' && v.includes('No billing or provisioning exists'));

  // ---- User: identity, preferences, environment, security ----

  await goto('/account');
  check('user: the old account path redirects, and the rail names User', await js(`
    const rail = [...document.querySelectorAll('[data-rail-item]')].some(a => a.textContent.trim() === 'User');
    return { path: location.pathname, rail, h1: document.querySelector('h1')?.textContent.trim() };
  `), (v) => v.path.startsWith('/user') && v.rail === true && v.h1 === 'User');

  await goto('/user/identity');
  await js(`${helpers} click(byText('button', 'Edit display name')); await new Promise(r => setTimeout(r, 150)); return 1;`);
  await fillAria('Display name', 'C. Zhao');
  await js(`${helpers} click(byText('button', 'Save')); await new Promise(r => setTimeout(r, 250)); return 1;`);
  check('user: a new display name follows the person into the rail', await js(`
    return {
      identity: document.querySelector('[class*="identityName"]')?.textContent.trim(),
      rail: document.querySelector('[class*="profileName"]')?.textContent.trim(),
      status: document.querySelector('[role="status"]')?.textContent.includes('identity provider'),
    };
  `), (v) => v.identity === 'C. Zhao' && v.rail === 'C. Zhao' && v.status === true);

  await goto('/user/preferences');
  await fillAria('Landing page', 'recently');
  check('user: the landing preference is persisted where the router reads it', await js(`
    const raw = localStorage.getItem('thylas:user:v1');
    return raw ? JSON.parse(raw).prefs.landing : null;
  `), 'recently');
  await goto('/');
  check('user: the root now lands where the preference says', await js(`return location.pathname;`), '/recently');
  await goto('/user/preferences');
  await fillAria('Landing page', 'overview');

  await goto('/user/environment');
  check('user: my environment links out to Compute instead of duplicating it', await js(`
    const text = document.body.innerText.replace(new RegExp(String.fromCharCode(10), 'g'), ' ');
    return {
      pool: text.includes('Compute pool') && /machines . [0-9]+ connected/.test(text),
      noTable: !document.querySelector('table'),
    };
  `), { pool: true, noTable: true });

  await goto('/user/security');
  check('user: sign-out is disabled and says why', await js(`
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Sign out');
    return { disabled: btn?.disabled ?? null, why: btn?.title ?? null };
  `), (v) => v.disabled === true && typeof v.why === 'string' && v.why.includes('No auth service'));

  // ---- Connect: three views, two details, and no fake authorization ----
  await goto('/connect');
  check('connect: the rail opens the section with four sample connections', await js(`
    return {
      rail: [...document.querySelectorAll('[data-rail-item]')].some(a => a.textContent.trim() === 'Connect'),
      rows: document.querySelectorAll('[data-integration-row]').length,
      org: document.body.innerText.includes('ORG · ONDA LAB'),
      h1: document.querySelector('h1')?.textContent.trim(),
    };
  `), { rail: true, rows: 4, org: true, h1: 'Connect' });

  await goto('/connect/i/int-github');
  check('connect: a detail states its scopes and what lies beyond them', await js(`
    const text = document.body.innerText.toLowerCase();
    return {
      scopes: document.querySelectorAll('[class*="scopeRow"]').length,
      beyond: text.includes('not possible with the granted scopes'),
      activity: document.querySelectorAll('[class*="logItem"]').length,
    };
  `), { scopes: 3, beyond: true, activity: 3 });

  await js(`${helpers} click(byText('button', 'Disconnect')); await new Promise(r => setTimeout(r, 150)); return 1;`);
  check('connect: disconnect asks first, and states the consequence', await js(`
    const confirm = document.querySelector('[data-connect-confirm]');
    return { open: !!confirm, says: confirm?.textContent.includes('no backend to undo against') ?? false };
  `), { open: true, says: true });
  await js(`${helpers} click(byText('button', 'Disconnect')); await new Promise(r => setTimeout(r, 350)); return 1;`);
  check('connect: confirming removes the connection from the list', await js(`
    return { path: location.pathname, rows: document.querySelectorAll('[data-integration-row]').length };
  `), { path: '/connect', rows: 3 });

  await goto('/connect/discover');
  check('connect: discover hides connected apps and marks the boundary tiers', await js(`
    const text = document.body.innerText;
    /* int-gdrive was not disconnected earlier in the run, so its app must be
       absent here; int-github WAS disconnected, and correctly returns. */
    return {
      stillConnected: !document.querySelector('[data-app-row="app-gdrive"]'),
      disconnectedReturns: !!document.querySelector('[data-app-row="app-github"]'),
      comingSoon: document.querySelector('[data-tier="coming-soon"]')?.textContent.includes('Discord') ?? false,
      unsupported: text.includes('Microsoft Teams') && text.includes('No flow to open'),
    };
  `), { stillConnected: true, disconnectedReturns: true, comingSoon: true, unsupported: true });

  await fillAria('Search applications', 'zzzz');
  check('connect: an empty search result names itself', await js(`
    return document.querySelector('[class*="emptyTitle"]')?.textContent.trim() ?? null;
  `), 'No app matches this search');
  await fillAria('Search applications', '');

  await goto('/connect/apps/app-notion');
  await js(`${helpers} click(byText('button', 'Authorize')); await new Promise(r => setTimeout(r, 200)); return 1;`);
  check('connect: authorize never reports success', await js(`
    return document.querySelector('[role="status"]')?.textContent ?? null;
  `), (v) => typeof v === 'string' && v.includes('No OAuth client is connected'));

  await goto('/connect/custom');
  await js(`${helpers} click(byText('button', 'MCP server')); await new Promise(r => setTimeout(r, 120)); return 1;`);
  await fillAria('Integration name', 'Field tools MCP');
  await fillAria('Endpoint', 'stdio://field-tools');
  await js(`${helpers} click(byText('button', 'Register')); await new Promise(r => setTimeout(r, 250)); return 1;`);
  check('connect: a registration is recorded as registered, never connected', await js(`
    const row = document.querySelector('[data-custom-row]');
    return { present: !!row, status: row?.textContent.includes('not connected') ?? false };
  `), (v) => v.present === true && v.status === true);

  // The session's writes must not leak into later runs.
  await js(`localStorage.removeItem('thylas:connect:v1'); localStorage.removeItem('thylas:user:v1'); return 1;`);

  // ---- Chat: one conversation model, two surfaces, real streaming ----
  aiMode = 'ok';
  await goto('/chat');
  await js(`
    window.__errs = [];
    window.addEventListener('error', e => window.__errs.push(String(e.message)));
    window.addEventListener('unhandledrejection', e => window.__errs.push('rej:' + String(e.reason?.message ?? e.reason)));
    return 1;
  `);
  check('chat: the rail opens the page, and a conversation starts on demand', await js(`
    return {
      rail: [...document.querySelectorAll('[data-rail-item]')].some(a => a.textContent.trim() === 'Chat'),
      empty: document.body.innerText.includes('No conversation yet.'),
      created: (await new Promise((resolve) => {
        [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'New conversation')?.click();
        setTimeout(() => resolve(!!document.querySelector('textarea[aria-label="Message"]')), 300);
      })),
      model: document.querySelector('[data-model-btn]')?.textContent.trim(),
    };
  `), (v) => v.rail && v.empty && v.created && v.model === 'deepseek-chat');

  await fillAria('Message', 'What is a boundary? Show an example.');
  await js(`${helpers} click(document.querySelector('button[aria-label="Send"]')); await new Promise(r => setTimeout(r, 300)); return 1;`);
  check('chat: sending places the turn and the composer enters its stop state', await js(`
    const text = document.querySelector('[data-chat-stream]')?.innerText ?? '';
    return {
      user: text.includes('What is a boundary?'),
      assistant: text.includes('ASSISTANT'),
    };
  `), { user: true, assistant: true });

  check('chat: the SSE endpoint streams deltas end to end in the browser', await js(`
    const res = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'reader probe' }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const lines = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf(String.fromCharCode(10))) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line.startsWith('data:')) lines.push(line.slice(5, 70));
      }
    }
    return { count: lines.length, deltas: lines.filter((l) => l.includes('choices')).length };
  `), (v) => v.count >= 3 && v.deltas >= 2);


  await goto('/chat');
  await js(`${helpers} click(document.querySelector('[data-context-add]')); await new Promise(r => setTimeout(r, 200)); return 1;`);
  check('chat: the context picker lists real workspace materials', await js(`
    const popover = document.querySelector('[data-context-popover]');
    return {
      open: !!popover,
      workspace: popover?.innerText.includes('Research') ?? false,
      note: popover?.innerText.includes('Method') ?? false,
    };
  `), { open: true, workspace: true, note: true });
  await js(`
    const rows = [...document.querySelectorAll('[data-context-popover] [class*="popoverRow"]')];
    rows.find(r => r.textContent.includes('Method'))?.click();
    await new Promise(r => setTimeout(r, 150));
    return 1;
  `);
  await fillAria('Message', 'Summarize the method note');
  await js(`${helpers} click(document.querySelector('button[aria-label="Send"]')); await new Promise(r => setTimeout(r, 1600)); return 1;`);
  check('chat: attached context appears as evidence on the user turn', await js(`
    const text = document.querySelector('[data-chat-stream]')?.innerText ?? '';
    return text.includes('note · Method');
  `), true);

  await goto('/w/ws-research/files');
  await js(`${helpers} click(document.querySelector('[data-chat-toggle]')); await new Promise(r => setTimeout(r, 250)); return 1;`);
  check('chat: the dock opens inside a workspace sharing the conversation', await js(`
    const dock = document.querySelector('[data-chat-dock]');
    return {
      open: !!dock,
      sameTitle: dock?.textContent.includes('Summarize the method note') ?? false,
      composer: !!dock?.querySelector('textarea[aria-label="Message"]'),
    };
  `), { open: true, sameTitle: true, composer: true });

  await js(`
    const dock = document.querySelector('[data-chat-dock]');
    const ta = dock.querySelector('textarea[aria-label="Message"]');
    const set = Object.getOwnPropertyDescriptor(ta.constructor.prototype, 'value').set;
    set.call(ta, 'Answer from the dock');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    return 1;
  `);
  await js(`
    const dock = document.querySelector('[data-chat-dock]');
    ${helpers} click(dock.querySelector('button[aria-label="Send"]'));
    await new Promise(r => setTimeout(r, 1600));
    return 1;
  `);
  check('chat: sending from the dock appends to the same conversation', await js(`
    const dock = document.querySelector('[data-chat-dock]');
    return {
      sent: dock?.innerText.includes('Answer from the dock') ?? false,
    };
  `), { sent: true });
  await js(`${helpers} click(document.querySelector('[data-dock-close]')); await new Promise(r => setTimeout(r, 200)); return 1;`);
  check('chat: the dock closes and leaves the page intact', await js(`
    return { dock: !!document.querySelector('[data-chat-dock]'), files: document.body.innerText.includes('raw-runs') };
  `), { dock: false, files: true });

  aiMode = 'ratelimit';
  await goto('/chat');
  await js(`return 1;`);
  await fillAria('Message', 'trigger the stub');
  await js(`${helpers} click(document.querySelector('button[aria-label="Send"]')); await new Promise(r => setTimeout(r, 600)); return 1;`);
  check('chat: a failure is typed, explained, and keeps the input recoverable', await js(`
    const alert = document.querySelector('[role="alert"]');
    return {
      message: alert?.textContent.includes('stub rate limit') ?? false,
      next: alert?.textContent.includes('Wait for the window to pass') ?? false,
      regenerate: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Regenerate'),
    };
  `), { message: true, next: true, regenerate: true });
  aiMode = 'ok';
  await js(`localStorage.removeItem('thylas:chat:v1'); return 1;`);

  // ---- Artifacts: library, detail, creation ----
  await goto('/artifacts');
  check('artifacts: the rail opens the library with all seven seeds', await js(`
    return {
      rail: [...document.querySelectorAll('[data-rail-item]')].some(a => a.textContent.trim() === 'Artifacts'),
      h1: document.querySelector('h1')?.textContent.trim(),
      rows: document.querySelectorAll('[data-artifact-row]').length,
    };
  `), (v) => v.rail && v.h1 === 'Artifacts' && v.rows === 7);

  await fillAria('Search artifacts', 'boundary');
  check('artifacts: search narrows to the boundary family', await js(`
    return [...document.querySelectorAll('[data-artifact-row]')].map(r => r.textContent.includes('oundary'));
  `), (v) => v.length === 4 && v.every(Boolean));
  await fillAria('Search artifacts', 'zzzznope');
  check('artifacts: a search with no match names itself and offers the way out', await js(`
    return document.body.innerText.includes('Nothing matches this search');
  `), true);
  await fillAria('Search artifacts', '');
  await js(`${helpers} click(byText('button', 'External')); await new Promise(r => setTimeout(r, 150)); return 1;`);
  check('artifacts: the External view isolates referenced sources', await js(`
    return [...document.querySelectorAll('[data-artifact-row]')].map(r => r.textContent.includes('Obsidian'));
  `), [true]);

  await js(`${helpers} click(byText('button', 'All')); await new Promise(r => setTimeout(r, 150)); return 1;`);
  await goto('/artifacts/a-boundary');
  await js(`return 1;`);
  check('artifacts: detail renders the kind’s own sections and version history', await js(`
    const text = document.body.innerText;
    return {
      h1: document.querySelector('h1')?.textContent.trim(),
      sections: [...document.querySelectorAll('[data-section]')].map(x => x.querySelector('[class*="sectionTitle"]')?.textContent.trim()),
      versions: text.includes('v3') && text.includes('accepted as the working definition'),
      relations: text.includes('Boundary mapping method'),
    };
  `), (v) => v.h1 === 'Boundary model' && v.sections.join(',').includes('Definition') && v.versions && v.relations);

  await js(`${helpers} click(document.querySelector('[data-section] [class*="sectionActions"] button')); await new Promise(r => setTimeout(r, 200)); return 1;`);
  await fillAria('Section content', 'A boundary is where one thing stops being itself. Revised for the prototype.');
  await js(`${helpers} click(byText('button', 'Save as new version')); await new Promise(r => setTimeout(r, 350)); return 1;`);
  check('artifacts: editing a section creates a new version, attributed', await js(`
    const text = document.body.innerText;
    return {
      edited: text.includes('Revised for the prototype'),
      version: text.includes('edited'),
    };
  `), { edited: true, version: true });

  await js(`${helpers} click(document.querySelector('[data-open-coworker]')); await new Promise(r => setTimeout(r, 350)); return 1;`);
  check('artifacts: the Coworker action opens the real chat dock with the artifact as context', await js(`
    const dock = document.querySelector('[data-chat-dock]');
    return {
      open: !!dock,
      context: dock?.innerText.includes('Boundary model') ?? false,
    };
  `), { open: true, context: true });
  await js(`${helpers} click(document.querySelector('[data-dock-close]')); await new Promise(r => setTimeout(r, 200)); return 1;`);

  await goto('/artifacts/new');
  await js(`${helpers} click(document.querySelector('[data-path="idea"]')); await new Promise(r => setTimeout(r, 200)); return 1;`);
  await fillAria('Artifact name', 'Cost of crossing');
  await fillAria('First thought', 'Crossing a boundary always costs something to observe.');
  await js(`${helpers} click(byText('button', 'Create concept')); await new Promise(r => setTimeout(r, 350)); return 1;`);
  check('artifacts: the idea path creates a draft with the kind template', await js(`
    const text = document.body.innerText;
    return {
      h1: document.querySelector('h1')?.textContent.trim(),
      draft: text.includes('draft'),
      template: text.includes('Definition') && text.includes('Origin and context'),
      body: text.includes('Crossing a boundary always costs something to observe.'),
    };
  `), (v) => v.h1 === 'Cost of crossing' && v.draft && v.template && v.body);

  await goto('/artifacts/new');
  await js(`${helpers} click(document.querySelector('[data-path="coworker"]')); await new Promise(r => setTimeout(r, 150)); return 1;`);
  check('artifacts: the Coworker creation path is an honest prototype notice', await js(`
    return document.body.innerText.includes('needs the agent runtime');
  `), true);

  await goto('/artifacts/new');
  await js(`${helpers} click(document.querySelector('[data-path="external"]')); await new Promise(r => setTimeout(r, 150)); return 1;`);
  await fillAria('Artifact name', 'Spec draft (Notion)');
  await fillAria('External location', 'notion.so/spec-draft');
  await js(`${helpers} click(byText('button', 'Create reference')); await new Promise(r => setTimeout(r, 350)); return 1;`);
  check('artifacts: an external reference records the source as system of record', await js(`
    const text = document.body.innerText;
    return {
      external: text.includes('system of record'),
      chip: text.includes('external'),
    };
  `), { external: true, chip: true });

  await goto('/artifacts');
  check('artifacts: the library reflects everything the session created', await js(`
    return document.querySelectorAll('[data-artifact-row]').length;
  `), (v) => v >= 9);
  await js(`localStorage.removeItem('thylas:artifacts:v1'); return 1;`);

  // ---- Coworkers: directory, working interface, config, creation ----
  await js(`localStorage.removeItem('thylas:coworkers:v1'); return 1;`);
  await goto('/coworkers');
  check('coworkers: the rail opens the directory with the three seeds', await js(`
    return {
      rail: [...document.querySelectorAll('[data-rail-item]')].some(a => a.textContent.trim() === 'Coworkers'),
      h1: document.querySelector('h1')?.textContent.trim(),
      rows: document.querySelectorAll('[data-coworker-row]').length,
    };
  `), (v) => v.rail && v.h1 === 'Coworkers' && v.rows === 3);

  await fillAria('Search coworkers', 'protocol');
  check('coworkers: search narrows to the reviewer', await js(`
    return [...document.querySelectorAll('[data-coworker-row]')].map(r => r.textContent.includes('Protocol Reviewer'));
  `), [true]);
  await fillAria('Search coworkers', '');

  await goto('/coworkers/cw-reviewer');
  check('coworkers: the working interface leads with conversation and honest side panels', await js(`
    const text = document.body.innerText;
    return {
      h1: document.querySelector('h1')?.textContent.trim(),
      composer: !!document.querySelector('textarea[aria-label="Message"]'),
      work: text.includes('No work items yet'),
      pinned: text.includes('Boundary mapping method'),
      paused: false,
    };
  `), (v) => v.h1 === 'Protocol Reviewer' && v.composer && v.work && v.pinned && v.paused === false);

  await fillAria('Message', 'Review the boundary protocol draft.');
  await js(`${helpers} click(document.querySelector('button[aria-label="Send"]')); await new Promise(r => setTimeout(r, 300)); return 1;`);
  check('coworkers: the conversation is the real chat surface', await js(`
    return document.querySelector('[data-chat-stream]')?.innerText.includes('Review the boundary protocol draft.') ?? false;
  `), true);

  await goto('/coworkers/cw-reviewer/config');
  await js('await new Promise(r => setTimeout(r, 500)); return 1;');
  await fillAria('Responsible for', 'Reviews protocols AND boundary tables for completeness.');
  await js(`${helpers} click(byText('button', 'Save changes')); await new Promise(r => setTimeout(r, 300)); return 1;`);
  check('coworkers: responsibility edits save into the store', await js(`
    const ta = document.querySelector('[aria-label="Responsible for"]');
    return {
      saved: ta ? ta.value.includes('AND boundary tables') : false,
      saveClosed: ![...document.querySelectorAll('button')].some(b => b.textContent.includes('Save changes')),
    };
  `), { saved: true, saveClosed: true });

  await goto('/coworkers/cw-reviewer');
  check('coworkers: the edit lands in the activity log on the working page', await js(`
    return document.body.innerText.includes('Updated') && document.body.innerText.includes('responsibilities');
  `), true);

  await goto(`/coworkers/cw-reviewer/config`);
  await js('await new Promise(r => setTimeout(r, 300)); return 1;');

  await fillAria('Workspace to join', 'Onda Lab');
  await js(`${helpers} click(byText('button', 'Add')); await new Promise(r => setTimeout(r, 250)); return 1;`);
  check('coworkers: membership add works and shows both workspaces', await js(`
    const text = document.body.innerText;
    return text.includes('Onda Lab') && text.includes('Research');
  `), true);
  await js(`${helpers} click(document.querySelector('[data-remove-membership="ws-onda"]')); await new Promise(r => setTimeout(r, 250)); return 1;`);

  await js(`${helpers} click(document.querySelector('[data-config-status]')); await new Promise(r => setTimeout(r, 400)); return 1;`);
  check('coworkers: pause flips availability without touching memberships', await js(`
    const text = document.body.innerText;
    return {
      paused: text.includes('Paused: new conversations and runs are blocked'),
      kept: text.includes('Research'),
    };
  `), { paused: true, kept: true });
  await js(`${helpers} click(document.querySelector('[data-config-status]')); await new Promise(r => setTimeout(r, 150)); return 1;`);

  await goto('/coworkers/new');
  await fillAria('Coworker name', 'Roadmap Checker');
  await fillAria('Responsible for', 'Checks roadmap stages against the artifact graph.');
  await js(`
    const sel = document.querySelector('select[aria-label="Initial workspace"]');
    const set = Object.getOwnPropertyDescriptor(sel.constructor.prototype, 'value').set;
    set.call(sel, 'ws-research'); sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    return 1;
  `);
  await js(`${helpers} click(byText('button', 'Create coworker')); await new Promise(r => setTimeout(r, 350)); return 1;`);
  check('coworkers: creation lands on the working interface as active', await js(`
    return {
      h1: document.querySelector('h1')?.textContent.trim(),
      status: document.body.innerText.includes('active'),
      composer: !!document.querySelector('textarea[aria-label="Message"]'),
    };
  `), (v) => v.h1 === 'Roadmap Checker' && v.status && v.composer);

  await goto('/coworkers');
  check('coworkers: the directory reflects the created coworker', await js(`
    return document.querySelectorAll('[data-coworker-row]').length;
  `), (v) => v >= 4);
  await js(`localStorage.removeItem('thylas:coworkers:v1'); return 1;`);
  await goto('/overview');

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
