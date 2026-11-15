#!/usr/bin/env node
/** Capture the sign-in page: three palettes, a narrow width, and a dragged sheet. */
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
const profile = mkdtempSync(join(tmpdir(), 'login-shot-'));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9248', `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
await sleep(1500);
const list = await (await fetch('http://localhost:9248/json/list')).json();
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

for (const theme of ['warm', 'dark', 'light']) {
  await send('Page.navigate', { url: `${BASE}/login` });
  await sleep(900);
  await evaluate(`localStorage.setItem('thylas:user:v1', JSON.stringify({version:1, prefs:{theme:'${theme}'}})); localStorage.removeItem('thylas:login-sheet:v1'); 'ok'`);
  await send('Page.reload');
  await sleep(1600);
  await shot(`login-${theme}`);
}

await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${BASE}/login` });
await sleep(1600);
await shot('login-860');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

await send('Page.navigate', { url: `${BASE}/login` });
await sleep(1400);
await evaluate(`(() => { const g = document.querySelector('[data-sheet-grip]'); const r = g.getBoundingClientRect(); g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x + 40, clientY: r.y + 20, button: 0 })); window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.x + 160, clientY: r.y + 150 })); window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); return document.querySelector('[data-login-sheet]').style.left; })()`);
await sleep(400);
await shot('login-dragged');

ws.close(); chrome.kill(); process.exit(0);
