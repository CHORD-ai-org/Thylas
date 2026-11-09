#!/usr/bin/env node
/** One-off: screenshots of the User and Connect surfaces, via the e2e harness
 *  conventions (own dev server on 5180, real Chrome). */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:5181';
const here = join(fileURLToPath(import.meta.url), '..');
const outDir = join(here, '..', '.workbuddy', 'shots');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(existsSync)[0];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, [join(here, '..', 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5181', '--strictPort'], {
  cwd: join(here, '..'),
  stdio: 'ignore',
});

async function up() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/overview`, { signal: AbortSignal.timeout(800) });
      if (res.ok) return;
    } catch {}
    await sleep(300);
  }
  throw new Error('dev server did not come up');
}

/** Minimal CDP client. */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function main() {
  await up();
  // Launch chrome headless with a temp profile and a tab
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const profile = mkdtempSync(join(tmpdir(), 'thylas-shots-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=9227',
    '--no-first-run',
    '--window-size=1440,1000',
    'about:blank',
  ], { stdio: 'ignore' });
  await sleep(1200);

  const list = await (await fetch('http://localhost:9227/json')).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  const shots = [
    ['compute-overview', '/compute'],
    ['compute-backends', '/compute/backends'],
    ['compute-backend-detail', '/compute/backends/b-slurm'],
    ['compute-run', '/compute/run'],
    ['compute-run-results', '/compute/run'],
    ['compute-instances', '/compute/instances'],
    ['compute-instance-detail', '/compute/instances/r-aws-h100'],
    ['compute-activity', '/compute/activity'],
    ['compute-marketplace', '/compute/marketplace'],
  ];

  for (const [name, path] of shots) {
    await cdp.send('Page.navigate', { url: BASE + path });
    await sleep(900);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(shot.data, 'base64'));
    console.log('shot', name);
  }

  ws.close();
  chrome.kill();
  server.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  server.kill();
  process.exit(1);
});
