#!/usr/bin/env node
/** Capture the sign-in warp frame by frame. */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = join(fileURLToPath(import.meta.url), '..');
const outDir = join(here, '..', 'design', 'reference', 'login');
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = 'http://localhost:5193';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(existsSync)[0];
const profile = mkdtempSync(join(tmpdir(), 'warp-shot-'));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9249', `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
await sleep(1500);
const list = await (await fetch('http://localhost:9249/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { resolve } = pending.get(m.id); pending.delete(m.id); resolve(m.result); }
});
const send = (method, params = {}) => { const callId = ++id; ws.send(JSON.stringify({ id: callId, method, params })); return new Promise((resolve) => pending.set(callId, { resolve })); };
const evaluate = (expression) => send('Runtime.evaluate', { expression, returnByValue: true });
await send('Page.enable');

const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) { writeFileSync(join(outDir, `${name}.png`), Buffer.from(s.data, 'base64')); console.log('shot', name); }
};

await send('Page.navigate', { url: `${BASE}/login` });
await sleep(1400);
await evaluate(`localStorage.setItem('thylas:user:v1', JSON.stringify({version:1, prefs:{theme:'warm'}})); localStorage.removeItem('thylas:login-sheet:v1'); 'ok'`);
await send('Page.reload');
await sleep(1600);

await evaluate(`(() => {
  const set = (el, value) => { const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set; setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(document.querySelector('input[aria-label="Email"]'), 'ceaser@oasis.dev');
  set(document.querySelector('input[aria-label="Password"]'), 'demo');
  return 'filled';
})()`);
await sleep(200);
await evaluate(`document.querySelector('[data-login-submit]').click(); 'go'`);

const start = Date.now();
for (const [name, at] of [['warp-1-stars', 280], ['warp-2-collapse', 470], ['warp-3-ink', 950], ['warp-4-comet', 1300], ['warp-5-close', 2380], ['warp-6-white', 2760]]) {
  const wait = at - (Date.now() - start);
  if (wait > 0) await sleep(wait);
  await shot(name);
}

ws.close(); chrome.kill(); process.exit(0);
