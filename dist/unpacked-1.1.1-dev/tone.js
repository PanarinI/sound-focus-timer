// tone.js — ТОНОВЫЙ СЛОЙ в продукте. Перенос из `lab/tone-stand.html` (вечер 08-06).
//
// ЧТО ЭТО. Поверх тёплого шума живёт пласт из восьми голосов. Присутствие каждого ведут ДВЕ
// непрерывные волны с несоизмеримыми периодами (разведены золотым сечением) — состав пересобирается
// вечно и замереть целиком не может по построению. Аккорд переселяется голос за голосом, у каждого
// своё время глиссандо; один голос отстаёт задержанием и разрешается через 9–20 с. Сверху редкие
// мотивы, снизу ровный ход, сбоку второй путник со своей походкой.
//
// ЧТО ЗАМОРОЖЕНО. Характер «Стекло+» с правками автора по слуху 08-04 (срез 1500 — у треугольника
// именно верхние призвуки дают стеклянность и холод; пульс поднят в середину пласта, чтобы не тонуть
// под подушкой шума — урок 9 SOUND.md). Палитра — пентатоника: нет ведущих тонов, значит нет
// тяготения и не за чем следить. Остальные крутилки стенда застыли на значениях, выбранных там.
//
// ЧЕМ УПРАВЛЯЕТ ЧЕЛОВЕК. Одной ручкой «шум ⟷ тон» (решение 08-06: каждая вторая ручка требует
// решения в момент, когда человек пришёл работать, а не настраивать). Ручка тянет несколько
// скрытых параметров — см. `setMix`.
//
// КАК ВСТРОЕН В РЕЙС. Слой не звучит сам по себе: его выход идёт в `engine.master`, то есть тон едет
// по тем же рельсам, что и шум, — общая громкость, пауза, keep-alive, угасание. Своё у него только
// то, что делает его частью РЕЙСА, а не фоном: он ВХОДИТ в собирании, СТОИТ в ткани и РАЗРЕШАЕТСЯ
// на рассвете (мотивы и ход прекращаются, аккорд возвращается домой). Без этого слой был бы
// бесконечностью без прибытия — узел, записанный в STATE 08-06.
(() => {
  'use strict';

  // пентатоника C D E G A классами высот: петля из пяти созвучий, которая никуда не тяготеет
  const PALETTE = [[0, 7, 2], [0, 9, 4], [2, 7, 4], [9, 4, 2], [0, 7, 9]];

  // характер «Стекло+» — фаворит автора, значения со стенда
  const CFG = {
    centers: [196, 262, 330, 392, 523, 659, 784, 880], wave: 'triangle',
    cutoff: 1500, hp: 150, rvSec: 6.0, rvDecay: 2.5,
    send: 0.6, rvGain: 0.9, dry: 0.5, moveEvery: 65, glide: 12,
  };
  // застывшие крутилки стенда
  const DENS = 0.5, DETUNE = 8, WARM = 0.35, PULSE_RATE = 0.62;
  const PHI = 1.6180339887;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // мягкий выпрямитель для кривой присутствия: ниже нуля — ровно тишина, выше — плавный подъём.
  // Углов нет нигде, значит вход и уход голоса физически не могут прозвучать как щелчок.
  function softRectifier() {
    const N = 1024, c = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = -1 + 2 * i / (N - 1); c[i] = x <= 0 ? 0 : x * x * (3 - 2 * x); }
    return c;
  }
  // порог присутствия. Голоса 0–1 — ЯДРО: их порог всегда над нулём, они дышат, но не пропадают.
  // Остальные ходят через ноль. Так гарантирован пол: пласт не может опустеть целиком.
  const densToDC = (d, i) => (i < 2 ? 0.34 + d * 0.36 : -0.56 + d * 1.02);

  // ближайшая к центру частота для класса высоты — это и есть автоматическое голосоведение
  function pcNear(pc, center, preferDown) {
    const midiCenter = 69 + 12 * Math.log2(center / 440);
    let best = null, bestD = 1e9;
    for (let oct = 0; oct <= 9; oct++) {
      const midi = pc + 12 * oct;
      let d = Math.abs(midi - midiCenter);
      if (preferDown && midi > midiCenter) d += 0.6;      // голоса тяготеют вниз
      if (d < bestD) { bestD = d; best = midi; }
    }
    return 440 * Math.pow(2, (best - 69) / 12);
  }
  const SCALE = (() => { const s = new Set(); PALETTE.forEach((ch) => ch.forEach((pc) => s.add(pc))); return [...s].sort((a, b) => a - b); })();
  function scaleFreq(idx, ref) {
    const len = SCALE.length, oct = Math.floor(idx / len);
    return pcNear(SCALE[((idx % len) + len) % len], ref, false) * Math.pow(2, oct);
  }

  class ToneLayer {
    constructor(engine) {
      this.eng = engine;
      this.mix = 0;                 // 0 = чистый шум (сегодняшний продукт)
      this.pad = null;
      this.phase = 'off';
      this.gain = { tone: 0, puls: 0, comp: 0, mel: 0 };
      this.melPhase = Math.random();
    }

    // ── ОДНА РУЧКА ────────────────────────────────────────────────────────────
    // Это НЕ баланс двух громкостей:
    // (1) кривая равномощная (sin/cos) — при линейном кроссфейде середина проседает;
    // (2) шум не просто тише, он УТОНЧАЕТСЯ (стена вниз) — иначе забивает тон и выходит каша;
    // (3) шум никогда не в ноль: дорога остаётся, тон едет по ней попутчиком;
    // (4) слои включаются лесенкой — пласт с самого начала, ход с 0.10, путник с 0.18, мотивы с 0.30,
    //     чтобы на малых значениях это был всё ещё сегодняшний продукт, только теплее.
    setMix(m) {
      this.mix = clamp01(+m || 0);
      const a = this.mix * Math.PI / 2;
      const stair = (lo, hi) => clamp01((this.mix - lo) / (hi - lo));
      this.gain.tone = Math.sin(a) * 0.9;
      this.gain.puls = stair(0.10, 0.45);
      this.gain.comp = stair(0.18, 0.55);
      this.gain.mel = stair(0.30, 0.70);
      // шумовой тракт движка утончается ровно настолько, насколько прибавили тона
      this.eng.noiseTrim = 0.34 + 0.66 * Math.cos(a);
      this.eng.wallThin = 1 - 0.35 * this.mix;
      if (this.eng.AC) this.eng._apply();

      if (this.mix < 0.005) { this._kill(); return; }
      if (!this.eng.AC || this.phase === 'off') return;
      // ручку увели в ноль и вернули посреди рейса → пласт пересобран заново, и ему надо ВЕРНУТЬ
      // жизнь: без этого голоса просто гудят на месте — аккорд не переселяется, мотивов нет.
      const born = this._ensure();
      this._level(1.5);
      if (born && (this.phase === 'собирание' || this.phase === 'ткань')) this._run();
      else this._applyLayers();
    }

    // ── ФАЗЫ РЕЙСА ────────────────────────────────────────────────────────────
    phaseChanged(phase) {
      const was = this.phase;
      this.phase = phase;
      if (phase === 'off') { this._kill(); return; }
      if (this.mix < 0.005 || !this.eng.AC) return;
      this._ensure();

      if (phase === 'собирание') {
        // ВХОД: пласт проступает за всё собирание, а не включается. Начинаем от нуля только если
        // рейс действительно начался с покоя — иначе (возврат с паузы) не дёргаем уровень вниз.
        if (was === 'off' || was === 'ручей') this.pad.bus.gain.setValueAtTime(0, this.eng.AC.currentTime);
        this._level(Math.max(4, this.eng.GATHER * 0.55));
        this._run();
      } else if (phase === 'ткань') {
        this._level(3); this._run();
      } else if (phase === 'ниточка') {
        // ПАУЗА: тишину делает master движка; нам важно не копить события за время паузы
        this._stopTimers();
      } else if (phase === 'рассвет') {
        this._resolve();
      } else if (phase === 'угасание') {
        this._stopTimers();
      }
    }

    // РАЗРЕШЕНИЕ НА РАССВЕТЕ. Мотивы, ход и путник прекращаются — сверху больше ничего не приходит.
    // Аккорд возвращается на первое созвучие палитры длинным глиссандо: не «выключили», а «пришли».
    // Сам уровень гасит master движка синхронно с рассветом, поэтому тут мы его не трогаем.
    _resolve() {
      this._stopTimers();
      if (!this.pad) return;
      const AC = this.eng.AC, t = AC.currentTime;
      const chord = PALETTE[0];
      this.pad.voices.forEach((v) => {
        const f = pcNear(chord[v.idx % chord.length], v.center, true);
        v.oscs.forEach((o) => o.frequency.setTargetAtTime(f, t, Math.max(4, this.eng.DAWN * 0.25)));
        // ядро остаётся, верхние голоса уходят: к прибытию ткань редеет
        if (v.idx >= 2) v.dc.offset.setTargetAtTime(-0.9, t, Math.max(3, this.eng.DAWN * 0.3));
      });
      if (this.pad.comp) this.pad.comp.depth.gain.setTargetAtTime(0, t, 4);
    }

    _level(tau) {
      if (!this.pad) return;
      this.pad.bus.gain.setTargetAtTime(this.gain.tone, this.eng.AC.currentTime, Math.max(0.3, tau) / 3);
    }
    _applyLayers() {
      if (!this.pad || !this.pad.comp) return;
      this.pad.comp.depth.gain.setTargetAtTime(this.gain.comp * 0.55, this.eng.AC.currentTime, 2.5);
    }

    _ensure() { if (this.pad) return false; this._build(); this._level(0.5); return true; }

    _run() {
      if (!this.pad) return;
      this._applyLayers();
      this._moveChord(); this._scheduleMelody(); this._wander(); this._pulseTick();
    }

    // id обнуляем, а не только гасим: иначе по полю не отличить «таймер снят» от «таймер идёт»,
    // и любая проверка состояния слоя врёт (поймано на приёмке 08-06)
    _stopTimers() {
      const p = this.pad; if (!p) return;
      clearTimeout(p.moveTimer); clearTimeout(p.melTimer); clearTimeout(p.compTimer); clearTimeout(p.pulseTimer);
      p.moveTimer = p.melTimer = p.compTimer = p.pulseTimer = null;
      p.susTimers.forEach(clearTimeout); p.susTimers.length = 0;
    }

    _kill() {
      const old = this.pad; if (!old) return;
      this._stopTimers();
      this.pad = null;
      try { old.bus.gain.setTargetAtTime(0, this.eng.AC.currentTime, 0.6); } catch (e) {}
      setTimeout(() => {
        try {
          old.voices.forEach((v) => { v.oscs.forEach((o) => o.stop()); v.dc.stop(); });
          old.lfos.forEach((l) => l.stop());
          if (old.comp) { old.comp.oscs.forEach((o) => o.stop()); old.comp.dc.stop(); old.comp.lfos.forEach((l) => l.stop()); }
          old.out.disconnect(); old.zero.disconnect();
        } catch (e) {}
      }, 3500);
    }

    // ── ПОСТРОЙКА ПЛАСТА ──────────────────────────────────────────────────────
    _build() {
      const AC = this.eng.AC;
      const bus = AC.createGain(); bus.gain.value = 0;
      const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = CFG.hp;   // не лезем под подушку
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
      lp.frequency.value = CFG.cutoff * (0.45 + 1.1 * WARM);
      bus.connect(hp); hp.connect(lp);

      // ВЫХОД В MASTER ДВИЖКА, не в destination: тон обязан ехать по тем же рельсам, что и шум —
      // общая громкость, пауза, рассвет, keep-alive. Иначе на паузе шум замолкал бы, а тон играл.
      const out = AC.createGain(); out.gain.value = 1; out.connect(this.eng.master);
      const dry = AC.createGain(); dry.gain.value = CFG.dry; lp.connect(dry); dry.connect(out);
      const rv = this.eng._makeReverb(CFG.rvSec, CFG.rvDecay);
      const send = AC.createGain(); send.gain.value = CFG.send; lp.connect(send); send.connect(rv);
      const rvg = AC.createGain(); rvg.gain.value = CFG.rvGain; rv.connect(rvg); rvg.connect(out);

      const zero = AC.createGain(); zero.gain.value = 0; zero.connect(this.eng.master);   // сток для анализаторов
      this.eng._drift(0.0083, CFG.cutoff * 0.22, lp.frequency);   // ткань ползёт даже в самый тонкий момент

      const lfos = [];
      const voices = CFG.centers.map((c, i) => {
        const vg = AC.createGain(); vg.gain.value = 0;             // уровень задаёт ТОЛЬКО модуляция
        if (AC.createStereoPanner) { const pan = AC.createStereoPanner(); pan.pan.value = rnd(-0.75, 0.75); vg.connect(pan); pan.connect(bus); }
        else vg.connect(bus);
        const peak = 0.30 / Math.sqrt(i + 1);                      // верхние тише — иначе каша

        const oscs = [-1, 1].map((s) => {
          const o = AC.createOscillator(); o.type = CFG.wave;
          o.frequency.value = c; o.detune.value = s * DETUNE;
          this.eng._drift(0.017 + i * 0.0029, 6, o.detune);        // плёночная качка
          o.connect(vg); o.start(); return o;
        });

        // присутствие голоса: две волны с несоизмеримыми периодами (41…90 с и то же ×φ).
        // Отношение иррационально → рисунок не повторяется никогда и в общей тишине не сойдётся.
        const base = 41 + i * 7;
        const sum = AC.createGain(); sum.gain.value = 1;
        [[base, 0.62], [base * PHI, 0.38]].forEach(([per, amp], k) => {
          const l = AC.createOscillator(); l.type = 'sine'; l.frequency.value = 1 / per;
          const g = AC.createGain(); g.gain.value = amp;
          l.connect(g); g.connect(sum); l.start(AC.currentTime + i * 1.7 + k * 3.1);
          lfos.push(l);
        });
        const dc = AC.createConstantSource(); dc.offset.value = densToDC(DENS, i); dc.connect(sum); dc.start();
        const shaper = AC.createWaveShaper(); shaper.curve = softRectifier(); shaper.oversample = 'none';
        const depth = AC.createGain(); depth.gain.value = peak;
        sum.connect(shaper); shaper.connect(depth); depth.connect(vg.gain);

        // замер уровня голоса: модуляция не видна в .value — только на слух и в анализаторе
        const an = AC.createAnalyser(); an.fftSize = 256; vg.connect(an); an.connect(zero);
        return { vg, oscs, center: c, peak, idx: i, dc, an, abuf: new Float32Array(an.fftSize) };
      });

      this.pad = { bus, out, lp, voices, lfos, zero, rv, motifs: this._makeMotifs(),
                   step: 0, moveTimer: null, melTimer: null, susTimers: [], comp: null, compTimer: null, pulseTimer: null };
      this.pad.comp = this._buildCompanion();
    }

    // ── ВТОРОЙ ПУТНИК ─────────────────────────────────────────────────────────
    // Не второй пласт, а другой ХАРАКТЕР в той же панораме: один голос, свой тембр, свой регистр,
    // своя походка. Дорога общая (общий реверб), шаг свой: присутствие ведёт пара волн с ДРУГИМИ
    // периодами (127 с и 127·φ против 41–90 у пласта) — путники сходятся и расходятся сами собой.
    _buildCompanion() {
      const AC = this.eng.AC, p = this.pad;
      const center = CFG.centers[Math.floor(CFG.centers.length / 2)] * 0.5;
      const gain = AC.createGain(); gain.gain.value = 0;
      const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.6;   // полый, дудочный — ни на что в пласте не похож
      bp.frequency.value = center * 2.2;
      this.eng._drift(0.0061, center * 0.5, bp.frequency);
      const tame = AC.createBiquadFilter(); tame.type = 'lowpass'; tame.frequency.value = 1250; tame.Q.value = 0.5;
      gain.connect(bp); bp.connect(tame);
      let src = tame;
      if (AC.createStereoPanner) { const pn = AC.createStereoPanner(); pn.pan.value = -0.42; tame.connect(pn); src = pn; }
      const dry = AC.createGain(); dry.gain.value = 0.75; src.connect(dry); dry.connect(p.out);
      const snd = AC.createGain(); snd.gain.value = 0.70; src.connect(snd); snd.connect(p.rv);

      const oscs = [-1, 1].map((s) => {
        const o = AC.createOscillator(); o.type = 'sawtooth';     // тембр нарочно другой, чем у пласта
        o.frequency.value = center; o.detune.value = s * 6;
        this.eng._drift(0.013, 8, o.detune);
        o.connect(gain); o.start(); return o;
      });

      const sum = AC.createGain(); sum.gain.value = 1;
      const lfos = [];
      [[127, 0.66], [127 * PHI, 0.34]].forEach(([per, amp]) => {
        const l = AC.createOscillator(); l.type = 'sine'; l.frequency.value = 1 / per;
        const g = AC.createGain(); g.gain.value = amp; l.connect(g); g.connect(sum); l.start();
        lfos.push(l);
      });
      const dc = AC.createConstantSource(); dc.offset.value = 0.06; dc.connect(sum); dc.start();
      const shaper = AC.createWaveShaper(); shaper.curve = softRectifier();
      const depth = AC.createGain(); depth.gain.value = 0;
      sum.connect(shaper); shaper.connect(depth); depth.connect(gain.gain);

      const an = AC.createAnalyser(); an.fftSize = 256; gain.connect(an); an.connect(p.zero);
      return { gain, oscs, dc, depth, lfos, center, an, abuf: new Float32Array(256), idx: 0 };
    }

    // ПОХОДКА ПУТНИКА: шаг по соседней ступени лада, портаменто 6–12 с. ШАГ ТОЛЬКО В ТИШИНЕ
    // (правка 08-04 по слуху автора): пока путник слышен, переход откладывается — он уходит,
    // переступает беззвучно и возвращается уже на другой ступени. Слышна перемена, но не переход.
    _wander() {
      const p = this.pad; if (!p || !p.comp) return;
      clearTimeout(p.compTimer);
      const c = p.comp;
      c.an.getFloatTimeDomainData(c.abuf);
      let s = 0; for (const x of c.abuf) s += x * x;
      if (Math.sqrt(s / c.abuf.length) < 0.006) {
        const step = Math.random() < 0.8 ? 1 : 2;
        c.idx += (Math.random() < 0.5 ? -step : step);
        const f = scaleFreq(c.idx, c.center);
        c.oscs.forEach((o) => o.frequency.setTargetAtTime(f, this.eng.AC.currentTime, rnd(6, 12)));
      }
      p.compTimer = setTimeout(() => this._wander(), rnd(20, 50) * 1000);
    }

    // ── ХОД (пульс) ───────────────────────────────────────────────────────────
    // Ревизия решения 07-05 «пульс отвергнут»: отвергалась модуляция ШУМОВОЙ СТЕНЫ — мерцание
    // широкополосного полотна действительно рябит. Здесь другое: отдельные мягкие удары высоты
    // в тоновом слое. Закон ADHD цел — внимание хватается за непредсказуемое, а ровный ход
    // предсказуем и становится несущей, как стук колёс. Атака 60 мс: слышно, но транзиента нет.
    _pulseTick() {
      const p = this.pad; if (!p) return;
      clearTimeout(p.pulseTimer);
      if (this.gain.puls > 0.01) this._playPulse();
      p.pulseTimer = setTimeout(() => this._pulseTick(), (1 / PULSE_RATE) * 1000 * rnd(0.94, 1.06));
    }
    _playPulse() {
      const AC = this.eng.AC, t = AC.currentTime, p = this.pad;
      // у хода тоже есть присутствие: он приходит и уходит по паре несоизмеримых волн
      const w = Math.sin(2 * Math.PI * t / 89) * 0.6 + Math.sin(2 * Math.PI * t / (89 * PHI)) * 0.4;
      const pres = Math.max(0, w);
      if (pres < 0.04) return;
      const chord = PALETTE[p.step % PALETTE.length];
      const pc = Math.random() < 0.7 ? chord[0] : chord[(Math.random() * chord.length) | 0];
      // регистр хода — в середине пласта, НАД энергией подушки (урок 9: под подушкой тон не слышен)
      const f = pcNear(pc, CFG.centers[1], true);
      const peak = (0.05 + this.gain.puls * 0.26) * pres;
      [-1, 1].forEach((s) => {
        const o = AC.createOscillator(); o.type = 'triangle';
        o.frequency.value = f; o.detune.value = s * 4;
        const g = AC.createGain(); g.gain.value = 0;
        o.connect(g); g.connect(p.bus); o.start(t);
        const atk = 0.06, rel = rnd(0.55, 1.15);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak * (s < 0 ? 1 : 0.55), t + atk);
        g.gain.setTargetAtTime(0, t + atk, rel / 3);
        o.stop(t + atk + rel + 1.5);
      });
    }

    // ── СМЕНА АККОРДА + ЗАДЕРЖАНИЕ ────────────────────────────────────────────
    // Каждый слот берёт ближайший тон нового созвучия, с предпочтением вниз; у каждого голоса СВОЁ
    // время перехода (±45 %) — аккорд не «сменяется» в момент, а переселяется голос за голосом.
    // ЗАДЕРЖАНИЕ — барочный приём, из-за которого «местами пронзительно» (урок 11): один слышный
    // голос держит старую ноту, пока гармония под ним сменилась, и разрешается через 9–20 с.
    _moveChord() {
      const p = this.pad; if (!p) return;
      clearTimeout(p.moveTimer);
      const chord = PALETTE[p.step % PALETTE.length]; p.step++;
      const t = this.eng.AC.currentTime;

      let susIdx = -1;
      if (p.step > 1) {
        const audible = p.voices.filter((v) => {
          v.an.getFloatTimeDomainData(v.abuf);
          let s = 0; for (const x of v.abuf) s += x * x;
          return Math.sqrt(s / v.abuf.length) > v.peak * 0.25;
        });
        if (audible.length) susIdx = audible[(Math.random() * audible.length) | 0].idx;
      }

      p.voices.forEach((v) => {
        const f = pcNear(chord[v.idx % chord.length], v.center, true);
        const gl = CFG.glide * rnd(0.55, 1.45);
        if (v.idx === susIdx) {
          p.susTimers.push(setTimeout(() => {
            if (this.pad !== p) return;
            // разрешение медленнее обычного перехода: не «поправился», а «отпустил»
            v.oscs.forEach((o) => o.frequency.setTargetAtTime(f, this.eng.AC.currentTime, (gl * 1.5) / 3));
          }, rnd(9, 20) * 1000));
        } else {
          v.oscs.forEach((o) => o.frequency.setTargetAtTime(f, t, gl / 3));
        }
      });
      p.moveTimer = setTimeout(() => this._moveChord(), CFG.moveEvery * 1000);
    }

    // ── МОТИВЫ ────────────────────────────────────────────────────────────────
    // Случайные ноты аккорда ухо не связывает в линию — это отдельные вздохи. Мелодия рождается из
    // МОТИВА: фигуры в несколько шагов по ступеням лада, которая возвращается изменённой (обращение,
    // обратный ход, другая ступень старта). Появления — по иррациональному вращению: равномерно и
    // никогда не в ритм. Атака 0.5–1.2 с: слышно как НОТА, но без транзиента, значит не событие.
    _makeMotifs() {
      const steps = [-2, -1, -1, 1, 2, 3];        // уклон вниз — голосоведения нисходят
      return [0, 1, 2].map(() => {
        const n = 4 + ((Math.random() * 3) | 0);
        return Array.from({ length: n }, () => steps[(Math.random() * steps.length) | 0]);
      });
    }
    _nextMelGap() { this.melPhase = (this.melPhase + PHI) % 1; return 40 + this.melPhase * 110; }
    _scheduleMelody() {
      const p = this.pad; if (!p) return;
      clearTimeout(p.melTimer);
      p.melTimer = setTimeout(() => {
        if (this.pad === p && this.gain.mel > 0.01) this._playMelody();
        this._scheduleMelody();
      }, this._nextMelGap() * 1000);
    }
    _playMelody() {
      const AC = this.eng.AC, p = this.pad;
      const top = CFG.centers[CFG.centers.length - 1];
      let motif = p.motifs[(Math.random() * p.motifs.length) | 0].slice();
      if (Math.random() < 0.35) motif = motif.map((s) => -s);   // обращение
      if (Math.random() < 0.30) motif.reverse();                // обратный ход
      const chord = PALETTE[p.step % PALETTE.length];
      let idx = SCALE.indexOf(chord[(Math.random() * chord.length) | 0]);
      if (idx < 0) idx = 0;
      const peak = 0.06 + this.gain.mel * 0.26;
      let t = AC.currentTime + 1.5;

      motif.forEach((step) => {
        idx += step;
        const f = scaleFreq(idx, top * rnd(0.9, 1.1));
        [-1, 1].forEach((s) => {
          const o = AC.createOscillator(); o.type = CFG.wave;
          o.frequency.value = f; o.detune.value = s * 5;
          const g = AC.createGain(); g.gain.value = 0;
          o.connect(g); g.connect(p.bus); o.start(t);
          const atk = rnd(0.5, 1.2), hold = rnd(1.1, 2.4), rel = rnd(2.5, 5);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(peak * (s < 0 ? 1 : 0.6), t + atk);
          g.gain.setTargetAtTime(0, t + atk + hold, rel / 3);
          o.stop(t + atk + hold + rel + 3);
          if (s > 0) t += atk + hold * rnd(0.55, 1.0);          // ноты слегка накладываются — линия, не точки
        });
      });
    }
  }

  window.ToneLayer = ToneLayer;
})();
