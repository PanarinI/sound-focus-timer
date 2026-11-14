// proverka.mjs — проверка welcome в двух режимах в настоящем Chrome (14.11).
//
// Зачем: режим страницы выбирается живым ответом расширения, а в панели предпросмотра расширения нет. Здесь Chrome
// поднимается безголовым, управляется по CDP через pipe и — главное — в него ставится НАСТОЯЩАЯ дев-сборка:
// Chrome 137+ не грузит расширения флагом --load-extension, но умеет Extensions.loadUnpacked
// (нужны --remote-debugging-pipe и --enable-unsafe-extension-debugging).
// Закрепить/открепить значок из CDP нельзя, поэтому вторая половина проверок подменяет ответ расширения
// (chrome.runtime.sendMessage) скриптом, который встаёт до кода страницы, — и «закрепляет» его по команде.
// Щелчки — настоящие события мыши (Input.dispatchMouseEvent), а не element.click().
//
// Как: стенд должен отдаваться сервером ember-lab (lab/ на :8783), дев-сборка — собрана.
//   node proverka.mjs [путь к dist/unpacked-<в>-dev]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(process.argv[2] || join(HERE, '../../../dist/unpacked-1.2.2-dev'));
const BASE = 'http://localhost:8783/stend-welcome-2026-11-14/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── подмена ответа расширения: встаёт раньше кода страницы ──
const STUB = `
  window.__pin = false; window.__gone = false; window.__calls = 0;
  window.chrome = window.chrome || {};
  window.chrome.runtime = {
    lastError: undefined,
    sendMessage: function (id, msg, cb) {
      window.__calls++;
      setTimeout(function () {
        if (window.__gone) {
          window.chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
          cb(undefined); window.chrome.runtime.lastError = undefined; return;
        }
        cb({ isOnToolbar: !!window.__pin });
      }, 15);
    }
  };`;

function startChrome() {
  const prof = mkdtempSync(join(tmpdir(), 'welcome-proverka-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--use-mock-keychain',
    '--remote-debugging-pipe', '--enable-unsafe-extension-debugging', '--window-size=1280,900', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const out = ch.stdio[3], inp = ch.stdio[4];
  let buf = '', seq = 0; const waiting = new Map();
  inp.on('data', (d) => {
    buf += d.toString(); let i;
    while ((i = buf.indexOf('\0')) >= 0) {
      const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((r) => {
    const id = ++seq; waiting.set(id, r);
    out.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });
  const stop = () => { ch.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch (e) {} };
  return { send, stop };
}

async function openPage(c, url, { stub = false, gone = false } = {}) {
  const t = await c.send('Target.createTarget', { url: 'about:blank' });
  const sid = (await c.send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true })).result.sessionId;
  await c.send('Page.enable', {}, sid);
  // gone — расширение «есть», но не отвечает с первого вопроса (отключено, старая версия)
  if (stub) await c.send('Page.addScriptToEvaluateOnNewDocument',
    { source: gone ? STUB.replace('window.__gone = false', 'window.__gone = true') : STUB }, sid);
  await c.send('Page.navigate', { url }, sid);
  await sleep(250);
  const ev = async (expression) => {
    const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid);
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const mode = () => ev('document.body && document.body.dataset.mode');
  // через сколько мс режим станет нужным (или null, если не стал за limit)
  const waitMode = async (want, limit = 2500) => {
    const t0 = Date.now();
    while (Date.now() - t0 < limit) { if ((await mode()) === want) return Date.now() - t0; await sleep(50); }
    return null;
  };
  // настоящий щелчок мышью по ссылке-переключателю видимого режима
  const clickSwitch = async () => {
    const box = await ev(`(() => { const a = [...document.querySelectorAll('[data-switch]')].find(x => x.offsetParent);
      a.scrollIntoView({ block: 'center' }); const b = a.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    await sleep(100);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await c.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 }, sid);
    await sleep(150);
  };
  return { ev, mode, waitMode, clickSwitch, close: () => c.send('Target.closeTarget', { targetId: t.result.targetId }) };
}

const results = [];
const check = (name, ok, detail = '') => { results.push([ok, name, detail]); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

const c = startChrome();
try {
  await sleep(1200);

  // ── 1. НАСТОЯЩАЯ дев-сборка: страница спрашивает расширение и слушается ответа ──
  const ld = await c.send('Extensions.loadUnpacked', { path: EXT });
  const id = ld.result && ld.result.id;
  check('дев-сборка поставлена в Chrome', !!id, id || JSON.stringify(ld.error));
  if (id) {
    const p = await openPage(c, `${BASE}?pinned=0&id=${id}`);
    const answer = await p.ev(`new Promise((r) => chrome.runtime.sendMessage('${id}', { type: 'getPinState' }, (x) => r(x)))`);
    check('расширение отвечает странице с localhost', answer && typeof answer.isOnToolbar === 'boolean', JSON.stringify(answer));
    const want = answer && answer.isOnToolbar ? 'usage' : 'pin';
    const ms = await p.waitMode(want, 2500);
    check(`?pinned=0, а живой ответ ${JSON.stringify(answer)} → «${want}»`, ms !== null, ms !== null ? `за ${ms} мс` : 'не переключилась');
    await p.close();

    const q = await openPage(c, `${BASE}?pinned=0&id=${id}#pin`);
    await sleep(2200);
    check('#pin при живом ответе: выбор человека сильнее', (await q.mode()) === 'pin');
    await q.close();

    const w = await openPage(c, `${BASE}?pinned=1`);           // id не передан — страница берёт id стора
    await sleep(2200);
    check('без ?id (id стора, такого расширения тут нет) → остаётся подсказка ?pinned=1', (await w.mode()) === 'usage');
    await w.close();
  }

  // ── 2. Подмена ответа: «закрепить» и «открепить» по команде ──
  const s = await openPage(c, `${BASE}?pinned=1`, { stub: true });
  let ms = await s.waitMode('pin', 2500);
  check('подсказка ?pinned=1, живой ответ «не закреплено» → «pin»', ms !== null, ms !== null ? `за ${ms} мс` : '');
  await s.ev('window.__pin = true');
  ms = await s.waitMode('usage', 2500);
  check('закрепили → «usage»', ms !== null && ms <= 1700, ms !== null ? `за ${ms} мс` : 'не переключилась');
  await s.ev('window.__pin = false');
  ms = await s.waitMode('pin', 2500);
  check('открепили → «pin»', ms !== null && ms <= 1700, ms !== null ? `за ${ms} мс` : 'не переключилась');
  const calls1 = await s.ev('window.__calls');
  await sleep(3100);
  const calls2 = await s.ev('window.__calls');
  check('опрос раз в 1,5 с, пока страница видна', calls2 - calls1 >= 2 && calls2 - calls1 <= 3, `${calls2 - calls1} вопроса за 3,1 с`);

  await s.clickSwitch();                                      // «Already pinned? See how to use it»
  check('щелчок по переключателю → «usage» и #usage', (await s.mode()) === 'usage' && (await s.ev('location.hash')) === '#usage');
  const calls3 = await s.ev('window.__calls');
  await s.ev('window.__pin = false');
  await sleep(3200);
  check('после ручного выбора автоматика молчит', (await s.mode()) === 'usage' && (await s.ev('window.__calls')) === calls3,
    `вопросов после щелчка: ${(await s.ev('window.__calls')) - calls3}`);
  await s.close();

  const g = await openPage(c, `${BASE}?pinned=1`, { stub: true, gone: true });
  await sleep(3400);
  const g1 = await g.ev('window.__calls');
  check('расширение не отвечает (lastError) → один вопрос, опрос остановлен, режим по подсказке',
    g1 === 1 && (await g.mode()) === 'usage', `вопросов за 3,6 с: ${g1}`);
  await g.close();

  const n = await openPage(c, `${BASE}?pinned=0`);           // без расширения и без подмены — как в Safari
  await sleep(1800);
  check('chrome.runtime нет → подсказка ?pinned=0 → «pin», ошибок нет', (await n.mode()) === 'pin');
  await n.close();
} finally {
  c.stop();
}
const bad = results.filter((r) => !r[0]).length;
console.log(bad ? `\n✗ не прошло: ${bad} из ${results.length}` : `\n✓ всё прошло: ${results.length} проверок`);
process.exit(bad ? 1 : 0);
