#!/usr/bin/env node
/**
 * Journey scripts (Coworker-System-Plan §31): end-to-end walks through the
 * screens a real person uses, asserting on DOM state at every step. Same
 * harness shape as ui-checks.mjs (headless Chrome over CDP, owns its dev
 * server and its AI stub) but focused on the Coworker journeys:
 *
 *   J1 雇一位同事 — the six-step commissioning wizard.
 *   J2 协作一场   — two Coworkers, one session, signed outputs land back.
 *
 *   node scripts/journeys.mjs
 *
 * Exit code: 0 = all assertions pass, 1 = assertion failure, 2 = harness error.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.JOURNEYS_BASE ?? 'http://localhost:5181';
const AI_STUB_PORT = 8799;
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
 * A steerable stand-in for the model: the blueprint prompt gets a JSON draft,
 * the verify prompt gets a verdict, everything else gets honest output text.
 * The AI surface is real code against real middleware; only the far end fakes.
 */
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
      let prompt = '';
      try {
        const parsed = JSON.parse(body || '{}');
        prompt = (parsed.messages ?? []).map((m) => m.content ?? '').join('\n');
      } catch {
        /* fall through with an empty prompt */
      }
      let text = '竞品对比产出：三列对比，结论一句话。';
      if (prompt.includes('只输出 JSON') && prompt.includes('name')) {
        text = '{"name":"旅程同事","description":"Journey companion","forWork":"竞品对比","notFor":"写代码","output":"带来源的对比表"}';
      } else if (prompt.includes('逐条核对')) {
        text = '{"verdict":"pass","misses":[]}';
      }
      const payload = {
        id: 'journey-stub',
        object: 'chat.completion',
        model: 'journey-stub',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: text },
            finish_reason: 'stop',
          },
        ],
      };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
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
    server = spawn('npm', ['run', 'dev', '--', '--port', '5181', '--strictPort'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        /* Embedded PGlite (dev fallback): the journeys exercise the real API
           against a real migrated database — no external Postgres needed. */
        DATABASE_URL: 'pglite://journeys',
        DEEPSEEK_API_KEY: 'sk-journeys-stub',
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${AI_STUB_PORT}`,
        DEEPSEEK_TIMEOUT_MS: '5000',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
        OPENROUTER_API_KEY: '',
        KIMI_API_KEY: '',
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

  const port = 9338;
  const profile = mkdtempSync(join(tmpdir(), 'thylas-journeys-'));
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const cleanup = () => {
    chrome.kill();
    server?.kill();
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
  const pageErrors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      pageErrors.push(
        m.params?.exceptionDetails?.exception?.description ??
          m.params?.exceptionDetails?.text ??
          'exception',
      );
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
    await sleep(1000);
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
    const byText = (sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(text));
    const click = (el) => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const setVal = (el, value) => {
      if (!el) return false;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    };
    const setByLabel = (label, value) => {
      const el = document.querySelector('input[aria-label="' + label + '"], textarea[aria-label="' + label + '"]');
      return setVal(el, value);
    };
    const setSelectByText = (label, text) => {
      const sel = document.querySelector('select[aria-label="' + label + '"]');
      if (!sel) return false;
      const opt = [...sel.options].find((o) => o.textContent.trim().includes(text));
      if (!opt) return false;
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
  `;

  const waitFor = async (selector, timeout = 10000) => {
    for (let waited = 0; waited < timeout; waited += 200) {
      if (await js(`return !!document.querySelector(${JSON.stringify(selector)});`)) return true;
      await sleep(200);
    }
    return false;
  };

  let passed = 0;
  let failed = 0;
  const check = (name, actual, expected) => {
    const ok =
      typeof expected === 'function'
        ? expected(actual)
        : JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
      passed += 1;
      console.log(`  ✓ ${name}`);
    } else {
      failed += 1;
      console.log(`  ✗ ${name}\n    got: ${JSON.stringify(actual)}`);
    }
  };

  /* ---------------- J1 雇一位同事（六步向导） ---------------- */
  console.log('J1 雇一位同事');
  const j1Start = Date.now();
  await goto('/coworkers/new');
  /* Dev session, the way ui-checks does it — API writes need it or every
     create silently falls back to the local envelope. */
  await js(`document.cookie = 'thylas_session=dev:u-journey:ws-1; path=/'; return 1;`);
  await goto('/coworkers/new');
  await waitFor('[data-create-coworker-form]');
  check('form is there', await js(`${helpers} return !!document.querySelector('[data-create-coworker-form]');`), true);

  /* step 1 意图: intent + real generation (AI stub answers) */
  check('step 1 label', await js(`return document.querySelector('[data-create-coworker-form]') && document.body.textContent.includes('1/6');`), true);
  await js(`${helpers} return setByLabel('Intent', '帮我做竞品研究，产出对比表，不写代码。');`);
  await js(`${helpers} click(document.querySelector('[data-create-generate]'));`);
  await sleep(800);
  check('blueprint prefills and says so', await js(`${helpers} return (document.querySelector('[data-create-notice]')?.textContent ?? '').includes('草案已填');`), true);

  await js(`${helpers} click(document.querySelector('[data-create-next]'));`);
  await sleep(300);
  check('step 2 身份', await js(`return document.body.textContent.includes('2/6');`), true);
  await js(`${helpers} return setByLabel('Coworker name', '旅程同事');`);
  await js(`${helpers} click(document.querySelector('[data-create-next]'));`);
  await sleep(300);
  check('step 3 职责', await js(`return document.body.textContent.includes('3/6');`), true);
  await js(`${helpers} return setByLabel('Responsible for', '竞品对比与速读');`);
  await js(`${helpers} click(document.querySelector('[data-create-next]'));`);
  await sleep(300);
  check('step 4 Mind is declared config', await js(`return document.body.textContent.includes('4/6') && document.body.textContent.includes('不承诺行为差异');`), true);
  await js(`${helpers} click(document.querySelector('[data-create-next]'));`);
  await sleep(300);
  check('step 5 环境', await js(`return document.body.textContent.includes('5/6');`), true);
  await js(`${helpers} click(document.querySelector('[data-create-next]'));`);
  await sleep(300);
  check('step 6 First Encounter says running is C4', await js(`return document.body.textContent.includes('6/6') && document.body.textContent.includes('C4');`), true);
  await js(`${helpers} return setByLabel('First task', '对比两家竞品的定价页');`);
  await js(`${helpers} click(document.querySelector('[data-create-coworker-submit]'));`);
  await sleep(1200);
  check('landed on the coworker page', await js(`return location.pathname.startsWith('/coworkers/');`), true);
  check('the name is on the page', await js(`return document.body.textContent.includes('旅程同事');`), true);
  const j1Seconds = Math.round((Date.now() - j1Start) / 100);
  check('J1 finished well under three minutes', j1Seconds < 1800, true);

  /* ---------------- J2 协作一场 ---------------- */
  console.log('J2 协作一场');
  /* a second coworker through the quick-create channel (方案 A 双入口) */
  await goto('/coworkers/new');
  await js(`${helpers} click(document.querySelector('[data-create-mode-toggle]'));`);
  await sleep(300);
  await js(`${helpers} return setByLabel('Coworker name', '旅程搭档');`);
  await js(`${helpers} return setByLabel('Responsible for', '接手与复核');`);
  await js(`${helpers} click(document.querySelector('[data-create-coworker-submit]'));`);
  await sleep(1000);

  await goto('/w/ws-1/projects');
  await waitFor('[data-add-project]');
  await js(`${helpers} click(document.querySelector('[data-add-project]'));`);
  await waitFor('[data-project-create]');
  await js(`${helpers} return setByLabel('项目名', '旅程项目');`);
  await js(`${helpers} click(document.querySelector('[data-project-create]'));`);
  let cardSeen = false;
  for (let waited = 0; waited < 8000; waited += 500) {
    cardSeen = await js(`return document.body.textContent.includes('旅程项目');`);
    if (cardSeen) break;
    await sleep(500);
  }
  if (!cardSeen) {
    console.log('DEBUG notice:', await js(`return document.querySelector('[data-projects-notice]')?.textContent ?? 'none';`));
  }
  check('project card exists', cardSeen, true);

  /* open the card drawer -> ParticipationPanel */
  await js(`${helpers}
    const toggles = [...document.querySelectorAll('button[aria-expanded]')];
    const inCard = toggles.find((b) => (b.closest('li,article,section,div')?.textContent ?? '').includes('旅程项目'));
    click(inCard ?? toggles[0]);
    return toggles.length;`);
  const panelOpen = await waitFor('[data-participation-panel]');
  if (!panelOpen) {
    console.log('DEBUG drawer:', await js(`return !!document.querySelector('[data-connection-drawer]');`));
    console.log('DEBUG toggles:', await js(`return document.querySelectorAll('button[aria-expanded]').length;`));
    console.log('DEBUG body:', (await js(`return document.body.textContent.slice(0, 300);`)));
  }
  check('participation panel is open', panelOpen, true);

  await js(`${helpers} return setVal(document.querySelector('[data-sess-task]'), '做一场竞品对比');`);
  /* Pick the two journey Coworkers — seeds are local prototype rows and the
     断链 guard (rightly) refuses them at the API. */
  await js(`${helpers} return setSelectByText('交出方', '旅程同事') && setSelectByText('接手方', '旅程搭档');`);
  await js(`${helpers} click(document.querySelector('[data-sess-run]'));`);

  let sessionSeen = false;
  for (let waited = 0; waited < 60000; waited += 1000) {
    sessionSeen = await js(`${helpers} return !!document.querySelector('[data-session]');`);
    if (sessionSeen) break;
    await sleep(1000);
  }
  check('a session landed', sessionSeen, true);
  const sessionText = await js(`${helpers} return document.querySelector('[data-session]')?.textContent ?? '';`);
  check(
    'session reached an honest end state',
    sessionText,
    (t) => t.includes('completed') || t.includes('需要你') || t.includes('proposed'),
  );
  const panelText = await js(`${helpers} return document.querySelector('[data-participation-panel]')?.textContent ?? '';`);
  check('signed outputs landed (由 … 提出)', panelText, (t) => t.includes('由 ') && t.includes('提出'));
  check('handoff recorded (交接 … →)', panelText, (t) => t.includes('交接') || t.includes('→'));

  check('no page errors during the journeys', pageErrors, (e) => e.length === 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (pageErrors.length > 0) console.log('page errors:', pageErrors.slice(0, 3));
  cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('harness error:', err);
  process.exit(2);
});
