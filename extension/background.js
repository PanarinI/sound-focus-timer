// background.js — клик по иконке-угольку открывает дом-очаг (side panel = hearth.html).
// Лестница присутствия (STATE ⚑): тулбар-иконка → нативная Chrome Side Panel.
// Звук живёт в offscreen-документе (offscreen.js) и переживает закрытие панели: дом свернулся — очаг горит.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

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

  // Клик по язычку — дверь домой.
  // ⚑ РАЗВИЛКА: sidePanel.open() требует жеста пользователя. Жест был (клик по язычку), но случился
  // в content-script — пробрасывается ли он в service worker, покажет только живой Chrome.
  // Если Chrome откажет, роль двери переедет на иконку в тулбаре, а язычок останется присутствием.
  if (msg.type === 'openHome') {
    const windowId = sender.tab && sender.tab.windowId;
    chrome.sidePanel.open({ windowId })
      .then(() => reply({ ok: true }))
      .catch((e) => reply({ ok: false, error: String(e) }));
    return true;
  }
});

// ---------- ОТБЛЕСК ----------
// Свет из-под двери: дом свернули, а очаг горит. Зажигаем ТОЛЬКО когда панель закрыта и сессия идёт.
// Права опциональные — пока человек их не дал, весь этот блок молча ничего не делает.
const WORKING = ['собирание', 'ткань', 'ниточка'];

let panelOpen = false;
let sound = { phase: 'off', heat: 0 };
let glowLit = false;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panel') return;
  panelOpen = true;                                  // дом открыт — отблеск не нужен, очаг виден и так
  syncGlow();
  port.onDisconnect.addListener(() => { panelOpen = false; syncGlow(); });
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
  const shouldBurn = !panelOpen && WORKING.includes(sound.phase);
  if (shouldBurn === glowLit) {                      // состояние не сменилось — только освежим яркость
    if (glowLit) pushGlowState();
    return;
  }
  if (!(await glowAllowed())) { glowLit = false; return; }
  glowLit = shouldBurn;
  if (shouldBurn) {
    await eachTab(async (t) => {
      await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['glow.js'] });
    });
    pushGlowState();
  } else {
    await eachTab((t) => chrome.tabs.sendMessage(t.id, { target: 'glow', type: 'off' }));
  }
}

function pushGlowState() {
  const paused = sound.phase === 'ниточка';
  eachTab((t) => chrome.tabs.sendMessage(t.id, { target: 'glow', type: 'state', heat: sound.heat, paused }));
}

// вкладка, открытая посреди сессии, тоже получает отблеск
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete' || !glowLit) return;
  if (!(await glowAllowed())) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['glow.js'] });
    chrome.tabs.sendMessage(tabId, { target: 'glow', type: 'state', heat: sound.heat, paused: sound.phase === 'ниточка' });
  } catch (e) { /* служебная страница — свет туда не ставится */ }
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
