// Regenerates docs/screenshots/*.png with headless Chrome or Edge over the DevTools protocol (Node 22+, no npm packages).
//   1. Serve the repo root:  python -m http.server 8766 --bind 127.0.0.1
//   2. Run:                  node tools/capture-screenshots.mjs
// Options (env vars): BROWSER=/path/to/chrome   GAME_URL=http://127.0.0.1:8766
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'screenshots');
const BASE = process.env.GAME_URL || 'http://127.0.0.1:8766';
const PORT = 9340;
const browser = [process.env.BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean).find((p) => existsSync(p));
if (!browser) { console.error('No Chrome/Edge found. Set BROWSER=/path/to/chrome'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(browser, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'mqr-shots-')), '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try { const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); const page = list.find((t) => t.type === 'page'); if (page) ws = new WebSocket(page.webSocketDebuggerUrl); } catch { /* not up yet */ }
  if (!ws) await sleep(250);
}
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, (m) => (m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result))); ws.send(JSON.stringify({ id, method, params })); });
const run = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
async function shot(name) { const { data } = await send('Page.captureScreenshot', { format: 'png' }); mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, name), Buffer.from(data, 'base64')); console.log('saved docs/screenshots/' + name); }
// Put the player on the ground at a tile column, then let the camera settle.
const stand = (col) => run(`(() => { const G = __mqr.G, L = G.level, p = G.p; let r = 0; while (r < 17 && L.tiles[r * L.cols + ${col}] !== 1) r++; p.x = ${col} * 16 + 8; p.y = r * 16; p.vx = 0; p.vy = 0; G.camX = Math.max(0, p.x - 200); G.inv = 99; G.doubleUnlocked = true; })()`);

try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + '/index.html?debug' }); await sleep(2200);
  await shot('menu.png');
  await run('__mqr.startRun(3)'); await sleep(300); await shot('intro.png');
  await run('__mqr.begin()'); await stand(60); await sleep(800); await shot('sunny-clearing.png');
  await run('__mqr.startLevel(1); __mqr.begin()'); await sleep(200); await stand(70); await sleep(800); await shot('ancient-ruins.png');
  await run('__mqr.startLevel(2); __mqr.begin()'); await sleep(200); await stand(70); await sleep(800); await shot('river-canopy.png');
  await run('__mqr.startRun(5); __mqr.begin()'); await sleep(200);
  await run('(() => { const G = __mqr.G; G.inv = 0; const c = G.level.coins[2]; G.p.x = c.x; G.p.y = c.y + 22; G.p.vx = 0; G.p.vy = 0; })()'); await sleep(500);
  await shot('question.png');
  await run('__mqr.answer(__mqr.G.q.data.answer)'); await run('__mqr.G.q.closeT = 0'); await sleep(200);
  await run('(() => { const G = __mqr.G; G.coins = 9; G.stomps = 7; G.asked = 16; G.right = 15; G.time = 214; __mqr.finishLevel(); })()'); await sleep(400);
  await shot('level-clear.png');
  if (errors.length) { console.error('Page errors:', errors); process.exitCode = 1; }
} finally { ws.close(); proc.kill(); }