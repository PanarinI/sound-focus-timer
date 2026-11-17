// proverka.mjs — просьба об оценке 1.2.3 (16.11) в настоящем Chrome с дев-сборкой.
//
// Что проверяем (слово автора 16.11: пункты 1–4 приняты + «кто уже летал — просьба при следующем открытии»):
//   рейс засчитывает дом звука, как только звук пронёс 5 «минут» — любая длина, включая ∞, любой конец;
//   карточка со 2-го такого рейса, только в тихую минуту (покой или пауза), «Not now» — до следующего рейса;
//   первый клик по звезде или Start при карточке — «не сейчас», а не взлёт; новое событие rate_shown;
//   концы рейса arrived/finished уходят в фон (раньше молчали); кто летал до 1.2.3 — карточка сразу.
// Четыре человека, у каждого свой чистый профиль: A новый · B летал до 1.2.3 · C уже оценивал · D открывал, не летал.
// Клики по карточке, звезде, Start, ∞ и вуали — настоящие (Input.dispatchMouseEvent). Быстрый режим (fast) и
// длина 5/15 — через функции панели: это служебные ручки, а не то, что проверяем. track и window.open подменены
// записью — видно, что ушло бы в GA4 и какой адрес открылся бы, а наружу ничего не уходит (дев и так молчит).
//
// Как: node proverka.mjs [путь к dist/unpacked-<в>-dev]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(process.argv[2] || join(HERE, '../../../dist/unpacked-1.2.3-dev'));
const KADRY = join(HERE, '../kadry');
const TAG = process.env.TAG || '1.2.3';                   // метка кадров: новый вариант = новое имя, старые не трогаем
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const RATE_URL = 'https://chromewebstore.google.com/detail/minimalist-timer/miknhphoakphfhgjajhkalmpdnadkeic/reviews';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail !== '' ? ' — ' + detail : ''}`);
};
const J = (x) => JSON.stringify(x);

function launch() {
  const prof = mkdtempSync(join(tmpdir(), 'ocenka-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--use-mock-keychain',
    '--autoplay-policy=no-user-gesture-required', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
    '--window-size=360,720', 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const out = ch.stdio[3], inp = ch.stdio[4];
  inp.setEncoding('utf8');
  let buf = '', seq = 0; const waiting = new Map(); const errors = [];
  inp.on('data', (d) => {
    buf += d; let i;
    while ((i = buf.indexOf('\0')) >= 0) {
      const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); continue; }
      if (m.method === 'Runtime.exceptionThrown') {
        const e = m.params.exceptionDetails;
        errors.push(((e.exception && e.exception.description) || e.text || '').split('\n')[0] + ` (${e.url || ''}:${e.lineNumber})`);
      }
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((r) => {
    const id = ++seq; waiting.set(id, r);
    out.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });
  const close = () => new Promise((r) => {
    ch.kill();
    setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); } catch (e) {} r(); }, 500);
  });
  return { send, close, errors };
}

async function ev(C, sid, expression) {
  const r = await C.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid);
  if (r.result && r.result.exceptionDetails) {
    const e = r.result.exceptionDetails;
    throw new Error('evaluate: ' + ((e.exception && e.exception.description) || e.text));
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}

async function waitFor(fn, limit = 15000, step = 150) {
  const t0 = Date.now();
  while (Date.now() - t0 < limit) { if (await fn()) return Date.now() - t0; await sleep(step); }
  return null;
}

async function setup(C) {
  await sleep(1000);
  const ld = await C.send('Extensions.loadUnpacked', { path: EXT });
  const id = ld.result && ld.result.id;
  if (!id) throw new Error('сборка не встала: ' + J(ld.error));
  let sw = null;
  for (let i = 0; i < 50 && !sw; i++) {
    const all = (await C.send('Target.getTargets')).result.targetInfos;
    sw = all.find((t) => t.type === 'service_worker' && t.url.startsWith(`chrome-extension://${id}/`));
    if (!sw) await sleep(100);
  }
  if (!sw) throw new Error('фон не найден');
  const swSid = (await C.send('Target.attachToTarget', { targetId: sw.targetId, flatten: true })).result.sessionId;
  await C.send('Runtime.enable', {}, swSid);
  const swEv = (expr) => ev(C, swSid, expr);
  await swEv(`self.__sent = []; self.track = (n, p) => { self.__sent.push([n, p || {}]); return Promise.resolve(); }; 'ok'`);
  const swSent = async () => {
    const s = await swEv('self.__sent || null');
    return s;                                                // null = фон перезапустился и запись потеряна
  };
  return { id, swEv, swSent };
}

async function watchOffscreen(C, id) {                       // ошибки дома звука — в общий список
  const off = await waitFor(async () => {
    const all = (await C.send('Target.getTargets')).result.targetInfos;
    return all.find((t) => t.url === `chrome-extension://${id}/offscreen.html`);
  }, 8000);
  if (off === null) return false;
  const all = (await C.send('Target.getTargets')).result.targetInfos;
  const t = all.find((x) => x.url === `chrome-extension://${id}/offscreen.html`);
  const sid = (await C.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).result.sessionId;
  await C.send('Runtime.enable', {}, sid);
  return true;
}

const REC = (seed) => `(() => {
  window.__sent = [];
  Object.defineProperty(window, 'track', { configurable: true, set() {},
    get() { return (n, p) => { window.__sent.push([n, p || {}]); return Promise.resolve(); }; } });
  window.__opened = [];
  window.open = (u) => { window.__opened.push(String(u)); return null; };
  const seed = ${J(seed || {})};
  if (location.pathname.endsWith('/hearth.html') && !localStorage.getItem('__seeded')) {
    for (const k in seed) localStorage.setItem(k, seed[k]);
    localStorage.setItem('__seeded', '1');
  }
})();`;

async function openPanel(C, id, seed) {
  const t = await C.send('Target.createTarget', { url: 'about:blank' });
  const targetId = t.result.targetId;
  const sid = (await C.send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
  await C.send('Page.enable', {}, sid);
  await C.send('Runtime.enable', {}, sid);
  await C.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 720, deviceScaleFactor: 2, mobile: false }, sid);
  await C.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sid);
  await C.send('Page.addScriptToEvaluateOnNewDocument', { source: REC(seed) }, sid);
  const pev = (expr) => ev(C, sid, expr);
  const P = {
    targetId, pev,
    async go() { await C.send('Page.navigate', { url: `chrome-extension://${id}/hearth.html` }, sid); await sleep(400); },
    async rect(sel) {
      return pev(`(() => { const e = document.querySelector(${J(sel)}); if (!e) return null;
        const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    },
    async clickAt(x, y) {
      await C.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, sid);
      await C.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, sid);
      await C.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, sid);
      await sleep(250);
    },
    async click(sel) { const r = await P.rect(sel); if (!r) throw new Error('нет ' + sel); await P.clickAt(r.x, r.y); },
    async hit(sel) {                                         // что на самом деле окажется под пальцем в центре элемента
      return pev(`(() => { const e = document.querySelector(${J(sel)}); if (!e) return null; const b = e.getBoundingClientRect();
        const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        if (!h) return null;
        return h.closest('.askcard') ? 'askcard' : (h.id || h.getAttribute('class') || h.tagName); })()`);
    },
    phase: () => pev('engine.phase'),
    known: () => pev('soundKnown'),
    cardUp: () => pev(`(() => { const c = document.querySelector('.askcard'); return !!c && getComputedStyle(c).display !== 'none'; })()`),
    barUp: () => pev(`!document.getElementById('ratebar').hidden`),
    store: () => pev(`new Promise((r) => chrome.storage.local.get('rate', (o) => r(o.rate || null)))`),
    sent: () => pev('window.__sent.map((x) => x[0])'),
    opened: () => pev('window.__opened'),
    count: async (name) => (await P.sent()).filter((n) => n === name).length,
    fast: () => pev(`el.fast.checked = true; el.fast.dispatchEvent(new Event('change')); true`),
    len: (i) => pev(`setLen(${i}, false); true`),
    veilPoint: () => pev(`(() => { const v = document.getElementById('askveil'); if (!v) return null;
      for (const [x, y] of [[10, 360], [350, 360], [10, 700], [350, 700], [180, 712], [10, 10], [180, 8]])
        if (document.elementFromPoint(x, y) === v) return { x, y };
      return null; })()`),
    async shot(name) {
      if (!existsSync(KADRY)) mkdirSync(KADRY, { recursive: true });
      const file = join(KADRY, name);
      if (existsSync(file)) { console.log(`    (кадр ${name} уже есть — не перезаписываю)`); return; }
      await sleep(500);
      const s = await C.send('Page.captureScreenshot', { format: 'png' }, sid);
      writeFileSync(file, Buffer.from(s.result.data, 'base64'));
      console.log(`    кадр: kadry/${name}`);
    },
    close: () => C.send('Target.closeTarget', { targetId }),
  };
  await P.go();
  return P;
}

const flying = (p) => ['собирание', 'ткань', 'рассвет'].includes(p);

// ─────────────────────────────────────────────────────────────────────────────
async function scenarioA() {
  console.log('\nA · новый человек (чистый профиль)');
  const C = launch();
  try {
    const { id, swSent } = await setup(C);
    const P = await openPanel(C, id);
    check('панель узнала фазу от дома звука', (await waitFor(() => P.known(), 6000)) !== null);
    await watchOffscreen(C, id);
    let r = await P.store();
    check('перенос отработал: не летал → просьбы нет', r && r.moved && r.flights === 0 && !r.pending, J(r));
    check('карточки нет', !(await P.cardUp()));
    check('плашка «Rate us» в углу видна в покое', await P.barUp());

    await P.fast(); await P.len(0);                          // 5 «минут»; в fast «минута» = 1 с
    await P.click('#star');
    await waitFor(async () => flying(await P.phase()), 3000);  // команда идёт в дом звука: turnOn → startSession
    check('звезда → взлёт', flying(await P.phase()), await P.phase());
    let ms = await waitFor(async () => ((await P.store()) || {}).flights === 1, 12000);
    check('рейс 1 засчитан, как только звук пронёс 5 «минут» (ещё в полёте)', ms !== null && flying(await P.phase()),
      ms !== null ? `за ${(ms / 1000).toFixed(1)} с` : J(await P.store()));
    check('после 1-го рейса просьба не ждёт', !((await P.store()) || {}).pending);
    ms = await waitFor(async () => (await P.phase()) === 'off', 25000);
    check('рейс 1 долетел до конца', ms !== null);
    await sleep(600);
    let s = await swSent();
    const end1 = (s || []).find((x) => x[0] === 'flight_end');
    check('конец рейса ушёл в фон: flight_end · arrived', end1 && end1[1].how === 'arrived', J(end1 || s));
    check('карточки нет (рейс засчитан только один)', !(await P.cardUp()));

    await P.len(1);                                          // 15 — чтобы успеть встать на паузу до рассвета
    await P.click('#star');
    ms = await waitFor(async () => ((await P.store()) || {}).pending === true, 12000);
    r = await P.store();
    check('рейс 2 засчитан → просьба ждёт', ms !== null && r.flights === 2, J(r));
    check('пока звук идёт — карточки нет', flying(await P.phase()) && !(await P.cardUp()), await P.phase());
    check('и rate_shown не отправлен', (await P.count('rate_shown')) === 0);

    await P.click('#star');                                  // пауза
    await waitFor(() => P.cardUp(), 3000);
    check('пауза → карточка встала', (await P.phase()) === 'ниточка' && (await P.cardUp()), await P.phase());
    check('rate_shown — ровно один', (await P.count('rate_shown')) === 1, J(await P.sent()));
    await P.shot(`2026-11-16-kartochka-na-pauze--${TAG}.png`);
    check('карточка закрывает звезду (под пальцем — карточка)', (await P.hit('#star')) === 'askcard', String(await P.hit('#star')));

    await P.click('.askcard .later');
    r = await P.store();
    check('«Not now» → карточки нет, просьба снята', !(await P.cardUp()) && r.pending === false, J(r));
    check('«Not now» не продолжает рейс — пауза стоит', (await P.phase()) === 'ниточка', await P.phase());
    await P.click('#star');
    check('звезда → рейс продолжается', flying(await P.phase()), await P.phase());
    await P.click('#start');                                 // Finish
    ms = await waitFor(async () => (await P.phase()) === 'off', 5000);
    await sleep(600);
    s = await swSent();
    const end2 = (s || []).filter((x) => x[0] === 'flight_end')[1];
    check('Finish → flight_end · finished ушёл в фон', ms !== null && end2 && end2[1].how === 'finished', J(end2 || s));
    check('после «Not now» в покое карточки нет', !(await P.cardUp()));

    await P.click('#inf');
    await P.click('#star');
    check('∞ → взлёт', flying(await P.phase()) && (await P.pev('infinite')) === true);
    ms = await waitFor(async () => ((await P.store()) || {}).flights === 3, 12000);
    r = await P.store();
    check('рейс ∞ засчитан по 5 «минутам» → просьба снова ждёт', ms !== null && r.pending === true, J(r));
    check('в рейсе ∞ карточки нет', !(await P.cardUp()));
    await P.click('#start');
    await waitFor(async () => (await P.phase()) === 'off', 5000);
    await waitFor(() => P.cardUp(), 3000);
    check('Finish ∞ → покой → карточка встала', await P.cardUp());
    check('rate_shown — второй', (await P.count('rate_shown')) === 2);
    check('плашки в углу нет, пока карточка на экране', !(await P.barUp()));
    await P.shot(`2026-11-16-kartochka-v-pokoe--${TAG}.png`);
    await sleep(600);
    s = await swSent();
    const end3 = (s || []).filter((x) => x[0] === 'flight_end')[2];
    check('конец ∞ ушёл в фон: finished · len inf', end3 && end3[1].how === 'finished' && end3[1].len === 'inf', J(end3 || s));

    await P.click('.askcard .rstar[data-n="5"]');
    const ans = (await P.pev('window.__sent.filter((x) => x[0] === "rate_answer")'));
    check('5★ → rate_answer { stars: 5 }', ans.length === 1 && ans[0][1].stars === 5, J(ans));
    const op = await P.opened();
    check('5★ → открылась страница отзывов CWS', op.length === 1 && op[0] === RATE_URL, J(op));
    r = await P.store();
    check('после ответа: rated, просьба снята', r.rated === true && r.pending === false, J(r));
    check('карточки и плашки больше нет', !(await P.cardUp()) && !(await P.barUp()));

    await P.click('#star');
    await waitFor(async () => false, 6500);                  // 6,5 с полёта ∞
    r = await P.store();
    check('после ответа рейсы не считаются', r.flights === 3 && !r.pending, J(r));
    await P.click('#start');
    await waitFor(async () => (await P.phase()) === 'off', 5000);
    await sleep(400);
    check('и карточка не встаёт', !(await P.cardUp()));
    const swAlive = (await swSent()) !== null;
    check('запись фона жива весь прогон (фон не перезапускался)', swAlive);
  } finally {
    if (C.errors.length) console.log('  ошибки на страницах:\n   ' + C.errors.join('\n   '));
    check('A: ни одной ошибки JS (панель, фон, дом звука)', C.errors.length === 0);
    await C.close();
  }
}

async function scenarioB() {
  console.log('\nB · летал до 1.2.3 (в профиле hearth.flown = 1)');
  const C = launch();
  try {
    const { id } = await setup(C);
    let P = await openPanel(C, id, { 'hearth.flown': '1', 'hearth.opened': '1' });
    await waitFor(() => P.known(), 6000);
    await waitFor(() => P.cardUp(), 3000);
    let r = await P.store();
    check('первое открытие новой версии → карточка сразу', await P.cardUp(), J(r));
    check('перенос: flights 1, просьба ждёт', r && r.moved && r.flights === 1 && r.pending === true, J(r));
    check('rate_shown — один', (await P.count('rate_shown')) === 1);
    await P.shot(`2026-11-16-staryj-letun--${TAG}.png`);

    check('Start при карточке лежит выше вуали (под пальцем — Start)', (await P.hit('#start')) === 'start', await P.hit('#start'));
    await P.click('#start');
    await sleep(1200);
    r = await P.store();
    check('первый клик по Start → «не сейчас», а не взлёт', !(await P.cardUp()) && r.pending === false && (await P.phase()) === 'off',
      `${await P.phase()} · ${J(r)}`);

    await P.go();                                            // открыть панель заново
    await waitFor(() => P.known(), 6000);
    await sleep(500);
    r = await P.store();
    check('новое открытие: карточки нет, перенос второй раз не идёт', !(await P.cardUp()) && r.flights === 1 && !r.pending, J(r));

    // 90 «минут»: новая панель открывается без fast и возвращает рассвету 40 с — короткий рейс ушёл бы в рассвет
    // (след служебного режима; у людей fast не бывает, у них длины рассвета и сбора не меняются)
    await P.fast(); await P.len(4);
    await P.click('#star');
    const ms = await waitFor(async () => ((await P.store()) || {}).pending === true, 12000);
    r = await P.store();
    check('следующий рейс (2-й по счёту) → просьба ждёт', ms !== null && r.flights === 2, J(r));

    await P.close();                                         // панель закрыли посреди рейса…
    P = await openPanel(C, id);                              // …и открыли снова
    await waitFor(() => P.known(), 6000);
    await P.fast();
    await sleep(1200);
    check('панель открыта посреди рейса: карточка не мигнула', flying(await P.phase()) && !(await P.cardUp())
      && (await P.count('rate_shown')) === 0, `${await P.phase()} · rate_shown ${await P.count('rate_shown')}`);
    await P.click('#star');                                  // пауза
    await waitFor(() => P.cardUp(), 3000);
    check('пауза → карточка', (await P.phase()) === 'ниточка' && (await P.cardUp()));
    const vp = await P.veilPoint();
    check('есть место, где клик падает на вуаль', !!vp, J(vp));
    if (vp) await P.clickAt(vp.x, vp.y);
    r = await P.store();
    check('клик мимо карточки → «не сейчас», пауза стоит', !(await P.cardUp()) && r.pending === false
      && (await P.phase()) === 'ниточка', `${await P.phase()} · ${J(r)}`);
    await P.click('#start');
    await waitFor(async () => (await P.phase()) === 'off', 5000);
    await sleep(400);
    check('Finish → покой без карточки', (await P.phase()) === 'off' && !(await P.cardUp()));
  } finally {
    if (C.errors.length) console.log('  ошибки на страницах:\n   ' + C.errors.join('\n   '));
    check('B: ни одной ошибки JS', C.errors.length === 0);
    await C.close();
  }
}

async function scenarioC() {
  console.log('\nC · летал и уже оценивал (hearth.rated = 1)');
  const C = launch();
  try {
    const { id } = await setup(C);
    const P = await openPanel(C, id, { 'hearth.flown': '1', 'hearth.opened': '1', 'hearth.rated': '1' });
    await waitFor(() => P.known(), 6000);
    await sleep(800);
    const r = await P.store();
    check('просьбы нет, плашки нет', !(await P.cardUp()) && !(await P.barUp()), J(r));
    check('перенос: rated, ничего не ждёт', r && r.moved && r.rated === true && !r.pending, J(r));
  } finally {
    check('C: ни одной ошибки JS', C.errors.length === 0, C.errors.join(' | '));
    await C.close();
  }
}

async function scenarioD() {
  console.log('\nD · открывал панель, но не летал (hearth.opened = 1)');
  const C = launch();
  try {
    const { id } = await setup(C);
    const P = await openPanel(C, id, { 'hearth.opened': '1' });
    await waitFor(() => P.known(), 6000);
    await sleep(800);
    const r = await P.store();
    check('просьбы нет, плашка в углу есть', !(await P.cardUp()) && (await P.barUp()), J(r));
    check('перенос: flights 0, ничего не ждёт', r && r.moved && r.flights === 0 && !r.pending, J(r));
  } finally {
    check('D: ни одной ошибки JS', C.errors.length === 0, C.errors.join(' | '));
    await C.close();
  }
}

console.log('сборка:', EXT.split('/').pop());
for (const s of [scenarioA, scenarioB, scenarioC, scenarioD]) {
  try { await s(); } catch (e) { check(`${s.name} упал`, false, e.message); }
}
const bad = results.filter((x) => !x).length;
console.log(bad ? `\n✗ не прошло: ${bad} из ${results.length}` : `\n✓ всё прошло: ${results.length} проверок`);
setTimeout(() => process.exit(bad ? 1 : 0), 300);
