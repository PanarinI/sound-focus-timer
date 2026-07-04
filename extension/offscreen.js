// offscreen.js — обёртка движка для расширения: команды из background → движок, состояние → обратно.
const engine = new AudioEngine((state) => {
  chrome.runtime.sendMessage({ target: 'bg', type: 'state', state }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== 'offscreen') return;
  switch (msg.type) {
    case 'turnOn': engine.turnOn(); break;
    case 'startSession': engine.startSession(msg.duration); break;
    case 'pause': engine.pause(); break;
    case 'resume': engine.resume(); break;
    case 'endSession': engine.endSession(); break;
    case 'turnOff': engine.turnOff(); break;
    case 'setChar': engine.setChar(msg.char); break;
  }
});
