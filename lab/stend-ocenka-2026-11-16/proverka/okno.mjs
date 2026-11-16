// okno.mjs — чистое окно Chrome для живого теста автора: просьба об оценке 1.2.3 (16.11).
//
// Отдельный Chrome с пустым профилем (обычный Chrome автора не трогается), в нём дев-сборка 1.2.3. Профиль заранее
// помечен как «летал до 1.2.3» (hearth.flown = 1) — так в одном прогоне видны оба правила автора:
//   1) первое открытие панели новой версии → карточка сразу (кто уже летал);
//   2) «Not now» → следующий рейс, где звук пронёс 5 «минут», — 2-й по счёту → карточка снова, в тихую минуту.
// В панели включается быстрый режим (fast): «минута» = секунда, но рейс не короче 17 с (так устроен движок).
// Флаг --novyj — профиль нового человека (без пометки): карточка только со 2-го рейса.
// Счётчики страниц (GA4, Umami, Clarity) в этом Chrome отрезаны: «What went wrong?» живёт на panarini.github.io.
// Сама дев-сборка в GA4 ничего не шлёт. Окно закрыли — этот Chrome закрывается, профиль стирается.
//
// След — строки лога со временем: панель открыта/закрыта, фаза, рейс засчитан, карточка встала/ушла, ответ.
// Как: node okno.mjs [--novyj] [путь к dist/unpacked-<в>-dev]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const NOVYJ = args.includes('--novyj');
const EXT = resolve(args.find((a) => !a.startsWith('--')) || join(HERE, '../../../dist/unpacked-1.2.3-dev'));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BLOCK = ['www.googletagmanager.com', '*.googletagmanager.com', '*.google-analytics.com', 'analytics.google.com',
  '*.doubleclick.net', '*.umami.is', '*.umami.dev', '*.clarity.ms'].map((h) => `MAP ${h} ~NOTFOUND`).join(', ');
const PHASE = { off: 'покой', 'ручей': 'звук без рейса', 'собирание': 'взлёт', 'ткань': 'рейс', 'ниточка': 'пауза',
  'рассвет': 'рассвет', 'угасание': 'Finish' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => { const d = new Date(); return `${d.toTimeString().slice(0, 8)}.${Math.floor(d.getMilliseconds() / 100)}`; };
const log = (s) => console.log(`${now()}  ${s}`);

const prof = mkdtempSync(join(tmpdir(), 'ocenka-okno-'));
const ch = spawn(CHROME, [`--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
  '--disable-search-engine-choice-screen', '--use-mock-keychain', '--window-size=1280,900',
  `--host-resolver-rules=${BLOCK}`, '--remote-debugging-pipe', '--enable-unsafe-extension-debugging', 'about:blank'],
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
    else if (m.method === 'Target.attachedToTarget') onAttached(m.params);
  }
});

// БЫСТРЫЙ РЕЖИМ — ДО того, как панель прочтёт его. Галочка fast не запоминается: панель, открытая заново посреди
// рейса, без неё вернула бы рассвету 40 с, и короткий тестовый рейс сразу ушёл бы в рассвет. Поэтому каждый новый
// документ панели перехватывается на старте (auto-attach), и галочка ставится, как только появляется в разметке.
const FAST = `(() => {
  if (!location.pathname.endsWith('/hearth.html')) return;
  const set = () => { const f = document.getElementById('fast'); if (!f) return false; f.checked = true; return true; };
  if (set()) return;
  const mo = new MutationObserver(() => { if (set()) mo.disconnect(); });
  mo.observe(document, { childList: true, subtree: true });
})();`;
async function onAttached(p) {
  const sid = p.sessionId;
  try {
    if (['page', 'other', 'iframe'].includes(p.targetInfo.type)) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: FAST }, sid, 2000);
    }
  } catch (e) { /* не страница — пропускаем */ }
  if (p.waitingForDebugger) await send('Runtime.runIfWaitingForDebugger', {}, sid, 2000);
}
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
  setTimeout(cleanup, 4000);
};
process.on('SIGINT', () => stop('остановлено'));
process.on('SIGTERM', () => stop('остановлено'));

const HELLO = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><meta charset="utf-8">
<title>Тест оценки</title><body style="font:20px/1.5 -apple-system,sans-serif;max-width:640px;margin:80px auto;color:#222">
<h2 style="font-weight:600">Тест просьбы об оценке · 1.2.3-dev</h2>
<p>Откройте панель: значок Brown Noise Generator на панели браузера (или под пазлом).</p>
<p>${NOVYJ ? 'Профиль нового человека: карточка — только со 2-го рейса.'
    : 'Профиль помечен «летал до 1.2.3»: карточка должна встать при первом открытии.'}</p>
<p>Быстрый режим: «минута» — секунда, рейс не короче 17 секунд.</p></body>`);

async function main() {
  const v = await send('Browser.getVersion', {}, undefined, 30000);
  if (!v.result) return stop(`сбой: Chrome не ответил (${v.error && v.error.message})`, 1);
  const ld = await send('Extensions.loadUnpacked', { path: EXT }, undefined, 15000);
  const id = ld.result && ld.result.id;
  if (!id) return stop(`сбой: дев-сборка не встала (${JSON.stringify(ld.error)})`, 1);
  log(`окно открыто · ${v.result.product} · дев-сборка ${EXT.split('/').pop()} · ${NOVYJ ? 'новый человек' : 'летал до 1.2.3'}`);
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });

  if (!NOVYJ) {                                     // пометка «летал» — до первого открытия панели
    const t = await send('Target.createTarget', { url: `chrome-extension://${id}/_locales/en/messages.json`, background: true });
    const s = (await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true })).result.sessionId;
    await sleep(500);
    await ev(s, `localStorage.setItem('hearth.flown', '1'); localStorage.setItem('hearth.opened', '1'); true`);
    await send('Target.closeTarget', { targetId: t.result.targetId });
  }

  let tab;
  for (let i = 0; i < 25 && !tab; i++) {
    const r = await send('Target.getTargets');
    tab = ((r.result && r.result.targetInfos) || []).find((x) => x.type === 'page' && x.url === 'about:blank');
    if (!tab) await sleep(200);
  }
  if (tab) {
    const ps = (await send('Target.attachToTarget', { targetId: tab.targetId, flatten: true })).result.sessionId;
    await send('Page.navigate', { url: HELLO }, ps);
    await send('Page.bringToFront', {}, ps);
  }

  const tabsCount = async () => {
    const r = await send('Target.getTargets', { filter: [{ type: 'tab' }] });
    return r.result ? r.result.targetInfos.filter((x) => x.type === 'tab').length : -1;
  };
  const watchTabs = (await tabsCount()) > 0;

  let sw = null;
  const rate = async () => {
    if (!sw) {
      const r = await send('Target.getTargets');
      const w = ((r.result && r.result.targetInfos) || [])
        .find((x) => x.type === 'service_worker' && x.url.startsWith(`chrome-extension://${id}/`));
      if (!w) return undefined;
      const a = await send('Target.attachToTarget', { targetId: w.targetId, flatten: true });
      if (!a.result) return undefined;
      sw = a.result.sessionId;
    }
    const r = await ev(sw, `new Promise((res) => chrome.storage.local.get('rate', (o) => res(JSON.stringify(o.rate || null))))`);
    if (r === undefined) sw = null;
    return r;
  };

  let panel = null, panelTarget = null, st = {}, lastRate, ready = false;
  console.log('ГОТОВО — окно ждёт автора');
  for (let tick = 0; ; tick++) {
    // панель: новый документ — подключиться и включить fast
    const r = await send('Target.getTargets');
    const pt = ((r.result && r.result.targetInfos) || []).find((x) => x.url === `chrome-extension://${id}/hearth.html`);
    if (pt && pt.targetId !== panelTarget) {
      const a = await send('Target.attachToTarget', { targetId: pt.targetId, flatten: true });
      if (a.result) {
        panel = a.result.sessionId; panelTarget = pt.targetId; st = {};
        await sleep(300);
        // страховка: если перехват на старте не сработал — включить сейчас (DAWN вернётся к 4 с со следующего тика)
        const was = await ev(panel, `(() => { const w = el.fast.checked; if (!w) { el.fast.checked = true; el.fast.dispatchEvent(new Event('change')); } return w; })()`);
        log(`панель открыта · быстрый режим ${was ? 'включён на старте' : 'включён после старта (перехват не успел)'}`);
      }
    } else if (!pt && panelTarget) {
      log('панель закрыта'); panel = null; panelTarget = null; st = {};
    }
    if (panel) {
      const s = await ev(panel, `JSON.stringify({ p: engine.phase, up: askUp, inf: infinite })`);
      if (s) {
        const n = JSON.parse(s);
        if (n.p !== st.p) log(`фаза: ${PHASE[n.p] || n.p}${n.inf && ['собирание'].includes(n.p) ? ' · ∞' : ''}`);
        if (n.up !== st.up && st.up !== undefined || (n.up && st.up === undefined)) {
          log(n.up ? `КАРТОЧКА встала (${PHASE[n.p] || n.p})` : 'карточка убрана');
        }
        st = n;
      }
    }
    const rr = await rate();
    if (rr !== undefined && rr !== lastRate) {
      const a = lastRate ? JSON.parse(lastRate) : null, b = JSON.parse(rr);
      if (b && (!a || b.flights !== a.flights)) log(`рейс засчитан — по счёту ${b.flights}`);
      if (b && a && b.pending && !a.pending) log('просьба ждёт тихой минуты');
      if (b && a && b.rated && !a.rated) log('оценка поставлена — просьба закрыта навсегда');
      if (b && a && !b.pending && a.pending && !b.rated) log('«не сейчас» — до следующего засчитанного рейса');
      if (!a && b) log(`перенос: ${b.pending ? 'летал до 1.2.3 → просьба ждёт' : 'не летал → просьбы нет'}`);
      lastRate = rr;
    }
    if (watchTabs && tick % 5 === 4 && (await tabsCount()) === 0) {
      await send('Browser.close', {}, undefined, 3000);
      return stop('окно закрыто');
    }
    if (!ready) ready = true;
    await sleep(250);
  }
}
main().catch((e) => stop(`сбой: ${e.message}`, 1));
