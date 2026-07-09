// background.js — клик по иконке открывает пульт (side panel). Звук v0.2 живёт в самой панели
// (движок в sidepanel.html) — играет, пока панель открыта. Оффскрин-персистентность вернём позже.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
