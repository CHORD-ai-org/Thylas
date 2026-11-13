#!/usr/bin/env node
/** Capture the Profile Initialization wizard for visual review. */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = join(fileURLToPath(import.meta.url), '..');
const outDir = join(here, '..', 'design', 'reference', 'chatgpt');
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(existsSync)[0];
const profile = mkdtempSync(join(tmpdir(), 'profile-shot-'));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9240', `--user-data-dir=${profile}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });
await sleep(1500);

const list = await (await fetch('http://localhost:9240/json')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve } = pending.get(msg.id);
    pending.delete(msg.id);
    resolve(msg.result);
  }
});
const send = (method, params = {}) => {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve) => pending.set(callId, { resolve }));
};
const evaluate = (expression) => send('Runtime.evaluate', { expression, returnByValue: true });
await send('Page.enable');

for (const [name, withSource] of [['profile-intro', false], ['profile-sources', true]]) {
  await send('Page.navigate', { url: 'http://localhost:5191/user' });
  await sleep(1200);
  await evaluate(`document.cookie = 'thylas_session=dev:u-shot-' + Date.now() + ':ws-1; path=/'; 'ok'`);
  await send('Page.navigate', { url: 'http://localhost:5191/user/profile' });
  await sleep(1500);
  if (withSource) {
    await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Add information sources')); if (b) b.click(); return 'ok'; })()`);
    await sleep(350);
    await evaluate(`(() => { const i = document.querySelector('input[aria-label="Source URL"]'); if (!i) return 'no'; const set = Object.getOwnPropertyDescriptor(i.constructor.prototype, 'value').set; set.call(i, 'https://example.com/about'); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
    await sleep(200);
    await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Add source'); if (b) b.click(); return 'ok'; })()`);
    await sleep(900);
  }
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) { writeFileSync(join(outDir, `${name}.png`), Buffer.from(s.data, 'base64')); console.log('shot', name); }
}

ws.close();
chrome.kill();
process.exit(0);
