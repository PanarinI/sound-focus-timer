// offscreen.js — ДОМ ЗВУКА. Невидимый документ, который держит WebAudio, пока идёт сессия.
// Благодаря ему очаг не гаснет, когда пользователь закрывает боковую панель: дом свернулся — огонь горит.
// Панель общается с ним через remote.js (тот же контракт, что у локального AudioEngine).

let lastState = null;

// В этом документе из chrome.* есть только runtime, и тот без getManifest; chrome.storage нет вовсе (зонд
// lab/stend-ocenka-2026-11-16/proverka/zond.mjs, 16.11). Поэтому счётчик и запись идут через фон: он видит всё.
// До 1.2.3 track() звался прямо отсюда и молчал у всех — счёл себя дев-сборкой, не прочитав манифест, — и в GA4
// за 60 дней не дошло ни одного конца рейса `arrived`/`finished`.
const toBg = (m) => chrome.runtime.sendMessage(Object.assign({ target: 'bg' }, m)).catch(() => {});

// СЧЁТ РЕЙСОВ ДЛЯ ПРОСЬБЫ ОБ ОЦЕНКЕ (слово автора 16.11). Рейс засчитан, как только звук пронёс человека countAt
// секунд (панель шлёт 5 «минут»: в fast — 5 с) — любой длины, включая ∞, чем бы рейс ни кончился. Пауза в счёт не
// идёт: движок после паузы сдвигает старт. Смена длины на ходу (Правило 3) — тот же рейс, второй раз не считается.
const FLYING = ['собирание', 'ткань', 'рассвет'];
let countAt = 300, counted = true;                   // до первого взлёта считать нечего
const flownSec = () => (engine.sessionStart ? performance.now() / 1000 - engine.sessionStart : 0);

const engine = new AudioEngine((state) => {
  lastState = state;
  if (!counted && FLYING.includes(engine.phase) && flownSec() >= countAt) {
    counted = true;
    toBg({ type: 'flightCounted' });
  }
  // КОНЕЦ РЕЙСА — только отсюда. В панели событие рождается в render(), а панель к этому моменту
  // обычно закрыта (см. строкой ниже: «слушать некому»). Повесив там, мы потеряли бы ровно те
  // рейсы, ради которых продукт и сделан: закрыл панель и работал.
  if (state.justEnded) {
    const dawn = engine.DAWN || 0;
    const el = flownSec();
    const how = engine.phase === 'рассвет' ? 'arrived' : 'finished';
    const ordered = Math.max(0, (engine.sessionDur || 0) - dawn) / 60;
    toBg({ type: 'track', name: 'flight_end', params: {
      how,
      min: +Math.max(0, (how === 'arrived' ? el - dawn : el) / 60).toFixed(1),
      len: ordered > 1000 ? 'inf' : Math.round(ordered),
    } });
  }
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
    case 'startSession':
      // новый рейс — взлёт из покоя, из «ручья» или после конца; из рейса и паузы — перезапуск того же (Правило 3)
      if (!['собирание', 'ткань', 'ниточка'].includes(engine.phase)) counted = false;
      if (msg.countAt > 0) countAt = msg.countAt;
      engine.startSession(msg.duration); break;
    case 'pause': engine.pause(); break;
    case 'resume': engine.resume(); break;
    case 'endSession': engine.endSession(); break;
    case 'extinguish': engine.extinguish(msg.dur); break;
    case 'setChar': engine.setChar(msg.char); break;
    case 'setTier': engine.setTier(msg.tier); break;
    case 'setHarmony': engine.setHarmony(msg.value); break;
    case 'setMix': engine.setMix(msg.value); break;      // ручка «шум ⟷ тон»
    case 'setColour': engine.setColour(msg.value); break;  // цвет шума
    case 'setLengths': engine.GATHER = msg.gather; engine.DAWN = msg.dawn; break;
    case 'sync': engine._emit(); break;       // отдать снимок + СВЕЖИЙ state, чтобы панель точно перерисовалась (визибилити-пересинхрон 08-01)
  }
  reply({ mirror: snapshot(), state: lastState });
  return true;
});
