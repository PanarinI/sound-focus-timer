// kadr.mjs — кадр стенда для журнала дизайна (15.11): вся страница или один элемент, в безголовом Chrome.
//   node kadr.mjs '<адрес>' <файл.png> [ширина=1280] ['<css-селектор элемента>']
// Масштаб 1 и ширина 1280 — как у прежних кадров `kadry/*--base.png`. Конфетти не мешает: включён
// prefers-reduced-motion (страница сама его уважает). Прежние кадры не перезаписывать — новый вариант = новое имя.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, file, width = '1280', selector] = process.argv.slice(2);
if (!url || !file) { console.log("как: node kadr.mjs '<адрес>' <файл.png> [ширина] ['<селектор>']"); process.exit(2); }
if (existsSync(file)) { console.log(`✗ ${file} уже есть — кадры не перезаписываем, дайте новое имя`); process.exit(1); }
const W = Number(width);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const prof = mkdtempSync(join(tmpdir(), 'welcome-kadr-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--use-mock-keychain',
  '--hide-scrollbars', '--remote-debugging-pipe', `--window-size=${W},900`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
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
const ev = async (sid, expression) => (await send('Runtime.evaluate', { expression, returnByValue: true }, sid)).result.result.value;

try {
  const t = await send('Target.createTarget', { url: 'about:blank' });
  const sid = (await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true })).result.sessionId;
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sid);
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: false }, sid);
  await send('Page.navigate', { url }, sid);
  await sleep(1500);
  const h = await ev(sid, 'document.documentElement.scrollHeight');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: h, deviceScaleFactor: 1, mobile: false }, sid);
  await sleep(400);
  let clip;
  if (selector) {
    clip = await ev(sid, `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null;
      const b = e.getBoundingClientRect(); return { x: b.left, y: b.top + scrollY, width: b.width, height: b.height, scale: 1 }; })()`);
    if (!clip) throw new Error(`нет элемента ${selector}`);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) }, sid);
  writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  console.log(`✓ ${file} · ${clip ? `${Math.round(clip.width)}×${Math.round(clip.height)}` : `${W}×${h}`}`);
} finally {
  ch.kill();
  setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 500);
}
