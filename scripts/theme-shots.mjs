#!/usr/bin/env node
/** Capture one page in all three palettes (warm default / black / white). */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = join(fileURLToPath(import.meta.url), '..');
const outDir = join(here, '..', 'design', 'reference', 'themes');
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(existsSync)[0];
const profile = mkdtempSync(join(tmpdir(), 'theme-shot-'));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9241', `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
await sleep(1500);
const list = await (await fetch('http://localhost:9241/json')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { const { resolve } = pending.get(msg.id); pending.delete(msg.id); resolve(msg.result); }
});
const send = (method, params = {}) => { const callId = ++id; ws.send(JSON.stringify({ id: callId, method, params })); return new Promise((resolve) => pending.set(callId, { resolve })); };
const evaluate = (expression) => send('Runtime.evaluate', { expression, returnByValue: true });
await send('Page.enable');

for (const [theme, path_, name] of [
  ['warm', '/overview', 'overview-warm'],
  ['dark', '/overview', 'overview-dark'],
  ['light', '/overview', 'overview-light'],
  ['dark', '/chat', 'chat-dark'],
]) {
  await send('Page.navigate', { url: `http://localhost:5193${path_}` });
  await sleep(1200);
  await evaluate(`localStorage.setItem('thylas:user:v1', JSON.stringify({version:1, prefs:{theme:'${theme}'}})); location.reload(); 'ok'`);
  await sleep(1600);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) { writeFileSync(join(outDir, `${name}.png`), Buffer.from(s.data, 'base64')); console.log('shot', name); }
}
ws.close(); chrome.kill(); process.exit(0);
