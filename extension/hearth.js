// hearth.js — ОЧАГ по MECHANICS (2026-07-16..17). Движок engine.js — как есть (+extinguish быстрый выдох).
// ДВА КОНЦА (юзер-тест №6): таймер решил закончить → мягкий рассвет (церемония). Я решил → быстрый выдох (3-5с).
// Церемония хороша, только когда решение НЕ моё. Стоп — первичный жест, всегда доступен, всегда отвечает мгновенно.
// Жесты (сценарии S1–S6, MECHANICS §3):
//   клик в покое = старт · клик в сессии = пауза/продолжить · «завершить» (видна всю сессию) = быстрый выдох
//   клик во время ЛЮБОГО угасания (рассвет/выдох) = оборвать в тишину сейчас (не ждать)
//   кручение = ТОЛЬКО завод в покое; в сессии скролл не перехватывается.

const el = {};
['room', 'star', 'sparks', 'timeslider', 'timerow', 'ticks', 'num', 'wrap', 'stage', 'home', 'pip', 'volume', 'fast', 'premium', 'energy', 'masking', 'harmony', 'finish', 'settoggle', 'settings', 'sndhint', 'sndwave', 'sndmute', 'glowrow', 'glowtoggle', 'ratebar', 'rstars']
  .forEach((id) => { el[id] = document.getElementById(id); });

const RING_C = 2 * Math.PI * 90;
const GROW_K = 2.4;                       // фронт-загрузка роста жара (см. render: рост СЕССИЯ-ОТНОСИТЕЛЬНЫЙ к плато)
const SLEEP_AFTER = 10 * 60;             // забытая пауза → очаг засыпает (сек; fast делит на 20)
const WHEEL_STEP_PX = 60;                // порог аккумулятора завода (свайп ≠ шквал)
const QUENCH = () => 0.4;   // ручное «завершить» → почти мгновенный выдох (сам нажал — в плавности нет смысла; не 0, иначе щелчок; engine клампит min 0.3)

let dialMin = +(localStorage.getItem('hearth.dial') || 15);   // дефолт 15 (реш. автора 07-18): ADHD-канон 15/5 · шанс дожить до «рассвета» в первом сеансе
let infinite = localStorage.getItem('hearth.dial') === 'Infinity';
if (infinite) dialMin = Infinity;
let twisting = false, downAt = 0, sleepTimer = null, wheelAcc = 0, pendingEmber = null;
let lastGrown = 0, grownAtDawn = 0, grownAtExt = 0, lastPhase = 'off', lastProg = 0;

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
  calcLife();                                  // жизнь-тепло считаем всегда; визуал накопления запаркован (рейс-к-звезде)
  if (!el.embers) return;                       // угли-ряд не в UI звезды — данные копятся, картинка позже (журнал рейсов)
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
  if (lifeMin >= 60) parts.push(`focused ${fmt(lifeMin)} so far`);   // тихая честность за ховером, не витрина
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
  // тон поля: центр космоса едва теплеет с прожитым (свежее поле = очень глубокий синий, почти чёрный)
  const r = Math.round(14 + 16 * lifeHeat), g = Math.round(22 + 12 * lifeHeat), b = Math.round(54 + 8 * lifeHeat);
  document.body.style.background =
    `radial-gradient(ellipse 70% 60% at 50% 42%, rgb(${r},${g},${b}) 0%, #090d22 55%, #05060f 100%)`;
  // осадок прожитого — под золой вчера (запаркован в рейс-UI; данные живут, картинка позже)
  if (el.ashlife) {
    const half = 96 * (1 - Math.exp(-lifeMin / 2400));
    el.ashlife.setAttribute('x1', (110 - half).toFixed(1));
    el.ashlife.setAttribute('x2', (110 + half).toFixed(1));
    el.ashlife.style.opacity = lifeMin ? (0.10 + 0.15 * lifeHeat).toFixed(2) : 0;
  }
}
function plural(n) { return n === 1 ? 'session' : 'sessions'; }
function fmt(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h}h ${m}m` : `${m}m`; }

// ---------- ПРОСЬБА ОБ ОЦЕНКЕ (реш. автора 07-22; паттерн ExportGPT, канон методики) ----------
// Появляется СО 2-й завершённой сессии, только в покое, до первой оценки.
// ≥4★ → отзывы CWS · 1–3★ → форма фидбека (боль ловим себе, не в стор).
const RATE_URL = 'https://chromewebstore.google.com/detail/minimalist-timer/miknhphoakphfhgjajhkalmpdnadkeic/reviews';   // вписан на аппруве (07-30): ≥4★ → отзывы CWS, 1–3★ → форма
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
  el.finish.hidden = !inSession(phase);                        // «завершить» (посадка сейчас) — всю рабочую сессию

  const dim = phase === 'ниточка' ? 0.5 : 1;                   // пауза = глуше
  const heat = on ? Math.min(1, (0.22 + grown * 0.55 + depth * 0.3)) * dim : 0.1 + 0.05 * lifeHeat;

  // РЕЙС К ЗВЕЗДЕ: звезда БЛИЗИТСЯ по прогрессу сессии (--p); тепло среды = --heat. Кольца/дуги нет.
  // финит — прибывает к концу (p→1); ∞ — крейсер (близится к «плато пути», не «прибывает»).
  let prog = 0;
  if (inSession(phase)) {
    prog = infinite
      ? Math.min(0.6, 1 - Math.exp(-elapsedS() / (el.fast.checked ? 60 : 1800)))
      : Math.min(1, elapsedS() / Math.max(1, engine.sessionDur));
    lastProg = prog;
  } else if (fading(phase)) {
    // рейс окончен → звезда мягко СДУВАЕТСЯ за время ухода (рассвет/выдох), синхронно со звуком
    // (жалоба автора 07-30: «по завершении звезда должна сдуваться»). От достигнутого размера к 0.
    const fdur = phase === 'рассвет' ? engine.DAWN : (engine._extDur || 1);
    const k = 1 - Math.min(1, (nowS() - engine.phaseStart) / Math.max(0.1, fdur));
    prog = lastProg * k;
  }
  el.stage.style.setProperty('--p', prog.toFixed(3));
  el.stage.style.setProperty('--heat', heat.toFixed(3));
  SKY.progress(prog);
  if (el.room) el.room.style.opacity = (0.05 + heat * 0.5).toFixed(3);   // тёплое космос-поле крепнет с рейсом

  // ДВИЖЕНИЕ — только когда ЛЕТИМ. Покой=небо стоит (левитирует) · ПАУЗА=поток ЗАМИРАЕТ (реш. автора 07-25:
  // «на паузе не должно быть эмиссии») → 0, звёзды возвращаются к левитации · рассвет/выдох=мягко оседает.
  const flying = (phase === 'собирание' || phase === 'ткань') ? 1 : (phase === 'ниточка' ? 0 : fading(phase) ? 0.4 : 0);
  el.stage.style.setProperty('--flying', flying);
  SKY.flying(flying);

  // завод задаётся ДО взлёта — в рейсе ползунок притушен
  if (el.timerow) el.timerow.classList.toggle('busy', !(phase === 'off' || phase === 'ручей'));
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
    const fdur = engine.phase === 'рассвет' ? engine.DAWN : (engine._extDur || 1);
    const k = 1 - Math.min(1, (nowS() - engine.phaseStart) / Math.max(0.1, fdur));
    el.stage.style.setProperty('--p', (lastProg * k).toFixed(3));   // звезда сдувается плавно (кадрово, оба ухода)
    if (engine.phase === 'угасание') {            // ручная посадка: тепло среды оседает
      el.stage.style.setProperty('--heat', (0.1 + grownAtExt * 0.6 * k).toFixed(3));
    }
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

// ---------- ЗАВОД (покой) — ползунок под сценой, вместо кольца (реш. автора 07-25) ----------
const fadeDur = () => Math.max(0.1, engine.phase === 'рассвет' ? engine.DAWN : (engine._extDur || 1));
const SCALE = [5, 15, 25, 45, 90, Infinity];                    // градации длины рейса (реш. автора 07-25)

function paintTicks(i) {
  if (!el.ticks) return;
  [...el.ticks.children].forEach((s, k) => s.classList.toggle('on', k === i));
}
function showDial() { flashNum(infinite ? '∞' : dialMin + '′'); }   // мелькнуть выбранное время (мельком, не давит)
function setDialIndex(i) {
  i = Math.max(0, Math.min(SCALE.length - 1, i | 0));
  const v = SCALE[i];
  infinite = !isFinite(v);
  dialMin = infinite ? Infinity : v;
  localStorage.setItem('hearth.dial', infinite ? 'Infinity' : dialMin);
  paintTicks(i);
  showDial();
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

function start() {                                             // тап по звезде = ВЗЛЁТ (старт рейса + звук)
  flashSound();
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

// тап по сцене (звезде) = взлёт / пауза (жест самодостаточен на wrap; едет в PiP). Кручения/колеса нет — время задаёт ползунок.
el.wrap.addEventListener('pointerdown', () => { downAt = performance.now(); });
el.wrap.addEventListener('pointerup', () => { if (downAt) { downAt = 0; hearthClick(); } });

// ---------- ПОЛЗУНОК ВРЕМЕНИ (реш. автора 07-25): под сценой, прилипает к 5·15·25·45·90·∞ ----------
if (el.timeslider) {
  let idx = infinite ? SCALE.length - 1 : SCALE.findIndex((v) => v >= dialMin);
  if (idx < 0) idx = 2;                                        // старое значение вне шкалы → 25
  el.timeslider.value = idx;
  setDialIndex(idx);                                           // синхронизировать dialMin со шкалой + подсветить деление
  el.timeslider.addEventListener('input', () => setDialIndex(+el.timeslider.value));
}

// ---------- НЕБО (canvas) — звёздное поле во ВЕСЬ сайдбар (реш. автора 07-25) ----------
// Покой: звёзды рассыпаны по всему полю, висят и ДЫШАТ (мерцание). Полёт: несутся от звезды-цели наружу
// (warp), скорость потока = ЭНЕРГИЯ. Всё рисует rAF — скорость это множитель кадра, а не CSS-duration:
// её смена плавная, без скачка (баг «прокрутки звёзд при движении ползунка» мёртв by design).
// Точка схода потока = позиция звезды-цели (cx, cy) → двойное чтение хранится: летим К звезде ↔ шар искр.
const SKY = (() => {
  const cv = document.getElementById('sky');
  if (!cv || !cv.getContext) return { flying(){}, speed(){}, progress(){} };
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PALETTE = ['#fff2d6', '#ffe7b8', '#ffd98f', '#f2bd72', '#e8a24c'];   // тёплые, не бело-голубые (капсула)
  let W = 0, H = 0, cx = 0, cy = 0, maxR = 1, dpr = 1, seeded = false;
  let fly = 0, flyTarget = 0, spd = 1, prog = 0, t = 0, last = 0;
  const stars = [];
  const N = reduce ? 40 : 60;                                 // ещё меньше звёзд (−37%) — не рябит, глубже, спокойнее

  function resize() {
    const nw = cv.clientWidth || window.innerWidth || 0;
    const nh = cv.clientHeight || window.innerHeight || 0;
    if (nw < 2 || nh < 2) return;                             // side panel ещё БЕЗ размера — ждём (иначе небо схлопнется в полосу)
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = nw; H = nh;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W * 0.5; cy = H * 0.40;                               // точка схода = звезда-цель (#star top:40%)
    maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 48;
    if (!seeded) { for (let i = 0; i < N; i++) { const s = {}; seed(s, false); stars.push(s); } seeded = true; }  // сеем ТОЛЬКО с реальным размером
  }
  function seed(s, atCenter) {
    if (atCenter) {                                           // респавн В ПОЛЁТЕ — у звезды-цели (поток бьёт из центра)
      s.ang = Math.random() * Math.PI * 2;
      s.r = Math.random() * Math.min(W, H) * 0.05;
    } else {                                                  // ПОКОЙ — ровно по ВСЕМУ сайдбару. Не по диску: диск втрое
      const x = (Math.random() * 1.2 - 0.1) * W;             // больше окна, звёзды копятся в углах за экраном и панель
      const y = (Math.random() * 1.2 - 0.1) * H;             // пустеет. Раздаём по прямоугольнику → небо заполнено всё.
      s.ang = Math.atan2(y - cy, x - cx); s.r = Math.hypot(x - cx, y - cy);
    }
    s.z = 0.28 + Math.random() * 0.72;                        // глубина-параллакс (шире разброс = глубже, дальние почти стоят)
    s.size = 0.5 + s.z * 1.5;
    s.col = PALETTE[(Math.random() * PALETTE.length) | 0];
    s.base = 0.32 + Math.random() * 0.5;                      // базовая яркость
    s.tw = 0.3 + Math.random() * 0.8;                         // скорость дыхания — медленнее (меньше ряби)
    s.ph = Math.random() * Math.PI * 2;                       // фаза дыхания
    s.la = 2.5 + Math.random() * 4;                           // ЛЕВИТАЦИЯ: амплитуда покачивания в покое (px)
    s.fa = 0.10 + Math.random() * 0.22;                       // частоты покачивания — медленные
    s.fb = 0.10 + Math.random() * 0.22;
    s.pa = Math.random() * 6.283; s.pb = Math.random() * 6.283;
  }
  resize();                                                   // засеет сразу, если размер уже готов (стенд/вкладка)

  function frame(dt) {
    t += dt;
    fly += (flyTarget - fly) * Math.min(1, dt * 1.1);         // мягкий разгон/торможение — спокойно поплыли, без рывка
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';                 // тёплое сложение свечения
    const warp = reduce ? 0 : fly;
    for (const s of stars) {
      const dx = Math.cos(s.ang), dy = Math.sin(s.ang);
      if (warp > 0.002) s.r += dt * (2 + s.z * 24) * spd * warp;   // ПОЛЁТ: очень тихо плывём СКВОЗЬ небо (ещё −33%; глубина=скорость)
      // ПОКОЙ: r не растёт — небо СТОИТ с первого кадра; звёзды лишь левитируют (ниже). Никакого дрейфа-фонтана.
      const lev = reduce ? 0 : (1 - 0.55 * warp);             // левитация чуть гаснет в полёте
      const lx = Math.sin(t * s.fa + s.pa) * s.la * lev;
      const ly = Math.cos(t * s.fb + s.pb) * s.la * lev;
      const x = cx + dx * s.r + lx, y = cy + dy * s.r + ly;
      if (warp > 0.002 && (x < -40 || x > W + 40 || y < -40 || y > H + 40)) { seed(s, true); continue; }  // улетела за край → респавн у центра
      const tw = 0.70 + 0.30 * Math.sin(t * s.tw + s.ph);     // дыхание/мерцание — мягче (не рябит)
      const edge = Math.min(1, s.r / maxR);
      ctx.globalAlpha = Math.min(1, s.base * tw * (0.5 + edge * 0.6));
      const trail = warp * s.z * spd * (3 + edge * 9);        // короткий мягкий штрих в полёте, точка в покое
      if (trail > 2) {
        ctx.strokeStyle = s.col; ctx.lineWidth = s.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx * trail, y - dy * trail); ctx.stroke();
      } else {
        ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.arc(x, y, s.size, 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function loop(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (seeded && W > 1) frame(dt);                           // рисуем ТОЛЬКО когда есть реальный размер и звёзды
    requestAnimationFrame(loop);
  }
  // ResizeObserver — ловит ПЕРВЫЙ ненулевой размер side panel (window 'resize' там не приходит) + любые изменения
  if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(cv); } catch (e) {} }
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);

  return {
    flying(v) { flyTarget = Math.max(0, Math.min(1, v)); },
    speed(v) { spd = Math.max(0.1, v); },
    progress(v) { prog = v; },                                 // задел: центр-сход может слегка «подтягиваться» к звезде
  };
})();

// «завершить» (S5/S6): всегда под рукой в сессии; клики не протекают в wrap
['pointerdown', 'pointerup'].forEach((t) => el.finish.addEventListener(t, (e) => e.stopPropagation()));
el.finish.addEventListener('click', quench);

// ---------- ГРОМКОСТЬ ----------
// ПЕРСИСТ (крит-узел 07-30): раньше громкость нигде не хранилась — при перезагрузке панели (разворот
// после сворачивания) ползунок прыгал в HTML-дефолт 0.5, а звук в offscreen оставался на реальном уровне
// → UI и звук расходились. Теперь localStorage = единый источник: восстанавливаем ползунок И движок.
function paintVol(v) { const p = (v * 100).toFixed(0); el.volume.style.background = `linear-gradient(90deg, #e8b25c 0%, #b9702a ${p}%, #2a2119 ${p}%)`; }
const savedVol = localStorage.getItem('hearth.vol');
if (savedVol !== null) el.volume.value = savedVol;
el.volume.addEventListener('input', () => { const v = +el.volume.value; localStorage.setItem('hearth.vol', v); engine.setChar({ volume: v }); paintVol(v); });
engine.setChar({ volume: +el.volume.value });     // движок ← восстановленная громкость (совпасть с ползунком)
paintVol(+el.volume.value);

// ---------- PiP-ВЫНОС ----------
if (!('documentPictureInPicture' in window)) { el.pip.textContent = 'PiP not available in this browser'; el.pip.disabled = true; }
el.pip.addEventListener('click', async () => {
  if (window.__pipWin) { window.__pipWin.close(); return; }
  try {
    const w = +localStorage.getItem('hearth.pipW') || 230, h = +localStorage.getItem('hearth.pipH') || 260;
    const pip = await documentPictureInPicture.requestWindow({ width: w, height: h });
    window.__pipWin = pip;
    document.querySelectorAll('style').forEach(s => pip.document.head.appendChild(s.cloneNode(true)));
    pip.document.body.style.cssText = 'margin:0;background:#0e0b08;display:flex;align-items:center;justify-content:center;overflow:hidden;';
    pip.document.body.appendChild(el.stage);
    el.pip.textContent = 'Return';
    pip.addEventListener('resize', () => { localStorage.setItem('hearth.pipW', pip.innerWidth); localStorage.setItem('hearth.pipH', pip.innerHeight); });
    pip.addEventListener('pagehide', () => { el.home.appendChild(el.stage); window.__pipWin = null; el.pip.textContent = 'Pop out'; });
  } catch (err) { el.pip.textContent = 'PiP: ' + err.message; console.error('PiP:', err); }
});

// ---------- НАСТРОЙКИ (прод: энергия + кокон) ----------
function paintRange(r) { const p = (+r.value * 100).toFixed(0); r.style.background = `linear-gradient(90deg, #e8b25c 0%, #b9702a ${p}%, #2a2119 ${p}%)`; }
// ЭНЕРГИЯ = СКОРОСТЬ ПОЛЁТА (реш. автора 07-25): больше энергии → искры несутся быстрее (слабо, но заметно).
// Кокон (маскировка) — только звук, без визуализации (реш. автора: «герметичность» визуально менять нечем).
function setFlySpeed(v) { const s = 0.7 + v * 0.9; el.stage.style.setProperty('--speed', s.toFixed(2)); SKY.speed(s); }   // 0.7 … 1.6; canvas меняет скорость плавно, без скачка
['energy', 'masking'].forEach((k) => {
  const saved = localStorage.getItem('hearth.' + k);      // персист (как громкость) — не сбрасываться в дефолт при развороте
  if (saved !== null) el[k].value = saved;
  paintRange(el[k]);
  engine.setChar({ [k]: +el[k].value });                  // движок ← восстановленное
  el[k].addEventListener('input', () => { localStorage.setItem('hearth.' + k, el[k].value); engine.setChar({ [k]: +el[k].value }); paintRange(el[k]); if (k === 'energy') setFlySpeed(+el[k].value); });
});
setFlySpeed(+el.energy.value);
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

calcLife();          // жизнь-тепло к первому кадру (визуал накопления запаркован в рейс-UI)
render(null);

// ---------- ОТБЛЕСК (только в расширении) ----------
// Порт держим открытым всё время жизни панели: его обрыв — это и есть сигнал «дом свернули».
// Права на страницы спрашиваем ЗДЕСЬ, по клику: человек уже понял, зачем они, и жест у нас есть
// (chrome.permissions.request без жеста браузер отклоняет).
if (IN_EXT) {
  engine.sync();                                   // панель могла открыться поверх уже горящего очага
  // Side panel при сворачивании язычком/крестиком МОЖЕТ сохранять DOM (не перезагружаться) — тогда при
  // развороте она показывает УСТАРЕВШЕЕ состояние (кнопка finish от давно завершённого рейса, старая звезда).
  // Досинхронизируемся с домом звука КАЖДЫЙ раз, когда панель снова видима (крит-узел 07-30).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) engine.sync(); });
  // ЗЕРКАЛО язычка (реш. автора 07-22): клик по язычку при открытой панели = закрыть её.
  // API закрыть панель не умеет — но страница панели может закрыть СЕБЯ.
  // Порт РВЁТСЯ при перезапуске service worker (MV3) — тогда фон думает «панель закрыта» и зеркало
  // «в каком-то сценарии не закрывает» (жалоба автора 07-30). Переподключаемся при обрыве, пока панель жива.
  let panelPort = null;
  function connectPanel() {
    panelPort = chrome.runtime.connect({ name: 'panel' });
    panelPort.onMessage.addListener((msg) => { if (msg && msg.type === 'closeHome') window.close(); });
    panelPort.onDisconnect.addListener(() => { panelPort = null; setTimeout(connectPanel, 250); });
  }
  connectPanel();

  const GLOW_ORIGINS = { origins: ['<all_urls>'] };
  el.glowrow.hidden = false;

  // Тумблер язычка — первая переключалка настроек очага (реш. автора 07-22).
  // ТРУБА-ИСТИНА = storage.glowEnabled (фон слушает onChanged; этот тумблер — единственный переключатель язычка).
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
    if (area === 'local' && ch.glowEnabled) paintGlowSwitch();   // glowEnabled сменился где-то ещё — тумблер узнал
  });
  paintGlowSwitch();
}
