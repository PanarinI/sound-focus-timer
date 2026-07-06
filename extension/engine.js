// engine.js — генеративный движок + дирижёр сессии. Без chrome-зависимостей.
// Звук — потомок прототипа mir.html: низкий пад из расстроенных синусов + дыхание фильтрованного шума.
// Дирижёр ведёт драматургию: ручей → собирание → ткань (углубление) → рассвет; пауза = ниточка.
// Закон продукта: НЕТ резких границ — все параметры движутся через setTargetAtTime.

(function () {
  function nowSec() { return performance.now() / 1000; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // Яркость по времени суток: минимум ночью (~0.32), пик днём (~1.0), плавная косинусоида (пик в 14:00).
  function timeOfDayBrightness() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const c = Math.cos((h - 14) / 24 * 2 * Math.PI);
    return 0.32 + 0.68 * (0.5 * (1 + c));
  }

  const GATHER = 60;  // «минута до» — собирание (по умолчанию; dev-стенд может ускорить)
  const DAWN = 120;   // рассвет — мягкий выход

  class AudioEngine {
    constructor(onState) {
      this.onState = onState || function () {};
      this.AC = null;
      this.master = null; this.padGain = null; this.osc3 = null;
      this.noiseGain = null; this.noiseFilter = null;
      this.tickTimer = null;
      this.cur = { master: 0, depth: 0.15, brightness: timeOfDayBrightness() };
      // balance: 0 = чистый тон (пад), 1 = чистый шум. По умолчанию шум впереди.
      this.char = { balance: 0.62, brightness: 0, volume: 0 };
      this.phase = 'off';
      this.phaseStart = 0;
      this.sessionDur = 0;
      this.sessionStart = 0;
      this.pausedAt = 0;
      this.GATHER = GATHER; // dev-стенд может переопределить для быстрой демонстрации
      this.DAWN = DAWN;
    }

    _build() {
      const AC = this.AC = new (window.AudioContext || window.webkitAudioContext)();
      const m = this.master = AC.createGain(); m.gain.value = 0; m.connect(AC.destination);

      // пад: три синуса, каждый с медленным тремоло (перенос из mir)
      const pad = this.padGain = AC.createGain(); pad.gain.value = 1; pad.connect(m);
      const mkOsc = (f, g, tr, trd) => {
        const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const gg = AC.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(pad);
        if (tr) {
          const l = AC.createOscillator(), lg = AC.createGain();
          l.frequency.value = tr; lg.gain.value = g * trd; l.connect(lg); lg.connect(gg.gain); l.start();
        }
        o.start(); return { o, gg };
      };
      mkOsc(55, 0.16, 0.05, 0.4);      // низ приглушён — чтобы не «дудело в трубу»
      mkOsc(82.41, 0.15, 0.073, 0.5);
      this.osc3 = mkOsc(164.81, 0.10, 0.031, 0.6); // верхний синус — красится яркостью

      // шум: дыхание фильтрованного шума
      const bl = AC.createBuffer(1, AC.sampleRate * 3, AC.sampleRate);
      const dd = bl.getChannelData(0);
      for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
      const ns = AC.createBufferSource(); ns.buffer = bl; ns.loop = true;
      const f = this.noiseFilter = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.4;
      const ng = this.noiseGain = AC.createGain(); ng.gain.value = 0.16;
      const nl = AC.createOscillator(), nlg = AC.createGain();
      nl.frequency.value = 0.03; nlg.gain.value = 0.09; nl.connect(nlg); nlg.connect(ng.gain); nl.start();
      ns.connect(f); f.connect(ng); ng.connect(m); ns.start();
    }

    // применить абстрактные цели (master/depth/brightness + характер) к реальным AudioParam
    _apply() {
      if (!this.AC) return;
      const t = this.AC.currentTime;
      const bright = clamp(this.cur.brightness + this.char.brightness, 0, 1.2);
      const depth = clamp(this.cur.depth, 0, 1);
      const vol = clamp(1 + this.char.volume, 0, 1.6);
      const balance = clamp(this.char.balance, 0, 1); // 0 тон … 1 шум

      this.master.gain.setTargetAtTime(this.cur.master * vol * 0.42, t, 1.5);
      // пад тише при сдвиге к шуму — и вообще мягче
      this.padGain.gain.setTargetAtTime(lerp(0.85, 0.16, balance), t, 2.0);
      // шум — основной материал: растёт с глубиной и со сдвигом к шуму
      this.noiseGain.gain.setTargetAtTime((0.12 + depth * 0.22) * lerp(0.6, 1.7, balance), t, 2.0);
      // более воздушный/шелестящий шум — выше срез фильтра (был глухой рокот)
      const cutoff = lerp(520, 1750, bright) - depth * 110;
      this.noiseFilter.frequency.setTargetAtTime(clamp(cutoff, 320, 2300), t, 2.0);
      if (this.osc3) this.osc3.gg.gain.setTargetAtTime((0.05 + bright * 0.11) * (1 - balance * 0.5), t, 2.0);
    }

    _remaining() {
      if (this.phase === 'off' || this.phase === 'ручей') return 0;
      const elapsed = (this.phase === 'ниточка') ? this.pausedAt : (nowSec() - this.sessionStart);
      return Math.max(0, this.sessionDur - elapsed);
    }

    _emit(extra) {
      this.onState(Object.assign({
        phase: this.phase,
        remaining: this._remaining(),
        depth: this.cur.depth,
        brightness: clamp(this.cur.brightness + this.char.brightness, 0, 1.2),
        on: this.phase !== 'off'
      }, extra || {}));
    }

    _tick() {
      if (!this.AC) return;
      const t = nowSec();
      const tod = timeOfDayBrightness();

      if (this.phase === 'ручей') {
        this.cur.master = 0.5; this.cur.depth = 0.15; this.cur.brightness = tod;
      } else if (this.phase === 'собирание') {
        const p = clamp((t - this.phaseStart) / this.GATHER, 0, 1);
        this.cur.master = 0.5;
        this.cur.depth = lerp(0.15, 0.6, easeInOut(p));
        this.cur.brightness = tod * (1 - 0.15 * p);
        if (p >= 1) { this.phase = 'ткань'; this.phaseStart = t; }
      } else if (this.phase === 'ткань') {
        const el = t - this.sessionStart;
        const plateauEnd = this.sessionDur - this.DAWN;
        const p = clamp((el - this.GATHER) / Math.max(1, plateauEnd - this.GATHER), 0, 1);
        this.cur.master = 0.5;
        this.cur.depth = lerp(0.6, 0.9, p); // углубление — периферийное чувство времени
        this.cur.brightness = tod * 0.9;
        if (el >= plateauEnd) { this.phase = 'рассвет'; this.phaseStart = t; }
      } else if (this.phase === 'рассвет') {
        const p = clamp((t - this.phaseStart) / this.DAWN, 0, 1);
        this.cur.master = 0.5;
        this.cur.depth = lerp(0.9, 0.4, easeInOut(p));
        this.cur.brightness = lerp(tod * 0.9, Math.min(1.15, tod + 0.35), easeInOut(p));
        if (p >= 1) { this.phase = 'ручей'; this.phaseStart = t; this._apply(); this._emit({ justEnded: true }); return; }
      } else if (this.phase === 'ниточка') {
        this.cur.master = 0.18; this.cur.depth = 0.05; this.cur.brightness = tod;
      }
      this._apply();
      this._emit();
    }

    _startTicking() {
      if (this.tickTimer) return;
      this.tickTimer = setInterval(() => this._tick(), 250);
    }

    // --- команды дирижёра ---
    turnOn() {
      if (!this.AC) this._build();
      if (this.AC.state === 'suspended') this.AC.resume();
      this.phase = 'ручей'; this.phaseStart = nowSec();
      this._startTicking(); this._tick();
    }
    startSession(durationSec) {
      if (!this.AC) this.turnOn();
      this.sessionDur = Math.max(this.GATHER + this.DAWN + 10, durationSec || 3000);
      this.sessionStart = nowSec();
      this.phase = 'собирание'; this.phaseStart = nowSec();
      this._tick();
    }
    pause() {
      if (this.phase === 'off' || this.phase === 'ручей') return;
      this.pausedAt = nowSec() - this.sessionStart;
      this.phase = 'ниточка'; this.phaseStart = nowSec(); this._tick();
    }
    resume() {
      if (this.phase !== 'ниточка') return;
      this.sessionStart = nowSec() - this.pausedAt; // сдвиг старта — линия времени продолжается
      this.phase = 'ткань'; this.phaseStart = nowSec(); this._tick();
    }
    endSession() { // ручной рассвет — «заканчивай мысль сейчас»
      if (['собирание', 'ткань', 'ниточка'].includes(this.phase)) {
        if (this.sessionStart) this.sessionDur = (nowSec() - this.sessionStart) + this.DAWN;
        this.phase = 'рассвет'; this.phaseStart = nowSec(); this._tick();
      }
    }
    turnOff() {
      this.phase = 'off';
      if (this.AC) { this.cur.master = 0; this._apply(); }
      this._emit();
      if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
      setTimeout(() => { if (this.phase === 'off' && this.AC && this.AC.state === 'running') this.AC.suspend(); }, 3500);
    }
    setChar(c) { Object.assign(this.char, c); this._apply(); this._emit(); }
  }

  window.AudioEngine = AudioEngine;
})();
