// background.js — клик по иконке-угольку открывает дом-очаг (side panel = hearth.html).
// Лестница присутствия (STATE ⚑): тулбар-иконка → нативная Chrome Side Panel.
// Звук живёт в offscreen-документе (offscreen.js) и переживает закрытие панели: дом свернулся — очаг горит.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Прощальная страница (канон 3.2:51 — причины удаления собираем формой; паттерн ExportGPT).
chrome.runtime.setUninstallURL('https://panarini.github.io/focus-pages/uninstall/').catch(() => {});

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
});

const glowAllowed = () => chrome.permissions.contains({ origins: ['<all_urls>'] });

async function eachTab(fn) {
  const tabs = await chrome.tabs.query({});          // без permission "tabs": id есть, url нет — и не нужен
  await Promise.all(tabs.map((t) => fn(t).catch(() => {})));   // служебные страницы откажут — это норма
}

async function syncGlow() {
  // Язычок = ПОСТОЯННАЯ дверь: виден, пока включён тумблером (glowEnabled) и даны права,
  // НЕЗАВИСИМО от сессии и панели. Покой = тлеет (heat 0), сессия = разгорается (pushGlowState кормит жар).
  const shouldShow = glowEnabled;
  if (shouldShow === glowLit) {                      // состояние не сменилось — только освежим яркость
    if (glowLit) pushGlowState();
    return;
  }
  if (shouldShow && !(await glowAllowed())) { glowLit = false; return; }
  glowLit = shouldShow;
  if (shouldShow) {
    await eachTab((t) => ensureGlowInTab(t.id));     // пинг-сначала: живой не переливаем (без дублей)
  } else {
    await eachTab((t) => chrome.tabs.sendMessage(t.id, { target: 'glow', type: 'off' }).catch(() => {}));
  }
}

function pushGlowState() {
  const paused = sound.phase === 'ниточка';
  eachTab((t) => chrome.tabs.sendMessage(t.id, { target: 'glow', type: 'state', heat: sound.heat, paused }));
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
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: WELCOME_URL });
  }
});
