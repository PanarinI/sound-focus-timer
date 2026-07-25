// hearth.js — ОЧАГ по MECHANICS (2026-07-16..17). Движок engine.js — как есть (+extinguish быстрый выдох).
// ДВА КОНЦА (юзер-тест №6): таймер решил закончить → мягкий рассвет (церемония). Я решил → быстрый выдох (3-5с).
// Церемония хороша, только когда решение НЕ моё. Стоп — первичный жест, всегда доступен, всегда отвечает мгновенно.
// Жесты (сценарии S1–S6, MECHANICS §3):
//   клик в покое = старт · клик в сессии = пауза/продолжить · «завершить» (видна всю сессию) = быстрый выдох
//   клик во время ЛЮБОГО угасания (рассвет/выдох) = оборвать в тишину сейчас (не ждать)
//   кручение = ТОЛЬКО завод в покое; в сессии скролл не перехватывается.

const el = {};
['room', 'ember', 'setarc', 'num', 'wrap', 'stage', 'embers', 'ash', 'ashlife', 'home', 'pip', 'volume', 'fast', 'premium', 'energy', 'masking', 'harmony', 'finish', 'knob', 'settoggle', 'settings', 'sndhint', 'sndwave', 'sndmute', 'glowrow', 'glowtoggle', 'ratebar', 'rstars']
  .forEach((id) => { el[id] = document.getElementById(id); });

const RING_C = 2 * Math.PI * 90;
const GROW_K = 2.4;                       // фронт-загрузка роста жара (см. render: рост СЕССИЯ-ОТНОСИТЕЛЬНЫЙ к плато)
const SLEEP_AFTER = 10 * 60;             // забытая пауза → очаг засыпает (сек; fast делит на 20)
const WHEEL_STEP_PX = 60;                // порог аккумулятора завода (свайп ≠ шквал)
const QUENCH = () => (el.fast.checked ? 1.5 : 4);   // быстрый выдох ручного «завершить»

let dialMin = +(localStorage.getItem('hearth.dial') || 15);   // дефолт 15 (реш. автора 07-18): ADHD-канон 15/5 · шанс дожить до «рассвета» в первом сеансе
let infinite = localStorage.getItem('hearth.dial') === 'Infinity';
if (infinite) dialMin = Infinity;
let twisting = false, downAt = 0, sleepTimer = null, wheelAcc = 0, pendingEmber = null;
let lastGrown = 0, grownAtDawn = 0, grownAtExt = 0, lastPhase = 'off';

// В расширении звук живёт в offscreen-документе и переживает закрытие панели (remote.js — тот же контракт).
// На локальном стенде (file://, localhost) chrome.runtime нет — движок работает прямо здесь, как раньше.
const IN_EXT = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
const engine = IN_EXT ? new RemoteEngine(render) : new AudioEngine(render);
engine.GATHER = 3; engine.DAWN = 4;      // fast-стенд; applyFast() переключает на прод-длины

const inSession = (p) => ['собирание', 'ткань', 'ниточка'].includes(p);   // рабочие фазы (без угасаний)
const fading = (p) => p === 'рассвет' || p === 'угасание';                // любой уход в тишину
const unit = () => (el.fast.checked ? 1 : 60);
const nowS = () => performance.now() / 1000;
const elapsedS = () => (engine.phase === 'ниточка' ? engine.pausedAt : (engine.sessionStart ? nowS() - engine.sessionStart : 0));

// ---------- УГЛИ-СЛЕПКИ ----------
const embers = JSON.parse(localStorage.getItem('hearth.embers') || '[]');
const today = () => new Date().toDateString();
function dropEmber(focusSec) {
  const min = Math.max(0.2, focusSec / unit());
  embers.push({ ts: Date.now(), min: +min.toFixed(1) });
  localStorage.setItem('hearth.embers', JSON.stringify(embers));
  // счёт завершённых сессий — топливо просьбы об оценке (со 2-й, паттерн ExportGPT)
  localStorage.setItem('hearth.sessions', String(+(localStorage.getItem('hearth.sessions') || 0) + 1));
  renderEmbers();
}
function renderEmbers() {
  const doc = el.embers.ownerDocument;
  el.embers.innerHTML = '';
  const day = embers.filter(e => new Date(e.ts).toDateString() === today());
  // ряд всегда влезает в сцену: при >9 углей шаг сжимается — угли теснятся в гряду, не слипаются у краёв
  const gap = day.length > 1 ? Math.min(22, 192 / (day.length - 1)) : 22;
  let x = 110 - (day.length - 1) * gap / 2;
  day.forEach((e) => {
    const r = Math.min(9, 2 + Math.sqrt(e.min) * 1.35);
    const c = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', Math.max(14, Math.min(206, x))); c.setAttribute('cy', 236); c.setAttribute('r', r.toFixed(1));
    c.setAttribute('class', 'ember');
    el.embers.appendChild(c); x += gap;
  });
  const yMin = embers.filter(e => { const d = new Date(e.ts); const y = new Date(Date.now() - 864e5); return d.toDateString() === y.toDateString(); })
    .reduce((s, e) => s + e.min, 0);
  el.ash.setAttribute('x2', yMin ? Math.min(206, 110 + Math.min(96, yMin * 1.2)) : 110);
  el.ash.setAttribute('x1', yMin ? Math.max(14, 110 - Math.min(96, yMin * 1.2)) : 110);
  calcLife();
  const tot = day.reduce((s, e) => s + e.min, 0);
  const parts = [];
  if (day.length) parts.push(`${day.length} ${plural(day.length)} · ${fmt(tot)}`);
  if (lifeMin >= 60) parts.push(`прожито очагом ${fmt(lifeMin)}`);   // тихая честность за ховером, не витрина
  el.stage.title = parts.join(' — ');
}

// ---------- ТЕПЛО ОЧАГА (реш. автора 07-23): прожитое не показывается — чувствуется ----------
// Камни очага греются от ВСЕГО прожитого (сумма минут архива углей) и НЕ остывают: шкала монотонна,
// пропуск дней ничего не отнимает — вина невозможна конструктивно. Заметность нарочно медленная.
const TAU_LIFE = 3000;                    // минуты: 10ч → 0.18 · 50ч → 0.63 · 100ч → 0.86 полноты
let lifeMin = 0, lifeHeat = 0;
function calcLife() {
  lifeMin = embers.reduce((s, e) => s + e.min, 0);
  lifeHeat = 1 - Math.exp(-lifeMin / TAU_LIFE);
  // тон комнаты: центр дымки едва теплеет с прожитым (свежий очаг = исходный #1a1109)
  const r = Math.round(26 + 13 * lifeHeat), g = Math.round(17 + 7 * lifeHeat), b = Math.round(9 + lifeHeat);
  document.body.style.background =
    `radial-gradient(ellipse 70% 60% at 50% 42%, rgb(${r},${g},${b}) 0%, #120c07 55%, #0b0805 100%)`;
  // осадок прожитого — под золой вчера: ширина и плотность растут от суммы, хронологии нет
  const half = 96 * (1 - Math.exp(-lifeMin / 2400));
  el.ashlife.setAttribute('x1', (110 - half).toFixed(1));
  el.ashlife.setAttribute('x2', (110 + half).toFixed(1));
  el.ashlife.style.opacity = lifeMin ? (0.10 + 0.15 * lifeHeat).toFixed(2) : 0;
}
function plural(n) { return n % 10 === 1 && n % 100 !== 11 ? 'сессия' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'сессии' : 'сессий'); }
function fmt(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} ч ${m} м` : `${m} м`; }

// ---------- ПРОСЬБА ОБ ОЦЕНКЕ (реш. автора 07-22; паттерн ExportGPT, канон методики) ----------
// Появляется СО 2-й завершённой сессии, только в покое, до первой оценки.
// ≥4★ → отзывы CWS · 1–3★ → форма фидбека (боль ловим себе, не в стор).
const RATE_URL = '';      // отзывы CWS: chromewebstore.google.com/detail/<id>/reviews — заполнить на публикации (веха 1)
const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfTyBVwYzmT3Pvhj0xsmcgE3OzKnR5qCjEeR6HOLIU5msrwkg/viewform';  // форма автора (07-22)
const rateReady = () =>
  (RATE_URL || FEEDBACK_URL) && !localStorage.getItem('hearth.rated') &&
  +(localStorage.getItem('hearth.sessions') || 0) >= 2;

(function buildStars() {
  for (let n = 1; n <= 5; n++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'rstar'); s.dataset.n = n;
    s.innerHTML = '<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" fill="currentColor"/>';
    s.addEventListener('mouseenter', () => el.rstars.querySelectorAll('.rstar').forEach((x) => x.classList.toggle('lit', +x.dataset.n <= n)));
    s.addEventListener('mouseleave', () => el.rstars.querySelectorAll('.rstar').forEach((x) => x.classList.remove('lit')));
    s.addEventListener('click', () => {
      const url = n >= 4 ? (RATE_URL || FEEDBACK_URL) : (FEEDBACK_URL || RATE_URL);
      if (url) window.open(url, '_blank');
      localStorage.setItem('hearth.rated', '1');
      el.ratebar.hidden = true;
    });
    el.rstars.appendChild(s);
  }
})();

// ---------- РЕНДЕР (тело = прожитое; кручение тело не трогает — модель v3) ----------
function render(st) {
  const phase = st ? st.phase : 'off';
  const on = !!(st && st.on);
  const depth = Math.max(0, Math.min(1, (st && st.depth) || 0.15));

  el.ratebar.hidden = !(phase === 'off' && rateReady());   // просьба живёт ТОЛЬКО в покое — сессию не трогаем

  if (st && st.justEnded) {                                    // конец (рассвет ИЛИ выдох догорел) → уголь + тишина
    const focus = pendingEmber != null ? pendingEmber : Math.max(0, elapsedS() - engine.DAWN);
    dropEmber(Math.max(0, focus));
    pendingEmber = null;
    engine.turnOff();
    return;
  }
  if (phase !== lastPhase) {
    if (phase === 'рассвет') grownAtDawn = lastGrown;
    if (phase === 'угасание') grownAtExt = lastGrown;
    if (fading(phase)) startFadePaint();          // движок в угасании молчит — дорисовываем сами (см. ниже)
    lastPhase = phase;
  }

  let grown = 0;
  if (inSession(phase)) {
    // Рост СЕССИЯ-ОТНОСИТЕЛЬНЫЙ (07-24, жалоба автора «5 мин — почти не растёт», но «закипать» не хотим):
    // огонь зреет к ПЛАТО по ДОЛЕ пройденной сессии → любая сессия «врастает» в огонь (5 мин живо уже к
    // середине), и он НЕ раздувается до предела (плато < полноты). Плато мягко выше у длинной сессии
    // (дольше жёг — крупнее очаг), но всегда с запасом до максимума. ∞ — зреет к плато ~25 мин, дальше держит.
    const fast = el.fast.checked;
    const focusDur = infinite ? (fast ? 45 : 1500)
                              : Math.max(1, (engine.sessionDur || 0) - engine.DAWN);
    const frac = Math.min(1, elapsedS() / focusDur);
    const plateau = 0.5 + 0.3 * (1 - Math.exp(-focusDur / (fast ? 60 : 3000)));   // 5мин→~0.53 · 25мин→~0.62 · 90мин→~0.75
    grown = plateau * (1 - Math.exp(-GROW_K * frac));           // фронт-загружено: живо уже в первые минуты
    lastGrown = grown;              // ← запоминаем полноту жара: с неё начнётся оседание в рассвете/выдохе
  } else if (phase === 'рассвет') {
    grown = grownAtDawn * Math.max(0, Math.min(1, (depth - 0.4) / 0.5));
  } else if (phase === 'угасание') {
    const p = Math.min(1, (nowS() - engine.phaseStart) / (engine._extDur || 1));
    grown = grownAtExt * (1 - p);                              // тело оседает синхронно с выдохом
  }
  // (силуэт уголька фиксирован — рост идёт ВНУТРЬ через --g ниже, размер не трогаем; «закипать» нельзя)

  // дуга-остаток: видна в рабочей сессии (не ∞); гаснет в угасаниях и покое
  if (inSession(phase) && !infinite) {
    const frac = Math.max(0, Math.min(1, (st && st.remaining || 0) / Math.max(1, engine.sessionDur)));
    el.setarc.style.opacity = 0.42;                            // дуга-остаток важна автору (07-24) — чуть заметнее
    el.setarc.style.strokeDashoffset = (RING_C * (1 - frac)).toFixed(1);
  } else if (phase === 'off' || fading(phase)) {
    el.setarc.style.opacity = 0;
  }

  el.finish.hidden = !inSession(phase);                        // «завершить» — всю рабочую сессию (S5, всегда под рукой)
  placeKnob();                                                 // хваталка завода: видна в покое, спрятана в сессии
  el.stage.classList.toggle('insession', on);                  // горит очаг → деления циферблата уходят (07-24), дуга-остаток остаётся

  const dim = phase === 'ниточка' ? 0.5 : 1;                   // пауза = глуше жар
  // покой: уголёк чуть теплее у пожившего очага (ТЕПЛО ОЧАГА — монотонно, не остывает)
  const heat = on ? Math.min(1, (0.22 + grown * 0.55 + depth * 0.3)) * dim : 0.1 + 0.05 * lifeHeat;

  // УГОЛЁК (вариант Б): рост ВНУТРЬ (прожилки/окна пепла ← --g) + тепло тела/ореола (← --heat).
  // Силуэт фиксирован, дышит (CSS). Вся визуальная логика — в CSS по этим двум переменным.
  el.ember.style.setProperty('--g', grown.toFixed(3));
  el.ember.style.setProperty('--heat', heat.toFixed(3));

  // ENVELOPE (#room): тёплая ЯНТАРНАЯ среда вокруг уголька крепнет с жаром — сажает юзера ВНУТРЬ звука.
  if (el.room) el.room.style.opacity = (0.05 + heat * 0.5).toFixed(3);
}

// ---------- ДОРИСОВКА УГАСАНИЯ ----------
// Движок, уйдя в угасание, уже отдал звуку всё и перестаёт тикать — а картинка обязана дожить:
// тело оседает, и завод возвращается под руку РАНЬШЕ, чем звук истает (реш. автора 07-18).
// Поэтому на время угасания панель крутит собственные кадры.
let fadeRAF = 0;
function startFadePaint() {
  cancelAnimationFrame(fadeRAF);
  const step = () => {
    if (!fading(engine.phase)) return;            // угасание кончилось — дорисовка больше не нужна
    if (engine.phase === 'угасание') {            // жар оседает синхронно с выдохом — ВНУТРЬ (прожилки гаснут), не в размер
      const grown = grownAtExt * (1 - Math.min(1, (nowS() - engine.phaseStart) / fadeDur()));
      el.ember.style.setProperty('--g', grown.toFixed(3));
      el.ember.style.setProperty('--heat', (0.1 + grown * 0.6).toFixed(3));   // тело остывает с прожилками (загнетание, не тушение)
    }
    placeKnob();
    fadeRAF = requestAnimationFrame(step);
  };
  fadeRAF = requestAnimationFrame(step);
}

// ---------- ЧИСЛО-ВСПЫШКА ----------
function flashNum(text) {
  el.num.textContent = text; el.num.style.opacity = 1;
  clearTimeout(flashNum._t);
  flashNum._t = setTimeout(() => { el.num.style.opacity = 0; }, 1100);
}

// ---------- ЗАВОД (покой) ----------
const KNOB_BACK = 0.6;      // доля угасания, после которой завод уже под рукой (звук ещё истаивает)
const fadeDur = () => Math.max(0.1, engine.phase === 'рассвет' ? engine.DAWN : (engine._extDur || 1));

function placeKnob() {                                          // видимая хваталка на позиции завода; в сессии прячется
  const p = engine.phase;
  if (inSession(p)) { el.knob.style.opacity = 0; return; }      // в работе завод убран
  if (fading(p)) {
    // Ручка возвращается ЗАРАНЕЕ — раньше, чем звук уйдёт совсем (реш. автора 07-18):
    // рука уже может завести следующий круг, пока очаг договаривает.
    const prog = Math.min(1, (nowS() - engine.phaseStart) / fadeDur());
    if (prog < KNOB_BACK) { el.knob.style.opacity = 0; return; }
  }
  el.knob.style.opacity = 1;
  const m = infinite ? 105 : dialMin;                          // ∞ → середина сектора «после последней отметки» (315°), не впритык к 12
  const th = (m / 120) * 2 * Math.PI;
  el.knob.setAttribute('cx', (110 + 90 * Math.sin(th)).toFixed(1));
  el.knob.setAttribute('cy', (110 - 90 * Math.cos(th)).toFixed(1));
}
function showDial() {
  flashNum(infinite ? '∞' : dialMin + '′');
  el.setarc.style.opacity = 0.55;
  el.setarc.style.strokeDashoffset = infinite ? 0 : (RING_C * (1 - dialMin / 120)).toFixed(1);
  placeKnob();
}
function setDial(min) {
  infinite = min > 90;
  dialMin = infinite ? Infinity : Math.max(5, Math.min(90, Math.round(min / 5) * 5));
  localStorage.setItem('hearth.dial', infinite ? 'Infinity' : dialMin);
  showDial();
}
function geo(e) {
  const box = el.wrap.getBoundingClientRect();
  const dx = e.clientX - (box.left + box.width / 2), dy = e.clientY - (box.top + box.width / 2);
  let ang = Math.atan2(dx, -dy) * 180 / Math.PI; if (ang < 0) ang += 360;
  return { dist: Math.hypot(dx, dy) / (box.width / 220), ang };
}

// ---------- СТОП: быстрый выдох + мгновенный уголь+тишина ----------
function quench() {                                            // ручное «завершить» (S5/S6): выдох QUENCH сек
  clearTimeout(sleepTimer);
  pendingEmber = Math.max(0, elapsedS());                     // честный слепок отработанного (без вычета рассвета)
  engine.extinguish(QUENCH());
}
function killNow() {                                          // клик во время угасания: оборвать в тишину СЕЙЧАС
  const focus = pendingEmber != null ? pendingEmber : Math.max(0, elapsedS() - engine.DAWN);
  pendingEmber = null;
  dropEmber(Math.max(0, focus));
  engine.turnOff();
}

// ---------- КЛИК — контекстный ----------
// Вспышка «звук пошёл» — подтверждение действия, не предупреждение.
// Системный мьют/громкость ОС браузеру недоступны (нет API) — честно показываем только то,
// что знаем наверняка: свой ползунок. На нуле — перечёркнутый динамик и держим дольше.
function flashSound() {
  const muted = +el.volume.value === 0;
  el.sndwave.style.display = muted ? 'none' : '';
  el.sndmute.style.display = muted ? '' : 'none';
  el.sndhint.style.opacity = muted ? 0.95 : 0.7;
  clearTimeout(flashSound.t);
  flashSound.t = setTimeout(() => { el.sndhint.style.opacity = 0; }, muted ? 3000 : 1500);
}

function start() {
  flashSound();
  el.setarc.style.opacity = 0;
  engine.turnOn();
  engine.startSession(infinite ? 9e7 : dialMin * unit() + engine.DAWN);
}
function hearthClick() {
  const p = engine.phase;
  if (p === 'off' || p === 'ручей') start();
  else if (p === 'собирание' || p === 'ткань') {              // пауза (тишина сразу, жар глуше)
    engine.pause();
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {                           // забыл вернуться → очаг тихо уснул, слепок честен
      if (engine.phase === 'ниточка') { dropEmber(Math.max(0, engine.pausedAt)); engine.turnOff(); }
    }, (el.fast.checked ? SLEEP_AFTER / 20 : SLEEP_AFTER) * 1000);
  }
  else if (p === 'ниточка') { clearTimeout(sleepTimer); engine.resume(); }
  else if (fading(p)) killNow();                              // рассвет/выдох + клик = оборвать сейчас (отклик всегда есть)
}

// жесты самодостаточны на wrap (едут в PiP; el.* — живые ссылки в любом документе)
el.wrap.addEventListener('pointerdown', (e) => {
  const g = geo(e);
  if (g.dist > 55 && !inSession(engine.phase) && !fading(engine.phase)) { twisting = true; el.wrap.setPointerCapture(e.pointerId); setDial(g.ang / 360 * 120); }
  else if (g.dist <= 55) downAt = performance.now();
});
el.wrap.addEventListener('pointermove', (e) => { if (twisting) setDial(geo(e).ang / 360 * 120); });
el.wrap.addEventListener('pointerup', () => {
  if (twisting) twisting = false;
  else if (downAt) { downAt = 0; hearthClick(); }
});
// колесо: ТОЛЬКО завод в покое. В сессии/угасании скролл не перехватывается (юзер-тест №4).
el.wrap.addEventListener('wheel', (e) => {
  if (inSession(engine.phase) || fading(engine.phase)) return;
  e.preventDefault();
  wheelAcc += e.deltaY;
  let steps = 0;
  while (wheelAcc <= -WHEEL_STEP_PX) { steps++; wheelAcc += WHEEL_STEP_PX; }
  while (wheelAcc >= WHEEL_STEP_PX) { steps--; wheelAcc -= WHEEL_STEP_PX; }
  if (steps) setDial((infinite ? 95 : dialMin) + steps * 5);
}, { passive: false });

// «завершить» (S5/S6): всегда под рукой в сессии; клики не протекают в wrap
['pointerdown', 'pointerup'].forEach((t) => el.finish.addEventListener(t, (e) => e.stopPropagation()));
el.finish.addEventListener('click', quench);

// ---------- ГРОМКОСТЬ ----------
function paintVol(v) { const p = (v * 100).toFixed(0); el.volume.style.background = `linear-gradient(90deg, #e8b25c 0%, #b9702a ${p}%, #2a2119 ${p}%)`; }
el.volume.addEventListener('input', () => { const v = +el.volume.value; engine.setChar({ volume: v }); paintVol(v); });
paintVol(+el.volume.value);

// ---------- PiP-ВЫНОС ----------
if (!('documentPictureInPicture' in window)) { el.pip.textContent = 'PiP недоступен в этом браузере'; el.pip.disabled = true; }
el.pip.addEventListener('click', async () => {
  if (window.__pipWin) { window.__pipWin.close(); return; }
  try {
    const w = +localStorage.getItem('hearth.pipW') || 230, h = +localStorage.getItem('hearth.pipH') || 260;
    const pip = await documentPictureInPicture.requestWindow({ width: w, height: h });
    window.__pipWin = pip;
    document.querySelectorAll('style').forEach(s => pip.document.head.appendChild(s.cloneNode(true)));
    pip.document.body.style.cssText = 'margin:0;background:#0e0b08;display:flex;align-items:center;justify-content:center;overflow:hidden;';
    pip.document.body.appendChild(el.stage);
    el.pip.textContent = 'вернуть жар';
    pip.addEventListener('resize', () => { localStorage.setItem('hearth.pipW', pip.innerWidth); localStorage.setItem('hearth.pipH', pip.innerHeight); });
    pip.addEventListener('pagehide', () => { el.home.appendChild(el.stage); window.__pipWin = null; el.pip.textContent = 'вынести жар'; });
  } catch (err) { el.pip.textContent = 'PiP: ' + err.message; console.error('PiP:', err); }
});

// ---------- НАСТРОЙКИ ОЧАГА (прод: энергия + кокон, тёплые) ----------
function paintRange(r) { const p = (+r.value * 100).toFixed(0); r.style.background = `linear-gradient(90deg, #e8b25c 0%, #b9702a ${p}%, #2a2119 ${p}%)`; }
['energy', 'masking'].forEach((k) => {
  paintRange(el[k]);
  el[k].addEventListener('input', () => { engine.setChar({ [k]: +el[k].value }); paintRange(el[k]); });
});
el.settoggle.addEventListener('click', () => {
  const open = el.settings.hidden;
  el.settings.hidden = !open;
  el.settoggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});

// ---------- ПОЛКА (не в прод-UI; код жив, глаз юзера не видит) ----------
// дев-fast · премиум-слой (контейнер экспериментов) · гармонизация (премиум-эксперимент). PiP-кнопка скрыта (позже).
function applyFast() { if (el.fast.checked) { engine.GATHER = 3; engine.DAWN = 4; } else { engine.GATHER = 90; engine.DAWN = 40; } }
el.fast.addEventListener('change', applyFast); applyFast();
el.premium.addEventListener('change', () => engine.setTier(el.premium.checked ? 'premium' : 'basic'));
el.harmony.addEventListener('input', () => engine.setHarmony(+el.harmony.value));

renderEmbers();
render(null);

// ---------- ОТБЛЕСК (только в расширении) ----------
// Порт держим открытым всё время жизни панели: его обрыв — это и есть сигнал «дом свернули».
// Права на страницы спрашиваем ЗДЕСЬ, по клику: человек уже понял, зачем они, и жест у нас есть
// (chrome.permissions.request без жеста браузер отклоняет).
if (IN_EXT) {
  engine.sync();                                   // панель могла открыться поверх уже горящего очага
  const panelPort = chrome.runtime.connect({ name: 'panel' });
  // ЗЕРКАЛО язычка (реш. автора 07-22): клик по язычку при открытой панели = закрыть её.
  // API закрыть панель не умеет — но страница панели может закрыть СЕБЯ.
  panelPort.onMessage.addListener((msg) => {
    if (msg && msg.type === 'closeHome') window.close();
  });

  const GLOW_ORIGINS = { origins: ['<all_urls>'] };
  el.glowrow.hidden = false;

  // Тумблер язычка — первая переключалка настроек очага (реш. автора 07-22).
  // ТРУБА-ИСТИНА = storage.glowEnabled (фон слушает onChanged; крестик на язычке пишет туда же).
  // Права НЕ трогаем при выключении (выданные остаются — включение обратно без системного окна);
  // при включении без прав — запрашиваем (жест жив), отказ = тумблер остаётся выкл.
  async function glowState() {
    const [{ glowEnabled = true }, has] = await Promise.all([
      chrome.storage.local.get({ glowEnabled: true }),
      chrome.permissions.contains(GLOW_ORIGINS)
    ]);
    return { on: glowEnabled && has, has };
  }
  async function paintGlowSwitch() {
    const { on } = await glowState();
    el.glowtoggle.classList.toggle('on', on);
    el.glowtoggle.setAttribute('aria-checked', String(on));
  }
  el.glowtoggle.addEventListener('click', async () => {
    const { on, has } = await glowState();
    if (on) {
      await chrome.storage.local.set({ glowEnabled: false });
    } else {
      const ok = has || await chrome.permissions.request(GLOW_ORIGINS);  // системное окно; отказ — остаёмся выкл
      if (ok) await chrome.storage.local.set({ glowEnabled: true });
    }
    paintGlowSwitch();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch.glowEnabled) paintGlowSwitch();   // крестик на странице щёлкнул — тумблер узнал
  });
  paintGlowSwitch();
}
