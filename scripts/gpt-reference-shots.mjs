#!/usr/bin/env node
/** Capture Thylas compute pages for review. */
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
const profile = mkdtempSync(join(tmpdir(), 'compute-shot-'));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9239', `--user-data-dir=${profile}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });
await sleep(1500);

const list = await (await fetch('http://localhost:9239/json')).json();
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
await send('Runtime.enable');
let errors = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Runtime.exceptionThrown') errors.push(String(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).slice(0, 400));
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400));
});

for (const [name, path, settle] of [
  ['compute-after', '/compute', 3000],
]) {
  await send('Page.navigate', { url: `http://localhost:5190${path}` });
  await sleep(settle);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) { writeFileSync(join(outDir, `${name}.png`), Buffer.from(s.data, 'base64')); console.log('shot', name); }
}

console.log('ERRORS:', JSON.stringify(errors));
ws.close();
chrome.kill();
process.exit(0);
