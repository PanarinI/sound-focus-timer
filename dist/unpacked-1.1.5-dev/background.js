// background.js — клик по иконке-угольку открывает дом-очаг (side panel = hearth.html).
// Лестница присутствия (STATE ⚑): тулбар-иконка → нативная Chrome Side Panel.
// Звук живёт в offscreen-документе (offscreen.js) и переживает закрытие панели: дом свернулся — очаг горит.

// рисование иконки-таймера — общий файл с лабораторным стендом (lab/icon-stand.html),
// чтобы автор видел на стенде ровно то, что уедет в продукт («инструмент = явь»).
// ⚠️ zip собирается РУКАМИ по списку файлов: если icon.js забыть, непойманный importScripts
// уронит весь service worker, а с ним и всё расширение. Поэтому — под try: без файла
// продукт просто останется без иконки-таймера, а рейс и звук будут работать как раньше.
// `icon.js` больше НЕ подключается: с 08-27 иконка в полёте не подменяется дугой — звезда стоит
// всегда, а остаток говорит табло. Файл оставлен в проекте ради стенда `lab/icon-stand.html`,
// в сборку он не входит и в service worker не грузится.

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Прощальная страница (канон 3.2:51 — причины удаления собираем формой; паттерн ExportGPT).
// Дев-пакет несёт `version_name: <в>-dev` (см. lab/build-zip.sh). По этой метке он НЕ трогает ни
// welcome, ни uninstall-страницу: иначе каждая `load unpacked` автора открывала welcome и умами
// записывал её как установку из Грузии, а снос дев-копии — как посещение страницы удаления.
// Прод от этого не меняется ни на байт (у него version_name нет вовсе).
const IS_DEV = ((chrome.runtime.getManifest().version_name) || '').includes('-dev');
if (!IS_DEV) chrome.runtime.setUninstallURL('https://panarini.github.io/focus-pages/uninstall/').catch(() => {});

// ---------- ДОМ ЗВУКА ----------
// Панель просит поднять offscreen перед первой командой движку. createDocument падает, если документ
// уже есть или если два запроса пришли одновременно, — поэтому храним промис и всегда сверяемся с hasDocument.
let creatingOffscreen = null;

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Keeps the generative focus sound playing while the side panel is closed.'
    }).finally(() => { creatingOffscreen = null; });
  }
  await creatingOffscreen;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.target !== 'bg') return;

  if (msg.type === 'ensureOffscreen') {
    ensureOffscreen().then(() => reply({ ok: true })).catch((e) => reply({ ok: false, error: String(e) }));
    return true;                                    // ответ придёт асинхронно
  }

  // Клик по язычку — дверь домой (реш. автора 07-22: язычок = ТОЛЬКО дверь).
  // sidePanel.open() требует жеста пользователя. Правила выживания жеста через messaging:
  // вызывать СИНХРОННО в листенере (ни одного await до) + форма { tabId } (проверенный паттерн).
  // Отказ больше не глотаем: точный текст — в консоль SW и в ответ язычку (он качнёт «нет»).
  if (msg.type === 'openHome') {
    // ЗЕРКАЛО (реш. автора 07-22, «логика не зеркальная»): дом уже открыт → тот же клик его закрывает.
    if (panelOpen && panelPort) {
      try { panelPort.postMessage({ type: 'closeHome' }); } catch (e) { /* порт умер — упадём в open ниже */ }
      reply({ ok: true });
      return;                                        // ответ отдан синхронно
    }
    const tabId = sender.tab && sender.tab.id;
    const windowId = sender.tab && sender.tab.windowId;
    chrome.sidePanel.open(tabId != null ? { tabId } : { windowId })
      .then(() => reply({ ok: true }))
      .catch((e) => {
        console.error('[ember] sidePanel.open отказ (форма tabId):', String(e));
        // запасная форма — окно целиком; если жест ещё жив, откроет
        chrome.sidePanel.open({ windowId })
          .then(() => reply({ ok: true }))
          .catch((e2) => {
            console.error('[ember] sidePanel.open отказ (форма windowId):', String(e2));
            reply({ ok: false, error: String(e2) });
          });
      });
    return true;
  }
});

// ---------- ЯЗЫЧОК-ДВЕРЬ ----------
// ПОСТОЯННАЯ дверь (реш. автора 07-24): виден, пока включён тумблером и даны права — тускло тлеет
// в покое, разгорается в сессии. Прежде появлялся ТОЛЬКО в сессии → человек не находил дверь на
// свежей вкладке («надо сперва запустить таймер»). Object-permanence ядра (портрет Ре): дверь всегда на месте.
// Права опциональные — пока человек их не дал, весь этот блок молча ничего не делает.

let panelOpen = false;
let panelPort = null;                                // живой порт панели — через него зеркало язычка
let sound = { phase: 'off', heat: 0 };
let glowLit = false;

// Тумблер язычка (реш. автора 07-22: опциональность). ТРУБА-ИСТИНА = chrome.storage.local.glowEnabled:
// крестик на язычке пишет false, тумблер в настройках очага — true/false; фон только слушает.
let glowEnabled = true;
let glowReady = false;                               // истина из storage ещё не пришла → не трогаем язычок (без мигания на старте SW)
chrome.storage.local.get({ glowEnabled: true }).then((v) => { glowEnabled = !!v.glowEnabled; glowReady = true; syncGlow(); });
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local' || !ch.glowEnabled) return;
  glowEnabled = !!ch.glowEnabled.newValue;
  syncGlow();                                        // выключили → shouldBurn падает → гасим везде
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panel') return;
  panelOpen = true;                                  // дом открыт — язычок ОСТАЁТСЯ (дверь в обе стороны)
  panelPort = port;
  syncGlow();
  port.onDisconnect.addListener(() => { panelOpen = false; panelPort = null; syncGlow(); });
});

// состояние движка летит из offscreen в панель — фон слушает тот же поток
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== 'panel' || !msg.state) return;
  sound = { phase: msg.state.phase, heat: Math.max(0, Math.min(1, msg.state.depth || 0)) };
  syncGlow();
  paintAction(msg.state);
});

// ─────────────────────────────────────────────────────────────────────────
// ИКОНКА-ТАЙМЕР. Присутствие времени без единого впрыска в чужие страницы:
// рисуем дугу прямо на иконке расширения. Видно всегда, на любой вкладке,
// даже когда панель свёрнута и открыто вообще всё что угодно.
//
// ЗАКОН (тот же, что у звука): показываем ОСТАВШИЙСЯ ПУТЬ, а не утекающее время.
// Никаких цифр, никакого красного, никакого ускорения к финалу — «сопровождает,
// не наказывает». Постоянно видимый обратный отсчёт давит, дуга остатка — нет.
// ─────────────────────────────────────────────────────────────────────────
let badgeLast = null;   // последняя показанная цифра табло

// ТАБЛО (08-24). Цифра остатка живёт СНАРУЖИ сцены — на иконке, в хроме браузера, где человек и ищет
// статус, и видна на любой вкладке даже при закрытой панели. Внутри панели отсчёта по-прежнему нет:
// закон 07-25 написан про переживание ПОЛЁТА, и он цел — но «сколько осталось» перестало быть
// невидимым. Дуга остаётся расстоянием, число отвечает на вопрос словами.
function paintBadge(left, phase) {
  let text = '';
  if (phase && phase !== 'off' && left > 0) {
    text = left > 6e5 ? '∞' : String(Math.max(1, Math.ceil(left / 60)));   // ∞-рейс числом не меряется
  }
  if (text === badgeLast) return;
  badgeLast = text;
  chrome.action.setBadgeText({ text }).catch(() => {});
  if (text) {
    chrome.action.setBadgeBackgroundColor({ color: '#2a2119' }).catch(() => {});
    if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: '#e8b25c' }).catch(() => {});
  }
}

function paintAction(state) {
  try {
    const phase = state.phase;
    // ИКОНКА НЕ МЕНЯЕТСЯ (реш. автора 08-27). До этого в полёте родная звезда подменялась дугой
    // остатка (`icon.js`, 1.1.0) — получалось, что в покое у расширения одна иконка, а в рейсе
    // другая, и человек видел два разных значка одного продукта. Теперь звезда стоит всегда,
    // а «сколько осталось» говорит ТАБЛО рядом с ней. Одна вещь — один облик.
    paintBadge(Math.max(0, +state.left || 0), phase);
  } catch (e) { /* табло — украшение: его падение не должно ронять рейс */ }
}

const glowAllowed = () => chrome.permissions.contains({ origins: ['<all_urls>'] });

async function eachTab(fn) {
  const tabs = await chrome.tabs.query({});          // без permission "tabs": id есть, url нет — и не нужен
  await Promise.all(tabs.map((t) => fn(t).catch(() => {})));   // служебные страницы откажут — это норма
}

async function syncGlow() {
  // Язычок = ПОСТОЯННАЯ дверь: виден, пока включён тумблером (glowEnabled) и даны права,
  // НЕЗАВИСИМО от сессии и панели. Покой = тлеет (heat 0), сессия = разгорается (pushGlowState кормит жар).
  const shouldShow = glowEnabled;
  if (!shouldShow) {
    // ВЫКЛЮЧЕНИЕ — всегда обходим вкладки, НЕ доверяя кэшу glowLit. Почему (крит-узел 08-01):
    // service worker в MV3 умирает через ~30с и перезапускается со сбросом glowLit→false, а язычок
    // в DOM страницы смерть воркера ПЕРЕЖИВАЕТ. Прежний ранний return при «shouldShow===glowLit»
    // (false===false) считал «уже выключено» и оставлял сироту → тумблер «срабатывал со 2-й попытки».
    // ensureGlowInTab при glowLit=false сам шлёт 'off' живому и сносит скриптом-уборщиком сироту.
    glowLit = false;
    await eachTab((t) => ensureGlowInTab(t.id));
    return;
  }
  if (!(await glowAllowed())) { glowLit = false; return; }
  if (glowLit) { pushGlowState(); return; }           // уже показан — только освежим яркость
  glowLit = true;
  await eachTab((t) => ensureGlowInTab(t.id));         // пинг-сначала: живой не переливаем (без дублей)
}

function pushGlowState() {
  const paused = sound.phase === 'ниточка';
  const active = sound.phase !== 'off';              // идёт ли рейс — язычок в покое должен ПОТУХНУТЬ (жалоба автора 08-01)
  eachTab((t) => chrome.tabs.sendMessage(t.id, { target: 'glow', type: 'state', heat: sound.heat, paused, active }));
}

// Довести язычок в ОДНОЙ вкладке до правды текущего состояния.
// Зачем отдельно: Chrome замораживает фоновые вкладки (Memory Saver/freezing) — они просыпают
// рассылки состояния и «off». Ощущение автора 07-22: «на других вкладках язычок мёртвый рудимент».
// Лекарство: в момент, когда человек СМОТРИТ на вкладку (activated/focus), досылаем правду.
async function ensureGlowInTab(tabId) {
  try {
    if (!glowReady) return;                          // истина из storage ещё не пришла — не сносим дверь зря
    if (!glowLit) {
      // Сессии нет (или язычок выключен) → застрявший язычок убрать. Живому шлём «off» (уезд с анимацией);
      // сирота прошлого поколения экста рассылок НЕ слышит — его сносим скриптом-уборщиком.
      try {
        await chrome.tabs.sendMessage(tabId, { target: 'glow', type: 'off' });
      } catch (e) {
        if (await glowAllowed()) {
          await chrome.scripting.executeScript({
            target: { tabId },
            func: () => { const h = document.getElementById('__ember_glow_host'); if (h) h.remove(); }
          });
        }
      }
      return;
    }
    if (!(await glowAllowed())) return;
    // Пинг-сначала: живой язычок ТЕКУЩЕГО поколения ответит — скрипт не переливаем (иначе с каждым
    // executeScript копится лишний слушатель в том же isolated world). Молчание = язычка нет ИЛИ там
    // сирота прошлого поколения (его слушатель отвязан) → вливаем glow.js, он усыновит место.
    let alive = false;
    try {
      const r = await chrome.tabs.sendMessage(tabId, { target: 'glow', type: 'ping' });
      alive = !!(r && r.alive);
    } catch (e) { /* некому отвечать */ }
    if (!alive) await chrome.scripting.executeScript({ target: { tabId }, files: ['glow.js'] });
    // await обязателен: без него отказ вкладки без слушателя = unhandled rejection
    // («Receiving end does not exist» — шум в консоли SW, узел 07-22)
    await chrome.tabs.sendMessage(tabId, { target: 'glow', type: 'state', heat: sound.heat, paused: sound.phase === 'ниточка' });
  } catch (e) { /* служебная страница или вкладка без слушателя — это норма */ }
}

// вкладка, открытая/перезагруженная посреди сессии
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete' && glowLit) ensureGlowInTab(tabId);
});
// переключение вкладок — главный вход (замороженная вкладка просыпается ровно тут)
chrome.tabs.onActivated.addListener(({ tabId }) => { ensureGlowInTab(tabId); });
// переключение окон — та же правда для активной вкладки нового окна
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [t] = await chrome.tabs.query({ active: true, windowId });
    if (t) ensureGlowInTab(t.id);
  } catch (e) { /* окно без вкладок */ }
});

// Welcome Page (канон 3.2): CWS прячет свежеустановленное расширение «под пазл» — кто не нашёл,
// уходит обратно в выдачу, и Google понижает продукт. У нас дверь в дом одна (иконка в тулбаре),
// потому pin критичен. Страница открывается РОВНО один раз — только на первой установке.
// chrome.tabs.create прав не требует (permission "tabs" нужен лишь для чтения url/title) — не просим лишнего.
const WELCOME_URL = 'https://panarini.github.io/focus-pages/welcome/';

chrome.runtime.onInstalled.addListener((details) => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL && !IS_DEV) {
    chrome.tabs.create({ url: WELCOME_URL });
  }
});
