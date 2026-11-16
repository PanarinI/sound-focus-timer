// okno.mjs — чистое окно Chrome для живого теста автора: закрепить / открепить значок → welcome меняет режим (15.11).
//
// Зачем: в обычном Chrome автора — стор-копия и прошлые дев-сборки (несколько одинаковых значков, следы тестов).
// Здесь поднимается ОТДЕЛЬНЫЙ Chrome с новым пустым профилем (обычный Chrome автора не трогается), в него ставится
// дев-сборка и открывается стенд welcome. Chrome 137+ не грузит расширения флагом --load-extension, поэтому, как в
// proverka.mjs, — Extensions.loadUnpacked по CDP через pipe (нужен --enable-unsafe-extension-debugging).
// Pipe держит этот процесс: пока он жив, окно живо. Окно закрыли — этот Chrome закрывается, профиль стирается.
//
// След теста — строки лога со временем: значок на панели / под пазлом (спрашиваем сам service worker расширения),
// режим страницы и через сколько секунд он догнал значок, щелчки по ссылке внизу (#pin / #usage).
//
// Как: стенд — сервер ember-lab (lab/ на :8783), дев-сборка собрана (bash lab/build-zip.sh dev).
//   node okno.mjs [путь к dist/unpacked-<в>-dev]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(process.argv[2] || join(HERE, '../../../dist/unpacked-1.2.2-dev'));
const BASE = 'http://localhost:8783/stend-welcome-2026-11-14/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MODE = { pin: '«pin» (как закрепить)', usage: '«usage» (как пользоваться)' };
const WAIT_SWITCH_MS = 3000;   // страница обязана догнать значок за это время (опрос раз в 1,5 с)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => { const d = new Date(); return `${d.toTimeString().slice(0, 8)}.${Math.floor(d.getMilliseconds() / 100)}`; };
const log = (s) => console.log(`${now()}  ${s}`);

// ── отдельный Chrome с пустым профилем ──
const prof = mkdtempSync(join(tmpdir(), 'welcome-okno-'));
const ch = spawn(CHROME, [`--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
  '--disable-search-engine-choice-screen', '--use-mock-keychain', '--window-size=1280,900',
  '--remote-debugging-pipe', '--enable-unsafe-extension-debugging', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const out = ch.stdio[3], inp = ch.stdio[4];
out.on('error', () => {});
inp.setEncoding('utf8');
let buf = '', seq = 0; const waiting = new Map();
inp.on('data', (d) => {
  buf += d; let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (m.id && waiting.has(m.id)) waiting.get(m.id)(m);
  }
});
const send = (method, params = {}, sessionId, ms = 5000) => new Promise((r) => {
  const id = ++seq;
  const timer = setTimeout(() => { waiting.delete(id); r({ error: { message: `нет ответа ${ms / 1000} с` } }); }, ms);
  waiting.set(id, (m) => { clearTimeout(timer); waiting.delete(id); r(m); });
  out.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
});
const ev = async (sid, expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid);
  return r.result && r.result.result && !r.result.exceptionDetails ? r.result.result.value : undefined;
};

// ── конец: этот Chrome закрыт → временный профиль стирается ──
let reason = 'этот Chrome закрыт', exitCode = 0, cleaned = false;
const cleanup = () => {
  if (cleaned) return; cleaned = true;
  try { rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  log(`конец: ${reason} · временный профиль стёрт`);
  process.exit(exitCode);
};
ch.on('exit', cleanup);
const stop = (why, code = 0) => {
  reason = why; exitCode = code;
  try { ch.kill(); } catch (e) {}
  setTimeout(cleanup, 4000);                     // Chrome не вышел сам — всё равно прибираем
};
process.on('SIGINT', () => stop('остановлено'));
process.on('SIGTERM', () => stop('остановлено'));

async function main() {
  const v = await send('Browser.getVersion', {}, undefined, 30000);
  if (!v.result) return stop(`сбой: Chrome не ответил (${v.error && v.error.message})`, 1);
  const ld = await send('Extensions.loadUnpacked', { path: EXT }, undefined, 15000);
  const id = ld.result && ld.result.id;
  if (!id) return stop(`сбой: дев-сборка не встала (${JSON.stringify(ld.error)})`, 1);
  log(`окно открыто · ${v.result.product} · pid ${ch.pid} · дев-сборка ${id}`);

  // стенд — в ту вкладку, что открылась вместе с окном
  let tab;
  for (let i = 0; i < 25 && !tab; i++) {
    const r = await send('Target.getTargets');
    tab = ((r.result && r.result.targetInfos) || []).find((x) => x.type === 'page' && x.url === 'about:blank');
    if (!tab) await sleep(200);
  }
  const targetId = tab ? tab.targetId : (await send('Target.createTarget', { url: 'about:blank' })).result.targetId;
  const ps = (await send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
  const url = `${BASE}?id=${id}`;
  await send('Page.navigate', { url }, ps);
  await send('Page.bringToFront', {}, ps);
  log(`стенд: ${url}`);
  await sleep(1200);   // первый ответ расширения приходит за доли секунды — на старте режим уже не «по умолчанию»

  // окно закрыто ⇔ вкладок не осталось (панель и фоновые страницы расширения — не вкладки)
  const tabsCount = async () => {
    const r = await send('Target.getTargets', { filter: [{ type: 'tab' }] });
    return r.result ? r.result.targetInfos.filter((x) => x.type === 'tab').length : -1;
  };
  const watchTabs = (await tabsCount()) > 0;     // Chrome не знает фильтра — тогда этот Chrome закрывают через Cmd+Q

  // значок на панели? — спрашиваем сам service worker расширения
  let sw = null;
  const pinned = async () => {
    if (!sw) {
      const r = await send('Target.getTargets');
      const w = ((r.result && r.result.targetInfos) || [])
        .find((x) => x.type === 'service_worker' && x.url.startsWith(`chrome-extension://${id}/`));
      if (!w) return undefined;
      const a = await send('Target.attachToTarget', { targetId: w.targetId, flatten: true });
      if (!a.result) return undefined;
      sw = a.result.sessionId;
    }
    const p = await ev(sw, 'chrome.action.getUserSettings().then((s) => s.isOnToolbar)');
    if (p === undefined) sw = null;              // воркер перезапустился — найдём заново
    return p;
  };

  let pin, mode, hash, want = null, pinAt = 0, ready = false;
  for (let tick = 0; ; tick++) {
    const p = await pinned();
    if (p !== undefined && p !== pin) {
      if (pin !== undefined) {
        log(p ? 'значок ЗАКРЕПЛЁН на панели' : 'значок СНЯТ с панели (ушёл под пазл)');
        want = p ? 'usage' : 'pin';
        if (mode === want) want = null; else pinAt = Date.now();
      }
      pin = p;
    }
    const s = await ev(ps, `document.body && document.body.dataset.mode ? document.body.dataset.mode + '|' + location.hash : ''`);
    if (s) {
      const [m, h] = s.split('|');
      if (hash !== undefined && h !== hash && h) log(`щелчок по ссылке внизу → ${h} · дальше страница сама не переключается (так задумано)`);
      hash = h;
      if (m !== mode) {
        if (mode === undefined) log(`старт: значок ${pin === undefined ? '— ?' : pin ? 'на панели' : 'под пазлом'} · страница ${MODE[m] || m}`);
        else log(`страница → ${MODE[m] || m}${want && m === want ? ` · через ${((Date.now() - pinAt) / 1000).toFixed(1)} с после значка` : ''}`);
        mode = m;
        if (m === want) { want = null; pinAt = 0; }
      }
      if (!ready) { ready = true; console.log('ГОТОВО — окно ждёт автора'); }
    }
    if (want && Date.now() - pinAt > WAIT_SWITCH_MS) {
      log(`страница НЕ догнала значок за ${WAIT_SWITCH_MS / 1000} с${hash ? ' — после щелчка по ссылке так и задумано' : ' — ✗ не так'}`);
      want = null; pinAt = 0;
    }
    if (watchTabs && tick % 5 === 4 && (await tabsCount()) === 0) {
      await send('Browser.close', {}, undefined, 3000);
      return stop('окно закрыто');
    }
    await sleep(200);
  }
}
main().catch((e) => stop(`сбой: ${e.message}`, 1));
