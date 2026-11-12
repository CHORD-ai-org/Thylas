#!/usr/bin/env node
/** Capture the Thylas chat page in landing + conversation states (GPT-style sample). */
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
const profile = mkdtempSync(join(tmpdir(), 'thylas-shot-'));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9238', `--user-data-dir=${profile}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });
await sleep(1500);

const list = await (await fetch('http://localhost:9238/json')).json();
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
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });

const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) { writeFileSync(join(outDir, `${name}.png`), Buffer.from(s.data, 'base64')); console.log('shot', name); }
};

await send('Page.navigate', { url: 'http://localhost:5190/chat' });
await sleep(2500);
await send('Runtime.evaluate', { expression: "localStorage.removeItem('thylas:chat:v1'); location.reload(); 'ok'" });
await sleep(2200);
await send('Runtime.evaluate', { expression: `(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('New conversation'));
  if (btn) btn.click();
  return 'clicked';
})()`, returnByValue: true });
await sleep(500);
await shot('thylas-chat-landing');

await send('Runtime.evaluate', { expression: `(() => {
  const ta = document.querySelector('textarea[aria-label="Message"]');
  if (!ta) return 'no composer';
  const set = Object.getOwnPropertyDescriptor(ta.constructor.prototype, 'value').set;
  set.call(ta, 'What is a boundary? Show an example.');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()`, returnByValue: true });
await sleep(300);
await send('Runtime.evaluate', { expression: `(() => { const b = document.querySelector('button[aria-label="Send"]'); if (b) b.click(); return 'sent'; })()`, returnByValue: true });
await sleep(2500);
await shot('thylas-chat-conversation');

ws.close();
chrome.kill();
process.exit(0);
