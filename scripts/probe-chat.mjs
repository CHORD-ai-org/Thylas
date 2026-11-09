#!/usr/bin/env node
/** One-off: load /chat, print console errors and whether the page rendered. */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = join(fileURLToPath(import.meta.url), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(existsSync)[0];

const server = spawn(process.execPath, [join(here, '..', 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5183', '--strictPort'], {
  cwd: join(here, '..'),
  stdio: 'ignore',
});
for (let i = 0; i < 40; i++) {
  try { const r = await fetch('http://localhost:5183/chat'); if (r.ok) break; } catch {}
  await sleep(300);
}

const profile = mkdtempSync(join(tmpdir(), 'chat-probe-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=9228', 'about:blank',
], { stdio: 'ignore' });
await sleep(1200);

const list = await (await fetch('http://localhost:9228/json')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    console.log(`[console.${msg.params.type}]`, text.slice(0, 500));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    console.log('[exception]', msg.params.exceptionDetails.exception?.description?.slice(0, 800) ?? msg.params.exceptionDetails.text);
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error).slice(0, 300))) : resolve(msg.result);
  }
});
const send = (method, params = {}) => {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve) => pending.set(callId, { resolve }));
};
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:5183/chat' });
await sleep(2000);
const jsExpr = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  console.log('[raw]', JSON.stringify(r ?? null).slice(0,300));
  if (r.result?.exceptionDetails) console.log('[eval-error]', JSON.stringify(r.result.exceptionDetails).slice(0,500));
  return r.result?.result?.value;
};
await jsExpr(`
  (async () => {
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'New conversation')?.click();
    await new Promise(r => setTimeout(r, 300));
    const ta = document.querySelector('textarea[aria-label="Message"]');
    const set = Object.getOwnPropertyDescriptor(ta.constructor.prototype, 'value').set;
    set.call(ta, 'What is a boundary? Show an example.');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('button[aria-label="Send"]').click();
    return 1;
  })()
`);
await sleep(500);
console.log('[stream@500ms]', JSON.stringify(await jsExpr(`document.querySelector('[data-chat-stream]')?.innerText.slice(0, 500) ?? null`)));
await sleep(1500);
console.log('[stream@2s]', JSON.stringify(await jsExpr(`document.querySelector('[data-chat-stream]')?.innerText.slice(0, 500) ?? null`)));
const evalRes = await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0, 300)', returnByValue: true, returnByValue: true });
console.log('[eval]', JSON.stringify(evalRes).slice(0, 600));
ws.close();
chrome.kill();
server.kill();
process.exit(0);
