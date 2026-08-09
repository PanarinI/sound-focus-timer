// offscreen.js — ДОМ ЗВУКА. Невидимый документ, который держит WebAudio, пока идёт сессия.
// Благодаря ему очаг не гаснет, когда пользователь закрывает боковую панель: дом свернулся — огонь горит.
// Панель общается с ним через remote.js (тот же контракт, что у локального AudioEngine).

let lastState = null;

const engine = new AudioEngine((state) => {
  lastState = state;
  // панель может быть закрыта — тогда слушать некому, и это нормально
  chrome.runtime.sendMessage({ target: 'panel', type: 'state', state, mirror: snapshot() }).catch(() => {});
});

// «сколько прошло», а не метки времени: performance.now() в панели имеет свой отсчёт (см. remote.js)
function snapshot() {
  const now = performance.now() / 1000;
  return {
    phase: engine.phase,
    elapsed: engine.phase === 'ниточка'
      ? (engine.pausedAt || 0)
      : (engine.sessionStart ? now - engine.sessionStart : 0),
    phaseElapsed: engine.phaseStart ? now - engine.phaseStart : 0,
    pausedAt: engine.pausedAt || 0,
    sessionDur: engine.sessionDur || 0,
    extDur: engine._extDur || 1
  };
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.target !== 'offscreen') return;
  switch (msg.type) {
    case 'turnOn': engine.turnOn(); break;
    case 'turnOff': engine.turnOff(); break;
    case 'startSession': engine.startSession(msg.duration); break;
    case 'pause': engine.pause(); break;
    case 'resume': engine.resume(); break;
    case 'endSession': engine.endSession(); break;
    case 'extinguish': engine.extinguish(msg.dur); break;
    case 'setChar': engine.setChar(msg.char); break;
    case 'setTier': engine.setTier(msg.tier); break;
    case 'setHarmony': engine.setHarmony(msg.value); break;
    case 'setMix': engine.setMix(msg.value); break;      // ручка «шум ⟷ тон»
    case 'setLengths': engine.GATHER = msg.gather; engine.DAWN = msg.dawn; break;
    case 'sync': engine._emit(); break;       // отдать снимок + СВЕЖИЙ state, чтобы панель точно перерисовалась (визибилити-пересинхрон 08-01)
  }
  reply({ mirror: snapshot(), state: lastState });
  return true;
});
