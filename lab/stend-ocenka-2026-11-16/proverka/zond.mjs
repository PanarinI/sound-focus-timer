// zond.mjs — зонд дома звука (16.11): что из chrome.* видно в offscreen-документе.
//
// Зачем: за 60 дней в GA4 ни одного `flight_end` с `how=arrived|finished`, хотя дом звука их шлёт
// (offscreen.js → track). track.js молчит, если считает сборку дев-сборкой, а узнаёт он это через
// chrome.runtime.getManifest(); client_id берёт из chrome.storage. Зонд спрашивает сам документ.
//
// Как: node zond.mjs [путь к dist/unpacked-<в>-dev]   (по умолчанию — 1.2.2-dev, то есть код, что у людей)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(process.argv[2] || join(HERE, '../../../dist/unpacked-1.2.2-dev'));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const prof = mkdtempSync(join(tmpdir(), 'ocenka-zond-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--use-mock-keychain',
  '--autoplay-policy=no-user-gesture-required', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
  'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const out = ch.stdio[3], inp = ch.stdio[4];
inp.setEncoding('utf8');
let buf = '', seq = 0; const waiting = new Map();
inp.on('data', (d) => {
  buf += d; let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  }
});
const send = (method, params = {}, sessionId) => new Promise((r) => {
  const id = ++seq; waiting.set(id, r);
  out.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
});
const ev = async (sid, expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid);
  return r.result && r.result.result ? r.result.result.value : r;
};

try {
  await sleep(1000);
  const id = (await send('Extensions.loadUnpacked', { path: EXT })).result.id;
  console.log('сборка:', EXT.split('/').pop(), '· id', id);
  const t = await send('Target.createTarget', { url: `chrome-extension://${id}/hearth.html` });
  await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
  let off = null;
  for (let i = 0; i < 40 && !off; i++) {            // панель сама поднимает дом звука (engine.sync → ensureOffscreen)
    await sleep(250);
    const all = (await send('Target.getTargets')).result.targetInfos;
    off = all.find((x) => x.url.includes('/offscreen.html'));
  }
  if (!off) throw new Error('дом звука не поднялся');
  const sid = (await send('Target.attachToTarget', { targetId: off.targetId, flatten: true })).result.sessionId;
  const r = await ev(sid, `(() => {
    const o = {};
    o.runtime = typeof chrome.runtime;
    o.getManifest = typeof (chrome.runtime && chrome.runtime.getManifest);
    try { o.version_name = chrome.runtime.getManifest().version_name || '(нет)'; } catch (e) { o.version_name = 'ОШИБКА: ' + e.message; }
    o.storage = typeof chrome.storage;
    o.localStorage = (() => { try { localStorage.setItem('zond', '1'); return 'есть'; } catch (e) { return 'нет: ' + e.message; } })();
    o.fetch = typeof fetch;
    o.track = typeof track;
    o.chromeKeys = Object.keys(chrome).sort().join(' ');
    return o;
  })()`);
  console.log('дом звука (offscreen.html):');
  for (const [k, v] of Object.entries(r)) console.log(`  ${k}: ${v}`);
} finally {
  ch.kill();
  setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 500);
}
