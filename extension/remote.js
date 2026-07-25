// remote.js — ДАЛЬНИЙ ДВИЖОК: панель правит звуком, который живёт в offscreen-документе.
// Зачем: side panel закрывается вместе со своим WebAudio, а очаг должен гореть дальше
// (лестница присутствия, STATE ⚑: свернул дом → звук остался → отблеск говорит «горит»).
//
// Контракт РОВНО тот же, что у AudioEngine, — поэтому hearth.js не знает, локальный движок или дальний.
// Ловушка, которую здесь снимаем: performance.now() у разных документов СВОЙ отсчёт, поэтому
// сырые sessionStart/phaseStart из offscreen бессмысленны в панели. Offscreen шлёт «сколько прошло»
// (elapsed/phaseElapsed), а прокси пересчитывает это в ЛОКАЛЬНЫЕ метки — вся арифметика hearth.js цела.

class RemoteEngine {
  constructor(onState) {
    this.onState = onState || function () {};
    this.phase = 'off';
    this.sessionStart = 0; this.phaseStart = 0; this.pausedAt = 0; this.sessionDur = 0;
    this._extDur = 1;
    this._gather = 90; this._dawn = 40;
    this._chain = null;                   // очередь команд: строгий порядок, без гонки пересоздания дома

    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.target !== 'panel') return;
      this._absorb(msg.mirror);
      if (msg.state) this.onState(msg.state);
    });
  }

  // GATHER/DAWN пишутся снаружи (applyFast) — ловим присваивание и передаём в дом звука
  get GATHER() { return this._gather; }
  set GATHER(v) { this._gather = v; this._send('setLengths', { gather: this._gather, dawn: this._dawn }); }
  get DAWN() { return this._dawn; }
  set DAWN(v) { this._dawn = v; this._send('setLengths', { gather: this._gather, dawn: this._dawn }); }

  _absorb(m) {
    if (!m) return;
    const now = performance.now() / 1000;
    this.phase = m.phase;
    this.pausedAt = m.pausedAt || 0;
    this.sessionDur = m.sessionDur || 0;
    this._extDur = m.extDur || 1;
    this.sessionStart = m.elapsed ? now - m.elapsed : 0;   // чужое «сколько прошло» → своя метка
    this.phaseStart = now - (m.phaseElapsed || 0);
  }

  _ensure() {
    // Всегда спрашиваем фон — СОЗДАВАТЬ решает он (hasDocument). НЕ кэшируем «дом поднят»:
    // Chrome закрывает offscreen после тишины, кэш давал ложное «есть» → команда в пустоту
    // (баг 07-22; рецидив: на СТАРТЕ летят две команды разом — turnOn+startSession — и кэш+ретрай гонялись).
    return chrome.runtime.sendMessage({ target: 'bg', type: 'ensureOffscreen' }).then((r) => {
      if (!r || !r.ok) throw new Error((r && r.error) || 'offscreen не поднялся');
    });
  }

  // Команды идут СТРОГО по очереди: turnOn обязан отработать раньше startSession, и никакие
  // две команды не пересоздают дом звука одновременно (та самая гонка — корень рецидива).
  _send(type, extra) {
    this._chain = (this._chain || Promise.resolve()).then(() => this._run(type, extra)).catch(() => {});
    return this._chain;
  }

  async _run(type, extra, retried) {
    try {
      await this._ensure();
      const reply = await chrome.runtime.sendMessage(Object.assign({ target: 'offscreen', type }, extra || {}));
      if (reply) { this._absorb(reply.mirror); if (reply.state) this.onState(reply.state); }
    } catch (e) {
      // Дом звука мог закрыться между ensure и командой — пересоздать (ensure это сделает) и повторить РАЗ.
      if (!retried) return this._run(type, extra, true);
      console.warn('[ember] команда звука не прошла:', type, String(e));
    }
  }

  // ---- контракт AudioEngine ----
  turnOn() { this._send('turnOn'); }
  turnOff() { this._send('turnOff'); }
  startSession(d) { this._send('startSession', { duration: d }); }
  pause() { this._send('pause'); }
  resume() { this._send('resume'); }
  endSession() { this._send('endSession'); }
  extinguish(dur) { this._send('extinguish', { dur }); }
  setChar(char) { this._send('setChar', { char }); }
  setTier(tier) { this._send('setTier', { tier }); }
  setHarmony(v) { this._send('setHarmony', { value: v }); }
  sync() { this._send('sync'); }        // панель открылась заново — догнать очаг, который горел без неё
}
