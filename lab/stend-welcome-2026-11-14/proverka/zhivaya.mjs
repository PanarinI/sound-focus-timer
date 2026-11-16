// zhivaya.mjs — проверка ОПУБЛИКОВАННОЙ welcome (15.11): живой адрес panarini.github.io + настоящая дев-сборка.
//
// Зачем: стенд на localhost доказывает код, а здесь — то, что увидят люди: страница с GitHub Pages, расширение
// отвечает именно этому адресу (externally_connectable в дев- и прод-сборке одинаково пускает focus-pages).
// Счётчики (GA4, Umami, Clarity) в этом Chrome отрезаны на уровне DNS (--host-resolver-rules): живая страница
// включает их на panarini.github.io, и без отреза каждый прогон падал бы в счёт установок. Отрез проверяется:
// ни один запрос к ним не должен получить ответа.
//
// Как: node zhivaya.mjs [путь к dist/unpacked-<в>-dev]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(process.argv[2] || join(HERE, '../../../dist/unpacked-1.2.2-dev'));
const LIVE = 'https://panarini.github.io/focus-pages/welcome/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const COUNTERS = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|umami\.(is|dev)|clarity\.ms/;
const BLOCK = ['www.googletagmanager.com', '*.googletagmanager.com', '*.google-analytics.com', 'analytics.google.com',
  '*.doubleclick.net', '*.umami.is', '*.umami.dev', '*.clarity.ms'].map((h) => `MAP ${h} ~NOTFOUND`).join(', ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const prof = mkdtempSync(join(tmpdir(), 'welcome-zhivaya-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--use-mock-keychain',
  `--host-resolver-rules=${BLOCK}`, '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
  '--window-size=1280,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const out = ch.stdio[3], inp = ch.stdio[4];
inp.setEncoding('utf8');
let buf = '', seq = 0; const waiting = new Map();
const counterHits = [];                                  // счётчик, до которого дошёл ответ (должно быть пусто)
const counterTries = new Set();                          // счётчики, к которым страница пыталась обратиться
inp.on('data', (d) => {
  buf += d; let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); continue; }
    if (m.method === 'Network.requestWillBeSent' && COUNTERS.test(m.params.request.url)) counterTries.add(new URL(m.params.request.url).host);
    if (m.method === 'Network.responseReceived' && COUNTERS.test(m.params.response.url)) counterHits.push(m.params.response.url);
  }
});
const send = (method, params = {}, sessionId) => new Promise((r) => {
  const id = ++seq; waiting.set(id, r);
  out.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
});

async function openPage(url) {
  const t = await send('Target.createTarget', { url: 'about:blank' });
  const sid = (await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true })).result.sessionId;
  await send('Network.enable', {}, sid);
  await send('Page.navigate', { url }, sid);
  await sleep(300);
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid);
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const mode = () => ev('document.body && document.body.dataset.mode');
  const waitMode = async (want, limit = 3000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < limit) { if ((await mode()) === want) return Date.now() - t0; await sleep(50); }
    return null;
  };
  return { ev, mode, waitMode, close: () => send('Target.closeTarget', { targetId: t.result.targetId }) };
}

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const v = `v=${Date.now()}`;                             // мимо кэша Pages
try {
  await sleep(1200);
  const ld = await send('Extensions.loadUnpacked', { path: EXT });
  const id = ld.result && ld.result.id;
  check('дев-сборка поставлена', !!id, id || JSON.stringify(ld.error));

  const a = await openPage(`${LIVE}?id=${id}&${v}`);
  const answer = await a.ev(`new Promise((r) => chrome.runtime.sendMessage('${id}', { type: 'getPinState' }, (x) => r(x)))`);
  check('расширение отвечает живому адресу', answer && typeof answer.isOnToolbar === 'boolean', JSON.stringify(answer));
  const want = answer && answer.isOnToolbar ? 'usage' : 'pin';
  const ms = await a.waitMode(want);
  check(`живой ответ ${JSON.stringify(answer)} → «${want}»`, ms !== null, ms !== null ? `за ${ms} мс` : 'не переключилась');
  const imgs = await a.ev(`Promise.all([...new Set([...document.querySelectorAll('image')].map(i => i.getAttribute('href')))]
    .map(async h => h + ' ' + (await fetch(h, { cache: 'no-store' })).status))`);
  check('снимки панели на месте', Array.isArray(imgs) && imgs.every((s) => s.endsWith(' 200')), (imgs || []).join(' · '));
  const live = await a.ev('typeof LIVE !== "undefined" && LIVE');
  check('на живом адресе счётчики включены (LIVE)', live === true);
  await a.close();

  const b = await openPage(`${LIVE}?id=${id}&${v}#pin`);
  await sleep(2200);
  check('#pin при живом ответе: выбор человека сильнее', (await b.mode()) === 'pin');
  await b.close();

  const c = await openPage(`${LIVE}?${v}`);               // как у старых версий: ни ?pinned, ни ?id
  await sleep(2200);
  check('старая версия (без подсказки и id) → «pin», как раньше', (await c.mode()) === 'pin');
  await c.close();

  await sleep(500);
  check('ни один счётчик не получил ответа (отрезаны)', counterHits.length === 0,
    `пытались: ${[...counterTries].join(', ') || '—'}${counterHits.length ? ' · ДОШЛО: ' + counterHits.join(', ') : ''}`);
} finally {
  ch.kill();
  setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); } catch (e) {} }, 500);
}
const bad = results.filter((r) => !r).length;
console.log(bad ? `\n✗ не прошло: ${bad} из ${results.length}` : `\n✓ всё прошло: ${results.length} проверок`);
setTimeout(() => process.exit(bad ? 1 : 0), 700);
