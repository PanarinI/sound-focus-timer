// background.js — тонкий маршрутизатор: попап → offscreen → состояние → иконка.
let latest = { phase: 'off', remaining: 0, on: false, depth: 0.15, brightness: 0.6 };

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Генеративный фокус-звук играет непрерывно, независимо от активной вкладки.'
  });
}

// Иконка = периферийное состояние: мягкая точка, наполнение = глубина, тепло = яркость/время суток.
function renderIcon(state) {
  const size = 32, c = new OffscreenCanvas(size, size), x = c.getContext('2d');
  x.clearRect(0, 0, size, size);
  if (state.on) {
    const b = Math.max(0, Math.min(1.2, state.brightness || 0.6));
    const d = Math.max(0, Math.min(1, state.depth || 0.15));
    const r = 6 + d * 8;
    // тёплое днём, синее ночью
    const col = `rgb(${Math.round(90 + b * 150)}, ${Math.round(120 + b * 90)}, ${Math.round(200 - b * 70)})`;
    x.beginPath(); x.arc(size / 2, size / 2, r, 0, 2 * Math.PI);
    x.fillStyle = col; x.globalAlpha = 0.55 + d * 0.4; x.fill();
    x.globalAlpha = 1; x.lineWidth = 1.5; x.strokeStyle = col; x.stroke();
  } else {
    x.beginPath(); x.arc(size / 2, size / 2, 6, 0, 2 * Math.PI);
    x.strokeStyle = '#8b97a8'; x.lineWidth = 1.5; x.stroke();
  }
  try { chrome.action.setIcon({ imageData: x.getImageData(0, 0, size, size) }); } catch (e) {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.target === 'bg' && msg.type === 'state') {
    latest = msg.state;
    chrome.storage.session.set({ latest }).catch(() => {});
    renderIcon(latest);
    return;
  }
  if (msg.target === 'bgcmd') {
    (async () => {
      await ensureOffscreen();
      chrome.runtime.sendMessage({ target: 'offscreen', type: msg.type, duration: msg.duration, char: msg.char }).catch(() => {});
    })();
    return;
  }
  if (msg.target === 'bgquery' && msg.type === 'getLatest') {
    sendResponse(latest);
    return true;
  }
});
