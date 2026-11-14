#!/usr/bin/env node
/** Targeted real-render checks for the Rail + Compute home changes. */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(existsSync)[0];
const profile = mkdtempSync(join(tmpdir(), 'rail-check-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9243', `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
await sleep(1500);
const list = await (await fetch('http://localhost:9243/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { resolve } = pending.get(m.id); pending.delete(m.id); resolve(m.result); }
});
const send = (method, params = {}) => { const callId = ++id; ws.send(JSON.stringify({ id: callId, method, params })); return new Promise((resolve) => pending.set(callId, { resolve })); };
const js = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r?.result?.value;
};
await send('Page.enable');
const goto = async (path_) => { await send('Page.navigate', { url: `http://localhost:5193${path_}` }); await sleep(1500); };
const results = [];
const check = (name, value, expected) => {
  const pass = typeof expected === 'function' ? expected(value) : JSON.stringify(value) === JSON.stringify(expected);
  results.push({ name, pass, value });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} → ${JSON.stringify(value)}`);
};

await goto('/overview');
check('rail: no User item, Chat last, profile button at the bottom', await js(`(() => {
  const items = [...document.querySelectorAll('[data-rail-item]')].map(a => a.textContent.trim()).filter(Boolean);
  return { user: items.includes('User'), last: items.pop(), profile: !!document.querySelector('[data-rail-user]') };
})()`), { user: false, last: 'Chat', profile: true });
check('rail: no visible Collapse sidebar control', await js(`(() => {
  return [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && b.textContent.trim() === 'Collapse sidebar').length;
})()`), 0);
check('rail: logo toggles collapse', await js(`(async () => {
  const brand = document.querySelector('[data-rail-brand]');
  brand.click();
  await new Promise(r => setTimeout(r, 350));
  const collapsed = document.querySelector('[data-rail]').getAttribute('data-rail');
  document.querySelector('[data-rail-brand]').click();
  await new Promise(r => setTimeout(r, 350));
  return { collapsed, restored: document.querySelector('[data-rail]').getAttribute('data-rail') };
})()`), { collapsed: 'collapsed', restored: 'open' });
check('rail: Workspace group collapses and expands', await js(`(async () => {
  const toggle = document.querySelector('[data-ws-section]');
  const before = document.querySelectorAll('[data-ws-row]').length;
  toggle.click(); await new Promise(r => setTimeout(r, 250));
  const folded = document.querySelectorAll('[data-ws-row]').length;
  document.querySelector('[data-ws-section]').click(); await new Promise(r => setTimeout(r, 250));
  return { before, folded, after: document.querySelectorAll('[data-ws-row]').length };
})()`), (v) => v.before >= 2 && v.folded === 0 && v.after === v.before);

await goto('/compute');
check('compute: four reference sections present', await js(`(() => {
  const text = document.body.innerText;
  return ['Running instances','Default destination','Configured','More compute options'].filter(h => text.includes(h));
})()`), (v) => v.length === 4);
check('compute: configured tiles + option tiles + real default select', await js(`(() => {
  const sel = document.querySelector('[data-compute-default]');
  return {
    configured: document.querySelectorAll('[data-configured-card]').length,
    options: document.querySelectorAll('[data-option-card]').length,
    select: sel ? sel.tagName : null,
    value: sel ? sel.value : null,
  };
})()`), (v) => v.configured >= 4 && v.options > 0 && v.select === 'SELECT' && typeof v.value === 'string');

ws.close(); chrome.kill();
console.log(results.every(r => r.pass) ? 'ALL TARGETED CHECKS PASSED' : 'TARGETED CHECKS FAILED');
process.exit(results.every(r => r.pass) ? 0 : 1);
