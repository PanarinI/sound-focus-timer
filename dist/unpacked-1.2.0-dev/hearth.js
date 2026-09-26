// hearth.js — ПАНЕЛЬ. С 26.09 вид и поведение органов — со стенда lab/stend-vid-ot-zvuka-2026-09-26.html
// (слово автора: «нужно именно так, как сделано там»): дайл · ∞-режим · пресеты · четыре ручки · цвет шума
// вверху справа · зерно = видимый шум. Под этим — начинка продукта, которой на стенде нет:
// звук живёт в offscreen и переживает закрытие панели · фазы рейса (вход → плато → рассвет) · пауза ·
// просьба об оценке · счётчики · память ручек.
//
// ЛОГИКА ТАЙМЕРА (DECISIONS 26.09, четыре правила):
//   1. Длину задаёт только человек — дайлом. Пресет и цвет её не трогают.
//   2. ∞ — режим, а не длина: циферблата нет, отсчёта нет, звук идёт без конца.
//   3. Смена длины или режима на ходу перезапускает отсчёт с ПОЛНОЙ длины.
//   4. Finish и добежавший до нуля отсчёт закрывают рейс; следующий Start — снова с полной длины.
//      На нуле звук не обрывается, а уходит рассветом (закон звука: конец — приход света, не будильник).
// ЖЕСТЫ: Start/Finish — одна кнопка на одном месте · тап по звезде: в покое взлёт, в рейсе пауза/продолжить,
//   в угасании — оборвать в тишину сейчас.

const $ = (id) => document.getElementById(id);
const el = {};
['panel', 'star', 'num', 'dial', 'duga', 'prizrak', 'riski', 'podpisi', 'strelka', 'start', 'inf', 'colors',
 'knobs', 'dropbtn', 'droplist', 'krupa', 'stena', 'iskry', 'zvezdy', 'ramka', 'ratebar', 'rstars',
 'fast', 'premium', 'harmony', 'glowrow', 'glowtoggle', 'motionrow', 'motion']
  .forEach((id) => { el[id] = $(id); });

// Первое открытие панели вообще — смотрим ДО того, как что-либо записали (панель пишет hearth.opened ниже).
// Новому человеку ставим дефолтный пресет, как на стенде; у старых звук не трогаем (решение автора 25.09).
const FIRST_OPEN = !['hearth.opened', 'hearth.flown', 'hearth.dial', 'hearth.vol', 'hearth.sessions', 'hearth.preset']
  .some((k) => localStorage.getItem(k) !== null);

const SLEEP_AFTER = 10 * 60;             // забытая пауза → рейс тихо закрывается (сек; fast делит на 20)
const QUENCH = () => 0.4;                // Finish → почти мгновенный выдох (не 0, иначе щелчок)
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const inSession = (p) => ['собирание', 'ткань', 'ниточка'].includes(p);   // рейс идёт (включая паузу)
const fading = (p) => p === 'рассвет' || p === 'угасание';                // уход в тишину
const unit = () => (el.fast.checked ? 1 : 60);
const nowS = () => performance.now() / 1000;
let engine = null;                       // создаётся ниже, когда всё, что читает render, уже объявлено
const phaseNow = () => (engine ? engine.phase : 'off') || 'off';
const elapsedS = () => (engine.phase === 'ниточка' ? engine.pausedAt : (engine.sessionStart ? nowS() - engine.sessionStart : 0));

// ── СЧЁТЧИКИ (09-02). Шина — track.js, подключена мягко: нет файла → счётчиков нет, продукт цел.
const T = (n, d) => { try { if (typeof track === 'function') track(n, d); } catch (e) {} };
(function () {
  const K = 'hearth.opened';
  T('panel_open', { first: !localStorage.getItem(K) });
  localStorage.setItem(K, '1');
})();
const FLOWN_KEY = 'hearth.flown';

// storage.local, НЕ sync: у sync квота 120 записей в минуту, крутилка при перетаскивании её убьёт
const store = {
  get(k, d) {
    return new Promise((res) => {
      try { chrome.storage.local.get(k, (o) => res(o && o[k] != null ? o[k] : d)); }
      catch (e) { const s = localStorage.getItem(k); res(s === null ? d : s); }
    });
  },
  set(k, v) { try { chrome.storage.local.set({ [k]: v }); } catch (e) { localStorage.setItem(k, v); } },
};
const MIX_KEY = 'hearth.mix', COLOUR_KEY = 'hearth.colour', PRESET_KEY = 'hearth.preset';
const num = (k, d) => { const v = parseFloat(localStorage.getItem(k)); return isFinite(v) ? clamp01(v) : d; };

// ЕДИНЫЙ ИСТОЧНИК ЗНАЧЕНИЙ ЗВУКА: ручки, пресеты, зерно и движок читают отсюда — картинка не может
// разойтись со слышимым. vol · masking · energy — в localStorage (как было), mix и colour — в storage.local.
const S = {
  vol: num('hearth.vol', 0.5), masking: num('hearth.masking', 0.45), energy: num('hearth.energy', 0.4),
  mix: 0, colour: 'brown',
};

// ---------- ДЛИНА И РЕЖИМ ----------
const SCALE = [5, 15, 25, 45, 90], R = 112, CX = 180, CY = 120, TAU = Math.PI * 2;
const savedDial = localStorage.getItem('hearth.dial');
let infinite = localStorage.getItem('hearth.inf') === '1' || savedDial === 'Infinity';
let idx = SCALE.indexOf(+savedDial);
if (idx < 0) idx = 1;                    // дефолт 15′ (реш. автора 07-18: ADHD-канон 15/5, шанс долететь в первый раз)
function saveLen() {
  localStorage.setItem('hearth.dial', SCALE[idx]);
  localStorage.setItem('hearth.inf', infinite ? '1' : '');
}

// ---------- ДАЙЛ (стенд, дословно) ----------
const pt = (a) => [CX + R * Math.cos(a), CY + R * Math.sin(a)];
const ugol = (i) => Math.PI + (i / (SCALE.length - 1)) * Math.PI;
// линия от руки: дугу рисуем короткими отрезками со стабильным (не мигающим) дрожанием радиуса
const DROZH = Array.from({ length: 90 }, () => (Math.random() - 0.5) * 0.8);
const duga = (a0, a1) => {
  const n = Math.max(6, Math.round(Math.abs(a1 - a0) / Math.PI * 64));
  let d = '';
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = a0 + (a1 - a0) * k, r = R + DROZH[i % DROZH.length];
    d += (i ? ' L ' : 'M ') + (CX + r * Math.cos(a)).toFixed(1) + ' ' + (CY + r * Math.sin(a)).toFixed(1);
  }
  return d;
};
SCALE.forEach((v, i) => {
  const a = ugol(i), [x, y] = pt(a), [xi, yi] = [CX + (R - 11) * Math.cos(a), CY + (R - 11) * Math.sin(a)];
  const j = () => (Math.random() - 0.5) * 0.9;                        // лёгкая неровность: засечки чуть гуляют
  el.riski.insertAdjacentHTML('beforeend', `<line x1="${(x + j()).toFixed(1)}" y1="${(y + j()).toFixed(1)}" x2="${(xi + j()).toFixed(1)}" y2="${(yi + j()).toFixed(1)}" stroke-width="${(1.6 + Math.random() * 1).toFixed(1)}"/>`);
  const [xl, yl] = [CX + (R + 16) * Math.cos(a), CY + (R + 16) * Math.sin(a)];
  el.podpisi.insertAdjacentHTML('beforeend', `<text x="${xl.toFixed(1)}" y="${(yl + 4).toFixed(1)}">${v}</text>`);
});

// нарисованная рамка и редкие царапины — то, чего не бывает у сгенерированного прямоугольника
(() => {
  const w = 360, h = 660, m = 6, n = 46, drob = (x) => x + (Math.random() - 0.5) * 0.8;
  let d = '';
  for (let i = 0; i <= n; i++) {                       // обход по периметру с дрожанием
    const k = i / n * 4, s1 = Math.floor(k), f = k - s1;
    const p = [[m + (w - 2 * m) * f, m], [w - m, m + (h - 2 * m) * f], [w - m - (w - 2 * m) * f, h - m], [m, h - m - (h - 2 * m) * f]][s1 % 4];
    d += (i ? ' L ' : 'M ') + drob(p[0]).toFixed(1) + ' ' + drob(p[1]).toFixed(1);
  }
  let car = '';
  for (let i = 0; i < 7; i++) {                        // царапины на стекле
    const x = Math.random() * w, y = Math.random() * h, l = 8 + Math.random() * 26, a = Math.random() * Math.PI;
    car += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x + l * Math.cos(a)).toFixed(0)}" y2="${(y + l * Math.sin(a)).toFixed(0)}" stroke="#efe3d2" stroke-opacity=".05" stroke-width="1"/>`;
  }
  el.ramka.innerHTML = `<path d="${d} Z" fill="none" stroke="#3a322c" stroke-width="1"/>` + car;
})();

// звёзды стенда: 26 точек в верхних двух третях поля (стенд: 10…350 × 20…420 из 360×660 — здесь в долях окна)
for (let i = 0; i < 26; i++) el.zvezdy.insertAdjacentHTML('beforeend',
  `<i style="left:${((Math.random() * 340 + 10) / 3.6).toFixed(1)}%;top:${((Math.random() * 400 + 20) / 6.6).toFixed(1)}%;opacity:${(Math.random() * 0.4 + 0.2).toFixed(2)}"></i>`);

// композиция стенда 360×660: в окне ниже 660 px ужимается целиком, а не обрезается снизу
function vpisat() {
  const k = Math.min(1, (window.innerHeight || 660) / 660);
  document.documentElement.style.setProperty('--k', k.toFixed(3));
  if (typeof prosvet === 'function' && el.num.firstChild) requestAnimationFrame(prosvet);
}
vpisat();
window.addEventListener('resize', vpisat);

// ---------- ВИД = ФУНКЦИЯ ЗВУКА (стенд, дословно) ----------
// спектр → пространственная частота зерна · амплитуда → интенсивность · время → темп обновления.
const KRUPA = { brown: [30, 56], pink: [84, 154], white: [190, 348] };
const TON = { brown: [1, 0.80, 0.56], pink: [1, 0.86, 0.90], white: [0.94, 0.96, 1] };
const K = { krupa: el.krupa, stena: el.stena, iskry: el.iskry };
const C = { krupa: K.krupa.getContext('2d'), stena: K.stena.getContext('2d'), iskry: K.iskry.getContext('2d') };
let zernoTimer = 0;
// буфер зерна задан под поле стенда 360×660; окно другого размера получает буфер пропорционально,
// чтобы крупинка осталась той же величины в пикселях, а не растянулась
const razmer = (w, h) => [Math.max(1, Math.round(w * (el.panel.clientWidth || 360) / 360)),
                          Math.max(1, Math.round(h * (el.panel.clientHeight || 660) / 660))];

function sloi(ctx, cv, w, h, tint, jar, alpha) {
  cv.width = w; cv.height = h;
  const img = ctx.createImageData(w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 80 + Math.random() * jar;
    d[i] = v * tint[0]; d[i + 1] = v * tint[1]; d[i + 2] = v * tint[2]; d[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
}
function iskryKadr(ton) {
  const [w, h] = razmer(60, 110);
  K.iskry.width = w; K.iskry.height = h;
  C.iskry.clearRect(0, 0, w, h);
  const n = Math.round(ton * 9 * (w * h) / 6600);     // тон — событие поверх ровного: чем больше, тем чаще искры
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w | 0, y = Math.random() * h | 0, a = (0.35 + Math.random() * 0.65) * ton;
    C.iskry.fillStyle = `rgba(255,236,200,${a.toFixed(2)})`;
    C.iskry.fillRect(x, y, 1, 1);
    if (Math.random() < 0.3) {                         // редкая искра крупнее — акцент мотива
      C.iskry.fillStyle = `rgba(255,246,225,${(a * 0.6).toFixed(2)})`;
      C.iskry.fillRect(x - 1, y, 3, 1); C.iskry.fillRect(x, y - 1, 1, 3);
    }
  }
}
function kadr() {
  const [w, h] = razmer(...(KRUPA[S.colour] || KRUPA.brown)), tint = TON[S.colour] || TON.brown;
  sloi(C.krupa, K.krupa, w, h, tint, 160, Math.round(40 + 215 * S.vol));                // громкость → интенсивность
  sloi(C.stena, K.stena, ...razmer(40, 74), tint, 110, Math.round(210 * S.masking));    // маскировка → покрытие
  iskryKadr(S.mix);
}
// ВЫКЛЮЧАТЕЛЬ ДВИЖЕНИЯ (слово автора 26.09: «может кого-то раздражать»). Единственное исключение из закона
// «визуальных настроек нет»: это про удобство, а не про вкус. Выключен — зерно замирает (крупность, цвет и
// плотность по-прежнему от звука, но без мерцания), звезда не дышит. Кто не трогал — берём системное
// «уменьшить движение». Счётчик `setting_changed what=motion` покажет, сколько людей его выключают.
const TIHO_KEY = 'hearth.still';
let tiho = localStorage.getItem(TIHO_KEY) !== null
  ? localStorage.getItem(TIHO_KEY) === '1'
  : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function paintMotion() {
  document.body.classList.toggle('tiho', tiho);
  el.motion.classList.toggle('on', !tiho);
  el.motion.setAttribute('aria-checked', String(!tiho));
}
function setMotion(on) {
  tiho = !on;
  localStorage.setItem(TIHO_KEY, tiho ? '1' : '0');
  store.set(TIHO_KEY, tiho ? '1' : '0');              // копия для фона: язычок на страницах тоже перестаёт дышать
  paintMotion(); perevod();
  T('setting_changed', { what: 'motion', to: on ? 'on' : 'off' });
}
el.motionrow.addEventListener('click', (e) => { e.preventDefault(); setMotion(tiho); });
el.motion.addEventListener('keydown', (e) => {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault(); setMotion(tiho);
});
paintMotion();

// Перевод значений звука в картинку. Зерно живёт только в рейсе; на паузе замирает (таблица ZHURNAL 26.09).
function perevod() {
  const st = document.documentElement.style;
  st.setProperty('--oreol', (0.15 + 0.85 * S.vol * (1 - 0.35 * S.masking)).toFixed(2));   // громче — ярче, стена глушит
  st.setProperty('--mercanie', (0.4 + 1.4 * S.energy).toFixed(2));
  st.setProperty('--dyh', (8.5 - 5.5 * S.energy).toFixed(1) + 's');
  clearInterval(zernoTimer); zernoTimer = 0;
  const p = phaseNow();
  if (inSession(p) && p !== 'ниточка' && !tiho) zernoTimer = setInterval(kadr, Math.round(260 - 200 * S.energy));  // стимуляция → темп
  kadr();
}

// ---------- РИСОВКА СОСТОЯНИЯ (стенд: risui) ----------
const fmt = (sec) => `${Math.floor(sec / 60)}′ ${String(sec % 60).padStart(2, '0')}″`;
// сколько осталось до прибытия: длина рейса без хвоста рассвета минус прожитое (на паузе стоит)
const ostalos = () => Math.max(0, Math.ceil((engine.sessionDur - engine.DAWN) - elapsedS() - 0.05));
let vidFaza = null, vidT = 0;            // фаза, которую панель уже показала: жест отвечает сразу, не ждёт дом звука
const vid = () => vidFaza || phaseNow();

function paintNum() {
  const f = vid();
  let t = SCALE[idx] + '′';
  if (infinite) t = '∞';
  else if (f === 'собирание' && vidFaza) t = fmt(SCALE[idx] * unit());   // только что взлетели — отсчёт с полной длины
  else if (inSession(f) && engine.sessionDur) t = fmt(ostalos());
  el.num.firstChild.textContent = t;
  prosvet();
}
// Просвет в стрелке ровно под текстом цифры: меряем текст на экране и переводим в координаты шкалы
// (viewBox 360×150, вписан по центру). Работает при любом масштабе панели (--k) — оба прямоугольника экранные.
function prosvet() {
  const dyra = document.getElementById('dyra');
  if (!dyra) return;
  const r = document.createRange(); r.selectNodeContents(el.num.firstChild);
  const t = r.getBoundingClientRect(), d = el.dial.getBoundingClientRect();
  if (!t.width || !d.width) { dyra.setAttribute('width', 0); return; }
  const s = Math.min(d.width / 360, d.height / 150), ox = (d.width - 360 * s) / 2, oy = (d.height - 150 * s) / 2;
  const pad = 5;
  dyra.setAttribute('x', ((t.left - d.left - ox) / s - pad).toFixed(1));
  dyra.setAttribute('y', ((t.top - d.top - oy) / s - pad + 4).toFixed(1));
  dyra.setAttribute('width', (t.width / s + 2 * pad).toFixed(1));
  dyra.setAttribute('height', (t.height / s + 2 * pad - 8).toFixed(1));
}
function risui() {
  const a = ugol(idx), d = duga(Math.PI, a);
  el.duga.setAttribute('d', d);
  el.prizrak.setAttribute('d', d);                     // призрак: печатный след рядом с линией
  const [x, y] = [CX + (R - 14) * Math.cos(a), CY + (R - 14) * Math.sin(a)];
  el.strelka.setAttribute('x2', x.toFixed(1)); el.strelka.setAttribute('y2', y.toFixed(1));
  el.dial.setAttribute('aria-valuenow', String(SCALE[idx]));
  paintNum();
  el.inf.classList.toggle('on', infinite);
  el.inf.setAttribute('aria-pressed', String(infinite));
  document.body.classList.toggle('inf-on', infinite);   // ∞ — режим: циферблата нет вовсе
  const idet = inSession(vid());
  el.start.innerHTML = idet ? '☀&nbsp; Finish' : '▶&nbsp; Start';
  document.body.classList.toggle('idet', idet);
  const k = idet ? 1 : 0.55;
  el.star.style.width = el.star.style.height = (150 + 140 * k) + 'px';
  el.star.style.opacity = idet ? 1 : 0.8;
}
let tik = 0;
function tikTak() {                                    // отсчёт идёт только в рейсе с концом
  clearInterval(tik); tik = 0;
  if (inSession(vid()) && !infinite) tik = setInterval(paintNum, 250);
}

// ---------- ПРОЖИТОЕ (данные для просьбы об оценке; картинки накопления в этой панели нет) ----------
const embers = JSON.parse(localStorage.getItem('hearth.embers') || '[]');
function dropEmber(focusSec) {
  const min = Math.max(0.2, focusSec / unit());
  embers.push({ ts: Date.now(), min: +min.toFixed(1) });
  localStorage.setItem('hearth.embers', JSON.stringify(embers));
  // зачтённый рейс (≥ ASK_MIN_MIN «минуты») — топливо просьбы об оценке; тычок «послушать» не считается
  if (min >= ASK_MIN_MIN) {
    localStorage.setItem('hearth.sessions', String(+(localStorage.getItem('hearth.sessions') || 0) + 1));
    if (askReady()) askArmed = true;
    setTimeout(syncAsk, 0);
  }
}

// ---------- ПРОСЬБА ОБ ОЦЕНКЕ (реш. автора 07-22 · паттерн ExportGPT 08-09 · две громкости 08-10) ----------
// Тихая плашка в углу — дверь с первого открытия; карточка поверх звезды — просьба с третьего рейса.
// ≥4★ → отзывы CWS · 1–3★ → форма фидбека. Первый ответ закрывает просьбу навсегда.
const ASK_AFTER = 3, BAR_AFTER = 0, ASK_MIN_MIN = 1;
const RATE_URL = 'https://chromewebstore.google.com/detail/minimalist-timer/miknhphoakphfhgjajhkalmpdnadkeic/reviews';
const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfTyBVwYzmT3Pvhj0xsmcgE3OzKnR5qCjEeR6HOLIU5msrwkg/viewform';  // форма автора (07-22)
const flights = () => +(localStorage.getItem('hearth.sessions') || 0);
const rateOpen = () => !!(RATE_URL || FEEDBACK_URL) && !localStorage.getItem('hearth.rated');
const askReady = () => rateOpen() && flights() >= ASK_AFTER;
const barReady = () => rateOpen() && flights() >= BAR_AFTER;
let askArmed = false, askCard = null, askVeil = null;

function makeStars(host) {
  for (let n = 1; n <= 5; n++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'rstar'); s.dataset.n = n;
    s.innerHTML = '<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" fill="currentColor"/>';
    s.addEventListener('mouseenter', () => host.querySelectorAll('.rstar').forEach((x) => x.classList.toggle('lit', +x.dataset.n <= n)));
    s.addEventListener('mouseleave', () => host.querySelectorAll('.rstar').forEach((x) => x.classList.remove('lit')));
    s.addEventListener('click', (e) => { e.stopPropagation(); answerRate(n); });
    host.appendChild(s);
  }
}
function answerRate(n) {
  const url = n >= 4 ? (RATE_URL || FEEDBACK_URL) : (FEEDBACK_URL || RATE_URL);
  localStorage.setItem('hearth.rated', '1');
  T('rate_answer', { stars: n });
  askArmed = false;
  syncAsk();
  if (url) window.open(url, '_blank');
}
makeStars(el.rstars);
function buildAsk() {
  askVeil = document.createElement('div');
  askVeil.id = 'askveil';
  askVeil.addEventListener('pointerup', dismissAsk);   // клик в стороне = «не сейчас»: рейс НЕ поднимаем
  askCard = document.createElement('div');
  askCard.className = 'askcard';
  askCard.innerHTML = '<span class="alab">How was the experience?</span><span class="astars"></span>'
                    + '<span class="later">Not now</span>';
  makeStars(askCard.querySelector('.astars'));
  askCard.querySelector('.later').addEventListener('click', dismissAsk);
  el.panel.append(askVeil, askCard);                   // внутри поля: вуаль ниже органов управления (z 3 < 4)
}
function dismissAsk() { askArmed = false; syncAsk(); }
function syncAsk(phase) {                              // одна просьба на экране, и только в покое
  const rest = (phase || phaseNow()) === 'off';
  const up = !!(askArmed && rest && askReady());
  if (up && !askCard) buildAsk();
  if (askCard) {
    askCard.style.display = up ? 'flex' : 'none';
    askVeil.style.display = up ? 'block' : 'none';
  }
  el.ratebar.hidden = !(rest && barReady() && !up);
}

// ---------- РЕЙС ----------
let sleepTimer = 0, pendingEmber = null;
function sessionLen() { return infinite ? 9e7 : SCALE[idx] * unit() + engine.DAWN; }
function pokazat(faza) {                               // жест отвечает сразу; дом звука подтвердит своим состоянием
  vidFaza = faza; vidT = Date.now(); risui(); tikTak(); perevod(); syncAsk(faza);
}
function start() {
  localStorage.setItem(FLOWN_KEY, '1');
  T('flight_start', { len: infinite ? 'inf' : SCALE[idx] });
  engine.turnOn();
  engine.startSession(sessionLen());
  pokazat('собирание');
}
// Правило 3: смена длины или режима на ходу — отсчёт заново с полной длины (без «продолжим с середины»).
function perezapusk() {
  clearTimeout(sleepTimer);
  engine.startSession(sessionLen());
  pokazat('собирание');
}
function quench() {                                    // Finish: быстрый выдох, рейс закрыт целиком
  clearTimeout(sleepTimer);
  pendingEmber = Math.max(0, elapsedS());
  engine.extinguish(QUENCH());
  pokazat('угасание');
}
function killNow() {                                   // клик во время угасания: оборвать в тишину СЕЙЧАС
  const focus = pendingEmber != null ? pendingEmber : Math.max(0, elapsedS() - engine.DAWN);
  T('flight_end', { how: 'aborted', min: +(Math.max(0, focus) / unit()).toFixed(1), len: infinite ? 'inf' : SCALE[idx] });
  pendingEmber = null;
  dropEmber(Math.max(0, focus));
  engine.turnOff();
  pokazat('off');
}
function pauza() {                                     // тап по звезде в рейсе: тишина сразу, зерно замирает
  engine.pause();
  T('pause', { at_min: +(elapsedS() / unit()).toFixed(1) });
  clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => {                      // забыл вернуться → рейс тихо закрылся, слепок честен
    if (engine.phase === 'ниточка') {
      T('flight_end', { how: 'slept', min: +(Math.max(0, engine.pausedAt) / unit()).toFixed(1), len: infinite ? 'inf' : SCALE[idx] });
      dropEmber(Math.max(0, engine.pausedAt)); engine.turnOff();
    }
  }, (el.fast.checked ? SLEEP_AFTER / 20 : SLEEP_AFTER) * 1000);
  pokazat('ниточка');
}
function tapStar() {
  const p = phaseNow();
  if (p === 'off' || p === 'ручей') start();
  else if (p === 'собирание' || p === 'ткань') pauza();
  else if (p === 'ниточка') { clearTimeout(sleepTimer); engine.resume(); pokazat('ткань'); }
  else if (fading(p)) killNow();
}
el.star.addEventListener('click', tapStar);
el.start.addEventListener('click', () => {
  const p = phaseNow();
  if (inSession(p)) quench();
  else { if (fading(p)) killNow(); start(); }
});

// ---------- ДАЙЛ И ∞ ----------
function setLen(i, inf) {
  i = Math.max(0, Math.min(SCALE.length - 1, i | 0));
  if (i === idx && inf === infinite) return;
  idx = i; infinite = inf; saveLen();
  if (inSession(phaseNow())) perezapusk();             // на ходу — отсчёт заново с полной длины
  else risui();
}
function vzyat(e) {
  const r = el.dial.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * 360, y = (e.clientY - r.top) / r.height * 150;
  let a = Math.atan2(y - CY, x - CX);
  if (a < 0) a += TAU;
  if (a < Math.PI) a = a < Math.PI / 2 ? TAU : Math.PI;
  setLen(Math.round((a - Math.PI) / Math.PI * (SCALE.length - 1)), false);
}
el.dial.addEventListener('pointerdown', (e) => { el.dial.setPointerCapture(e.pointerId); vzyat(e); });
el.dial.addEventListener('pointermove', (e) => { if (e.buttons) vzyat(e); });
el.dial.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setLen(idx + 1, false);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setLen(idx - 1, false);
  else return;
  e.preventDefault();
});
el.inf.addEventListener('click', () => setLen(idx, !infinite));

// ---------- ЦВЕТ ШУМА: и звук, и температура света, и крупность зерна ----------
const COLOURS = ['brown', 'pink', 'white'];
function paintColour(c) {
  const st = document.documentElement.style;
  [...el.colors.children].forEach((b) => {
    const on = b.dataset.c === c;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1;
    if (on) { st.setProperty('--warm', b.dataset.w); st.setProperty('--warm-soft', b.dataset.s); }
  });
}
function setColour(c, rukoj) {
  S.colour = COLOURS.includes(c) ? c : 'brown';
  paintColour(S.colour); engine.setColour(S.colour); store.set(COLOUR_KEY, S.colour);
  if (rukoj) { presetCustom(); T('setting_changed', { what: 'colour', to: S.colour }); }
  perevod();
}
el.colors.addEventListener('click', (e) => { const b = e.target.closest('b'); if (b) setColour(b.dataset.c, true); });
el.colors.addEventListener('keydown', (e) => {         // радиогруппа: стрелки листают цвета
  const d = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
  if (!d) return;
  e.preventDefault();
  const next = COLOURS[(COLOURS.indexOf(S.colour) + d + COLOURS.length) % COLOURS.length];
  setColour(next, true);
  el.colors.querySelector(`[data-c="${next}"]`).focus();
});

// ---------- РУЧКИ (стенд: дуга от руки; логика — продукта, решение 08-24 по голосу 3) ----------
// ось встаёт по первому заметному движению (>4 px) и до конца перетаскивания не меняется;
// вверх и вправо прибавляют; 150 px — весь ход; колесо ±0,04; стрелки ±0,02; Home/End.
const KNOB_KEYS = ['vol', 'masking', 'energy', 'mix'];
const knobs = {}, saveT = {};
function knobInput(key, v) {
  presetCustom();                                      // тронул руками — это уже не пресет
  if (key === 'mix') {
    engine.setMix(v);
    clearTimeout(saveT.mix);                           // тащат ручку — пишем по остановке, не каждый кадр
    saveT.mix = setTimeout(() => { store.set(MIX_KEY, v); T('setting_changed', { what: 'tone', to: +v.toFixed(2) }); }, 300);
  } else {
    localStorage.setItem('hearth.' + key, v);
    engine.setChar({ [key === 'vol' ? 'volume' : key]: v });
    if (key !== 'vol') {                               // громкость шина не пишет (так было и раньше)
      clearTimeout(saveT[key]);
      saveT[key] = setTimeout(() => T('setting_changed', { what: key, to: +v.toFixed(2) }), 400);
    }
  }
  perevod();
}
[...el.knobs.querySelectorAll('.knob')].forEach((k, i) => {
  const key = KNOB_KEYS[i];
  const dr = Array.from({ length: 40 }, () => (Math.random() - 0.5) * 0.55);   // своё дрожание у каждой ручки
  const put = () => {
    const v = S[key], a0 = Math.PI * 0.85, a1 = Math.PI * 2.15;
    const a = a0 + (a1 - a0) * v, cx = 48, cy = 46, n = Math.max(4, Math.round(v * 34));
    let d = '';
    for (let j = 0; j <= n; j++) {
      const aa = a0 + (a - a0) * (j / n), rr = 28 + dr[j % dr.length];
      d += (j ? ' L ' : 'M ') + (cx + rr * Math.cos(aa)).toFixed(1) + ' ' + (cy + rr * Math.sin(aa)).toFixed(1);
    }
    k.querySelector('.fill').setAttribute('d', d);
    k.setAttribute('aria-valuenow', Math.round(v * 100));
  };
  knobs[key] = { put };
  k.tabIndex = 0;
  let dragX = 0, dragY = 0, valFrom = 0, axis = null;
  const set = (nv) => {
    const c = clamp01(nv);
    if (c === S[key]) return;
    S[key] = c; put(); knobInput(key, c);
  };
  k.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); k.setPointerCapture(e.pointerId);
    dragX = e.clientX; dragY = e.clientY; valFrom = S[key]; axis = null; k.focus();
  });
  k.addEventListener('pointermove', (e) => {
    if (!k.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - dragX, dy = e.clientY - dragY;
    if (!axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 4) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    set(valFrom + (axis === 'y' ? -dy : dx) / 150);
  });
  ['pointerup', 'pointercancel'].forEach((t) => k.addEventListener(t, (e) => {
    if (k.hasPointerCapture(e.pointerId)) k.releasePointerCapture(e.pointerId);
  }));
  k.addEventListener('wheel', (e) => { e.preventDefault(); set(S[key] - Math.sign(e.deltaY) * 0.04); }, { passive: false });
  k.addEventListener('keydown', (e) => {
    const K2 = e.key;
    if (K2 === 'ArrowUp' || K2 === 'ArrowRight') set(S[key] + 0.02);
    else if (K2 === 'ArrowDown' || K2 === 'ArrowLeft') set(S[key] - 0.02);
    else if (K2 === 'Home') set(0); else if (K2 === 'End') set(1);
    else return;
    e.preventDefault();
  });
  put();
});

// ---------- ПРЕСЕТЫ: комната целиком, одним касанием (стенд, вторая редакция 26.09) ----------
// [громкость, маскировка, стимуляция, тон] + цвет. Длину и режим НЕ трогают: пресет — про комнату,
// длина — про время человека. Основания значений — разбор домена в SOUND.md 26.09.
const PRESETY = {
  office:   { cvet: 'brown', v: [0.62, 0.92, 0.45, 0.15] },  // чужая речь рядом: стена шире всего, шум ровный
  dorm:     { cvet: 'brown', v: [0.72, 1.00, 0.50, 0.10] },  // сосед за стеной, низы и телевизор: максимум стены
  cafe:     { cvet: 'pink',  v: [0.46, 0.55, 0.55, 0.30] },  // гул приятный, не глушим — подмешиваемся
  reading:  { cvet: 'brown', v: [0.40, 0.35, 0.25, 0.20] },  // тихо вокруг: ровность важнее стены
  thoughts: { cvet: 'brown', v: [0.55, 0.50, 0.70, 0.35] },  // шумно внутри: больше стимуляции, чтобы внимание держалось
  overload: { cvet: 'pink',  v: [0.50, 0.70, 0.15, 0.10] },  // сенсорная перегрузка: тише и мягче
};
function paintPreset(key) {
  const li = [...el.droplist.children].find((n) => n.dataset.p === key);
  el.dropbtn.textContent = li ? li.textContent : 'custom';
  [...el.droplist.children].forEach((n) => n.classList.toggle('on', n === li));
}
function presetCustom() {
  if (localStorage.getItem(PRESET_KEY) === 'custom' && el.dropbtn.textContent === 'custom') return;
  localStorage.setItem(PRESET_KEY, 'custom');
  paintPreset('custom');
}
function stavPreset(key, tiho) {
  const P = PRESETY[key]; if (!P) return;
  KNOB_KEYS.forEach((k, i) => { S[k] = P.v[i]; knobs[k].put(); });
  localStorage.setItem('hearth.vol', S.vol);
  localStorage.setItem('hearth.masking', S.masking);
  localStorage.setItem('hearth.energy', S.energy);
  store.set(MIX_KEY, S.mix);
  engine.setChar({ volume: S.vol, masking: S.masking, energy: S.energy });
  engine.setMix(S.mix);
  setColour(P.cvet, false);                            // и звук, и свет, и зерно; внутри — perevod()
  localStorage.setItem(PRESET_KEY, key);
  paintPreset(key);
  if (!tiho) T('setting_changed', { what: 'preset', to: key });
}
el.dropbtn.addEventListener('click', (e) => { e.stopPropagation(); el.droplist.hidden = !el.droplist.hidden; });
document.addEventListener('click', () => { el.droplist.hidden = true; });
el.droplist.addEventListener('click', (e) => {
  const li = e.target.closest('li'); if (!li) return;
  e.stopPropagation(); el.droplist.hidden = true; stavPreset(li.dataset.p);
});

// ---------- СОСТОЯНИЕ ОТ ДОМА ЗВУКА ----------
let lastPhase = null;
function render(st) {
  const phase = st ? st.phase : 'off';
  syncAsk(phase);
  if (st && st.justEnded) {                            // конец (рассвет ИЛИ выдох догорел) → слепок + тишина
    const focus = pendingEmber != null ? pendingEmber : Math.max(0, elapsedS() - engine.DAWN);
    dropEmber(Math.max(0, focus));
    pendingEmber = null;
    engine.turnOff();
    return;
  }
  let force = false;
  if (vidFaza) {
    // Жест уже показан; дом звука отвечает с задержкой и сперва может прислать прежнее состояние.
    // Назад не мигаем, пока он не догонит, но и не ждём вечно: команда могла не дойти.
    const dognal = phase === vidFaza || (vidFaza === 'собирание' && phase === 'ткань');
    if (!dognal && Date.now() - vidT < 1500) return;
    vidFaza = null; force = true;
  }
  if (force || phase !== lastPhase) {
    lastPhase = phase;
    risui(); tikTak(); perevod();
  }
}

// ---------- ДВИЖОК ----------
// В расширении звук живёт в offscreen-документе и переживает закрытие панели (remote.js — тот же контракт).
// На локальном стенде (file://, localhost) chrome.runtime нет — движок работает прямо здесь.
const IN_EXT = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
engine = IN_EXT ? new RemoteEngine(render) : new AudioEngine(render);
function applyFast() { if (el.fast.checked) { engine.GATHER = 3; engine.DAWN = 4; } else { engine.GATHER = 90; engine.DAWN = 40; } }
el.fast.addEventListener('change', applyFast); applyFast();
el.premium.addEventListener('change', () => engine.setTier(el.premium.checked ? 'premium' : 'basic'));
el.harmony.addEventListener('input', () => engine.setHarmony(+el.harmony.value));

// ---------- СТАРТ ПАНЕЛИ ----------
engine.setChar({ volume: S.vol, masking: S.masking, energy: S.energy });   // движок ← восстановленное
if (FIRST_OPEN) {
  stavPreset('office', true);                          // дефолт — самый частый контекст (как на стенде)
} else {
  paintPreset(localStorage.getItem(PRESET_KEY) || 'custom');
  // store.get в localStorage-ветке отдаёт строку — приводим тут
  store.get(MIX_KEY, 0).then((v) => { S.mix = clamp01(+v || 0); knobs.mix.put(); engine.setMix(S.mix); perevod(); });
  store.get(COLOUR_KEY, 'brown').then((c) => { S.colour = COLOURS.includes(c) ? c : 'brown'; paintColour(S.colour); engine.setColour(S.colour); perevod(); });
}
risui(); perevod(); render(null);

// ---------- ОТБЛЕСК И СИНХРОН (только в расширении) ----------
if (IN_EXT) {
  store.set(TIHO_KEY, tiho ? '1' : '0');               // фону — движение как есть сейчас (в т.ч. системное «уменьшить»)
  engine.sync();                                       // панель могла открыться поверх уже идущего рейса
  // Side panel при сворачивании МОЖЕТ сохранять DOM — досинхронизируемся каждый раз, когда она снова видима.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) engine.sync(); });
  // ЗЕРКАЛО язычка: клик по язычку при открытой панели = закрыть её. Порт рвётся при перезапуске
  // service worker (MV3) — переподключаемся, пока панель жива.
  let panelPort = null;
  function connectPanel() {
    panelPort = chrome.runtime.connect({ name: 'panel' });
    panelPort.onMessage.addListener((msg) => { if (msg && msg.type === 'closeHome') window.close(); });
    panelPort.onDisconnect.addListener(() => { panelPort = null; setTimeout(connectPanel, 250); });
  }
  connectPanel();

  // Тумблер язычка: жил в Settings старой панели, с 26.09 — маленький переключатель в левом нижнем углу
  // (слово автора). Только в расширении: на локальном стенде язычка нет. Права на страницы спрашиваем
  // по клику — без жеста chrome.permissions.request браузер отклоняет.
  if (el.glowrow && el.glowtoggle) {
    const GLOW_ORIGINS = { origins: ['<all_urls>'] };
    el.glowrow.hidden = false;
    const glowState = async () => {
      const [{ glowEnabled = true }, has] = await Promise.all([
        chrome.storage.local.get({ glowEnabled: true }),
        chrome.permissions.contains(GLOW_ORIGINS),
      ]);
      return { on: glowEnabled && has, has };
    };
    const paintGlowSwitch = async () => {
      const { on } = await glowState();
      el.glowtoggle.classList.toggle('on', on);
      el.glowtoggle.setAttribute('aria-checked', String(on));
    };
    const flipGlow = async () => {
      const { on, has } = await glowState();
      if (on) await chrome.storage.local.set({ glowEnabled: false });
      else {
        const ok = has || await chrome.permissions.request(GLOW_ORIGINS);   // системное окно; отказ — остаёмся выкл
        if (ok) await chrome.storage.local.set({ glowEnabled: true });
      }
      paintGlowSwitch();
    };
    el.glowrow.addEventListener('click', (e) => { e.preventDefault(); flipGlow(); });
    el.glowtoggle.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault(); flipGlow();
    });
    chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.glowEnabled) paintGlowSwitch(); });
    paintGlowSwitch();
  }
}
