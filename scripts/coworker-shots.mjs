#!/usr/bin/env node
/** Capture the coworker directory in both modes and all three palettes. */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = join(fileURLToPath(import.meta.url), '..');
const outDir = join(here, '..', 'design', 'reference', 'coworkers');
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = 'http://localhost:5193';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(existsSync)[0];
const profile = mkdtempSync(join(tmpdir(), 'cw-shot-'));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9251', `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
await sleep(1500);
const list = await (await fetch('http://localhost:9251/json/list')).json();
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
const grid = () => evaluate(`(() => { const b = document.querySelector('[aria-label="Grid view"]'); if (b) b.click(); return 'ok'; })()`);
const listBtn = () => evaluate(`(() => { const b = document.querySelector('[aria-label="List view"]'); if (b) b.click(); return 'ok'; })()`);

for (const theme of ['warm', 'dark', 'light']) {
  await send('Page.navigate', { url: `${BASE}/coworkers` });
  await sleep(900);
  await evaluate(`localStorage.setItem('thylas:user:v1', JSON.stringify({version:1, prefs:{theme:'${theme}'}})); 'ok'`);
  await send('Page.reload');
  await sleep(1600);
  await grid();
  await sleep(450);
  await shot(`coworkers-grid-${theme}`);
}

await listBtn();
await sleep(300);
await shot('coworkers-list-warm');

ws.close(); chrome.kill(); process.exit(0);
