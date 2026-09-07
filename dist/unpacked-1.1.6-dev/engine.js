// engine.js — генеративный движок + дирижёр сессии. Без chrome-зависимостей.
// Звук — тёплое Brown-ядро (вердикт дегустации lab/taste2.html, DECISIONS 2026-07-05):
// широкополосный brown-шум + пространство (генеративный реверб) + вечный микро-дрейф
// несоизмеримыми слоями. НЕ дрон, НЕ пульс — живость только гладким дрейфом, без событий
// (закон под ADHD: событие = отвлечение).
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

  // --- генераторы материала (перенос из lab/taste2.html) ---
  // brown-шум: интеграл случайного блуждания — тёплый, «глухой рокот», база ядра.
  function fillBrown(d) { let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }
  // розовый шум (Voss-McCartney): тихий верхний «воздух», еле-еле.
  function fillPink(d) {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  }

  // белый шум: равномерный спектр. Резкий по природе — в теле подрезан сверху (см. _colourBody).
  function fillWhite(d) { for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.35; }

  // ЦВЕТА ШУМА (08-31, ветка A по слову автора: «добавим белый/розовый в настройках»).
  // Вес тела на каждый цвет. brown = {1,0,0} — при нём граф звучит РОВНО как раньше, обе новые
  // ветки стоят на нуле: 110 живых юзеров не должны услышать перемену, за которой не приходили.
  // Под pink и white оставлен коричневый пол — это наш характер («тепло — база», SOUND.md),
  // и ровно так же не-лабораторно звучат железные машинки этого рынка.
  const COLOUR = {
    brown: { b: 1.00, p: 0.00, w: 0.00 },
    pink:  { b: 0.20, p: 0.42, w: 0.00 },
    white: { b: 0.14, p: 0.16, w: 0.26 },
  };

  // Уровень плеча на цвет: у коричневого ядра верха нет вовсе, поэтому плечо слышно сильнее всего
  // и его нужно меньше; у белого верх и так есть, плечо добавляет к нему. Выставлено по замеру
  // `lab/mask-check.html`: цель — RMS почти ровный поперёк кокона, яркость растёт заметно.
  const SHOULDER = { brown: 0.34, pink: 0.34, white: 0.30 };

  const GATHER = 60;  // «минута до» — собирание (по умолчанию; dev-стенд может ускорить)
  const DAWN = 120;   // рассвет — мягкий выход
  // слой гармонизации: C-пентатоника (C3 D3 E3 G3 A3 C4) — консонанс без ведущих тонов, «воздушные трубки»
  const HARMONY_FREQS = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63];

  class AudioEngine {
    constructor(onState) {
      this.onState = onState || function () {};
      this.AC = null;
      this.master = null;
      this.charBus = null; this.brownLP = null; this.brownGain = null; this.pinkGain = null;
      this.colour = 'brown'; this.pinkBody = null; this.whiteBody = null; this.pinkLP = null; this.whiteLP = null;
      this.harmonyBus = null; this._harmonyTimer = null;
      this.tickTimer = null;
      this.cur = { master: 0, depth: 0.15, brightness: timeOfDayBrightness() };
      // характер = две функциональные крутилки (energy·masking) + громкость. Дефолты — из дегустации.
      this.char = { energy: 0.4, masking: 0.45, volume: 0.5, harmony: 0.7 };
      this.tier = 'basic'; // basic = бесплатный минимум (brown-ядро) · premium = эксперименты (слой гармонизации …)
      this.phase = 'off';
      this.phaseStart = 0;
      this.sessionDur = 0;
      this.sessionStart = 0;
      this.pausedAt = 0;
      this.GATHER = GATHER; // dev-стенд может переопределить для быстрой демонстрации
      this.DAWN = DAWN;
      // ТОНОВЫЙ СЛОЙ (08-06). Ручка «шум ⟷ тон» тянет и его громкость, и утончение шумовой стены:
      // прибавили тона — стена уходит вниз, освобождая место, но никогда не в ноль (дорога остаётся).
      this.landRing = 1;    // подача шума в колокол: 1 — открыта, 0 — обрезана (дозвон)
      this.landing = 0;     // 0…1 — «посадка»: насколько ткань уже засветлела к прибытию (см. фазу рассвета)
      this.noiseTrim = 1;   // множитель шумового тракта: 1 = чистый шум, 0.34 = максимум тона
      this.wallThin = 1;    // насколько стена утончилась, освобождая место тону
      this._tonePhase = 'off';
      // слой необязателен: без tone.js продукт остаётся сегодняшним, только без ручки
      try { this.tone = (typeof ToneLayer === 'function') ? new ToneLayer(this) : null; }
      catch (e) { this.tone = null; console.warn('[ember] тоновый слой не поднялся', e); }
    }

    // ручка «шум ⟷ тон». Значение живёт в панели (chrome.storage.local), сюда приходит командой.
    setMix(m) { this.mix = clamp(+m || 0, 0, 1); try { if (this.tone) this.tone.setMix(this.mix); } catch (e) {} }

    // движок — единственный, кто знает фазу рейса; слой обязан её слышать, иначе он бесконечность
    // без прибытия (входит в собирании, стоит в ткани, разрешается на рассвете)
    _notifyTone() {
      if (!this.tone || this.phase === this._tonePhase) return;
      this._tonePhase = this.phase;
      try { this.tone.phaseChanged(this.phase); } catch (e) { console.warn('[ember] тон и фаза', e); }
    }

    // --- аудио-хелперы (замкнуты на this.AC) ---
    _noiseBuf(fill) { const b = this.AC.createBuffer(1, this.AC.sampleRate * 8, this.AC.sampleRate); fill(b.getChannelData(0)); return b; }
    _loopSrc(buf) { const s = this.AC.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
    _makeReverb(sec, decay) {
      const AC = this.AC, len = AC.sampleRate * sec, ir = AC.createBuffer(2, len, AC.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
      const cv = AC.createConvolver(); cv.buffer = ir; return cv;
    }
    // медленный дрейф параметра: несоизмеримые частоты → сумма не повторяется; всё гладко, без событий.
    _drift(rate, depth, param) { const o = this.AC.createOscillator(), g = this.AC.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); }

    _build() {
      const AC = this.AC = new (window.AudioContext || window.webkitAudioContext)();
      const m = this.master = AC.createGain(); m.gain.value = 0; m.connect(AC.destination);

      // пространство: генеративный реверб (укутывающая ночь/комната)
      const reverb = this._makeReverb(3.2, 2.4);
      const rev = AC.createGain(); rev.gain.value = 0.85; reverb.connect(rev); rev.connect(m);

      // общая шина характера + немного пространства всем
      const charBus = this.charBus = AC.createGain(); charBus.gain.value = 0.9; charBus.connect(m);
      const send = AC.createGain(); send.gain.value = 0.18; charBus.connect(send); send.connect(reverb);

      // ШИРИНА СТЕНЫ — «кокон» (переделан 08-31: раньше он был второй громкостью и не слышался).
      // Разведение осей: громкость = насколько громко · молния = ГДЕ стоит ядро (ярче/темнее) ·
      // кокон = ПЛЕЧО поверх ядра. Первая попытка (каскад фильтров на том же срезе) дала ход
      // всего ×1.4 по яркости: выше среза энергии уже почти нет, крутизну там менять нечего.
      // Работает другое — добавить ВТОРОЙ ярус шума прямо в речевую полосу 300–3000 Гц, где живёт
      // то, что отвлекает. Ядро остаётся внизу, плечо накрывает голос. Это и есть «герметичность»:
      // сколько ни поднимай уровень на 500 Гц, разговор за стеной оттуда не закрыть.
      const wallBus = this.wallBus = AC.createGain(); wallBus.gain.value = 1;
      wallBus.connect(charBus);
      const shSrc = this._loopSrc(this._noiseBuf(fillPink));   // розовый — ровный по октавам, лучший маскер
      const shBP = this.shBP = AC.createBiquadFilter(); shBP.type = 'bandpass'; shBP.frequency.value = 1250; shBP.Q.value = 0.55;
      const shDrift = AC.createGain(); shDrift.gain.value = 1;
      const sh = this.shoulder = AC.createGain(); sh.gain.value = 0;
      shSrc.connect(shBP); shBP.connect(shDrift); shDrift.connect(sh); sh.connect(charBus);
      this._drift(0.013, 0.09, shDrift.gain);
      this._drift(0.009, 120, shBP.frequency);                 // плечо тоже дышит, а не стоит колом

      // brown-ядро: тёплый широкополосный шум + медленный дрейф среза и уровня
      const bs = this._loopSrc(this._noiseBuf(fillBrown));
      const lp = this.brownLP = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = 600;
      const bg = this.brownGain = AC.createGain(); bg.gain.value = 0.7;
      bs.connect(lp); lp.connect(bg); bg.connect(this.wallBus);
      this._drift(0.017, 130, lp.frequency);  // дрейф среза
      this._drift(0.023, 0.08, bg.gain);       // дрейф уровня

      // ПОСАДКА — КОЛОКОЛ ИЗ ШУМА (переписано 08-24 по метафоре автора).
      // Полёт — это СОН: шум, размазанное, без границ. Конец — пробуждение в явь: аморфное
      // СОБИРАЕТСЯ В КОНКРЕТНОЕ, но уже затухая, и последнее, что слышно, узнаётся как звон.
      // Механика: тот же `bs` (сырой шум, до лоупаса — иначе верхов, из которых делается металл,
      // просто нет) идёт в три узкие полосы с колокольными отношениями 1 : 2.42 : 3.87. Пока
      // добротность низкая — это шум; когда она взлетает, в окне остаётся только звенящее.
      // Ни одного удара: колокол не бьют, он ПРОСТУПАЕТ из того, что уже звучало.
      const feed = this.landFeed = AC.createGain(); feed.gain.value = 0;
      bs.connect(feed);
      const bell = this.landGain = AC.createGain(); bell.gain.value = 0;
      bell.connect(charBus);
      this.landBands = [[1, 1], [2.42, 0.55], [3.87, 0.3]].map(([ratio, amp]) => {
        const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520 * ratio; bp.Q.value = 1;
        const g = AC.createGain(); g.gain.value = amp;
        feed.connect(bp); bp.connect(g); g.connect(bell);
        return { bp, ratio };
      });

      // воздух: тихий розовый верх — еле-еле (тепло остаётся базой; «с воздухом» отвергнут как резковат)
      const ps = this._loopSrc(this._noiseBuf(fillPink));
      const php = AC.createBiquadFilter(); php.type = 'highpass'; php.frequency.value = 900;
      const pg = this.pinkGain = AC.createGain(); pg.gain.value = 0.04;
      ps.connect(php); php.connect(pg); pg.connect(charBus);
      this._drift(0.031, 0.04, pg.gain);

      // ТЕЛА ДРУГИХ ЦВЕТОВ — полноценные, не эквалайзер поверх коричневого: так «pink noise» и
      // «white noise» в листинге остаются правдой. Дрейф висит на ВНУТРЕННЕМ узле, а наружный
      // (colour) уходит в честный ноль — иначе модуляция подмешивала бы шум выключенного цвета.
      // Верх подрезан (pink 5 кГц, white 7.5 кГц) по закону SOUND.md: резкий верх ломает мягкий фокус.
      const body = (fill, cutHz) => {
        const src = this._loopSrc(this._noiseBuf(fill));
        const lpf = AC.createBiquadFilter(); lpf.type = 'lowpass'; lpf.Q.value = 0.4; lpf.frequency.value = cutHz;
        const drift = AC.createGain(); drift.gain.value = 1;
        const out = AC.createGain(); out.gain.value = 0;
        src.connect(lpf); lpf.connect(drift); drift.connect(out); out.connect(this.wallBus);
        this._drift(0.021, 0.07, drift.gain);
        return { out, lpf };
      };
      const pb = body(fillPink, 5000), wb = body(fillWhite, 7500);
      this.pinkBody = pb.out; this.pinkLP = pb.lpf;
      this.whiteBody = wb.out; this.whiteLP = wb.lpf;


      // слой ГАРМОНИЗАЦИИ (премиум-эксперимент): редкие мягкие консонансные тоны, без ритма, генеративно.
      // Принцип «воздушных трубок» — никогда не повторяется, гармонизирует среду. По умолчанию молчит (basic).
      const hb = this.harmonyBus = AC.createGain(); hb.gain.value = (this.tier === 'premium') ? this.char.harmony : 0;
      const hsend = AC.createGain(); hsend.gain.value = 0.6; hb.connect(hsend); hsend.connect(reverb); // в пространство
      const hdry = AC.createGain(); hdry.gain.value = 0.4; hb.connect(hdry); hdry.connect(m);   // но и присутствие — чтобы слышать
    }

    // --- слой гармонизации (премиум): один мягкий консонансный тон, редко, генеративно ---
    _harmonyNote() {
      if (!this.AC || this.tier !== 'premium' || this.phase === 'off') return;
      const AC = this.AC, t = AC.currentTime;
      const f = HARMONY_FREQS[(Math.random() * HARMONY_FREQS.length) | 0];
      const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const o2 = AC.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2 * (1 + (Math.random() - 0.5) * 0.006); // октавный отблеск, чуть расстроен
      const g = AC.createGain(); g.gain.value = 0;
      const g2 = AC.createGain(); g2.gain.value = 0;
      o.connect(g); o2.connect(g2);
      if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8; g.connect(p); g2.connect(p); p.connect(this.harmonyBus); }
      else { g.connect(this.harmonyBus); g2.connect(this.harmonyBus); }
      const peak = 0.13 + Math.random() * 0.10;          // слышимо для теста (убавляй крутилкой «гармонизация»)
      const atk = 0.8 + Math.random() * 1.4, rel = 4 + Math.random() * 5;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + atk); g.gain.setTargetAtTime(0, t + atk, rel / 3);
      g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(peak * 0.3, t + atk * 1.2); g2.gain.setTargetAtTime(0, t + atk * 1.2, rel / 3);
      o.start(t); o2.start(t); o.stop(t + atk + rel + 2); o2.stop(t + atk + rel + 2);
    }
    _scheduleHarmony() {
      clearTimeout(this._harmonyTimer);
      if (this.tier !== 'premium') return;
      const delay = 2500 + Math.random() * 5000;         // 2.5–7.5 с между тонами — без ритма
      this._harmonyTimer = setTimeout(() => { this._harmonyNote(); this._scheduleHarmony(); }, delay);
    }
    setTier(tier) {
      this.tier = (tier === 'premium') ? 'premium' : 'basic';
      if (this.AC && this.harmonyBus) this.harmonyBus.gain.setTargetAtTime(this.tier === 'premium' ? this.char.harmony : 0, this.AC.currentTime, 1.5);
      if (this.tier === 'premium' && this.phase !== 'off') this._scheduleHarmony();
      else { clearTimeout(this._harmonyTimer); this._harmonyTimer = null; }
    }
    setHarmony(v) {
      this.char.harmony = clamp(v, 0, 1);
      if (this.AC && this.harmonyBus && this.tier === 'premium') this.harmonyBus.gain.setTargetAtTime(this.char.harmony, this.AC.currentTime, 0.8);
    }

    // применить абстрактные цели дирижёра (master/depth/brightness) + характер к реальным AudioParam
    _apply() {
      if (!this.AC) return;
      const t = this.AC.currentTime;
      const depth = clamp(this.cur.depth, 0, 1);          // 0.15 покой … 0.9 глубокий поток
      const tod = clamp(this.cur.brightness, 0, 1.2);     // время суток (тонкий наклон, тепло — база)
      const energy = clamp(this.char.energy, 0, 1);
      const masking = clamp(this.char.masking, 0, 1);
      const vol = clamp(this.char.volume, 0, 1);

      // динамический arousal: входит присутственным → в потоке ОТСТУПАЕТ (DECISIONS 2026-07-05)
      const arousal = energy * (1 - depth * 0.5);

      // ЭНЕРГИЯ = яркость/стимуляция (brown → светлее), но с ТЁПЛЫМ потолком (среза не пускаем в свист);
      // углубление темнит (укутывает), день чуть светлее.
      // на посадке стена ЗАКРЫВАЕТСЯ: тело шума уходит вниз и вон, остаётся только то, что звенит
      const land = clamp(this.landing, 0, 1);
      // Форма среза общая, диапазон — свой у каждого цвета: молния двигает яркость ВНУТРИ семейства,
      // а не переключает семейство (это дело кружков). До 08-31 она держала только brown, и на
      // розовом/белом ручка выглядела мёртвой — поймано автором.
      // кокон вдобавок чуть двигает потолок самого цвета (0.8…1.35): на белом верх и так есть,
      // одно плечо там тонет, и ручка снова казалась бы мёртвой
      const widen = 0.8 + clamp(this.char.masking, 0, 1) * 0.55;
      const shape = (1 - depth * 0.30) * (0.92 + tod * 0.12) * (1 - 0.5 * land) * widen;
      this.brownLP.frequency.setTargetAtTime(clamp((430 + arousal * 470) * shape, 150, 1400), t, 2.0);
      if (this.pinkLP) this.pinkLP.frequency.setTargetAtTime(clamp((2600 + arousal * 3600) * shape, 900, 7000), t, 2.0);
      if (this.whiteLP) this.whiteLP.frequency.setTargetAtTime(clamp((4200 + arousal * 5300) * shape, 1400, 11000), t, 2.0);


      // ТЕЛО СТЕНЫ. Ручка тона утончает стену (wallThin) и подрезает весь шумовой тракт (noiseTrim) —
      // иначе стена забивает тон и выходит каша. Пол 0.34 держит дорогу: шум не исчезает никогда.
      const trim = clamp(this.noiseTrim, 0.3, 1);
      const thin = clamp(this.wallThin, 0.5, 1);
      // Уровень стены от кокона НЕ зависит (08-31): громкость — дело ручки громкости.
      // 0.725 — ровно то, что стена весила при прежнем дефолте masking 0.45, чтобы у живых
      // пользователей громкость не поехала.
      const wall = 0.725 * thin * trim * (1 - land * 0.94);
      const mx = COLOUR[this.colour] || COLOUR.brown;
      this.brownGain.gain.setTargetAtTime(wall * mx.b, t, 2.0);
      if (this.pinkBody) this.pinkBody.gain.setTargetAtTime(wall * mx.p, t, 2.0);
      if (this.whiteBody) this.whiteBody.gain.setTargetAtTime(wall * mx.w, t, 2.0);
      // ПЛЕЧО: 0 на узком коконе, максимум на широком. Ядро при этом слегка отступает, чтобы
      // кокон менял ХАРАКТЕР стены, а не громкость (её крутит ручка громкости).
      if (this.shoulder) {
        this.shoulder.gain.setTargetAtTime(masking * SHOULDER[this.colour] * trim * (1 - land * 0.94), t, 2.0);
        this.wallBus.gain.setTargetAtTime(1 - masking * 0.10, t, 2.0);
      }

      // воздух еле дышит и УБИРАЕТСЯ на толстой стене (чтобы верх не резал)
      // воздух на посадке тоже истончается — испаряется всё, кроме звона
      // воздух теперь заодно с шириной: узкий кокон — только глухое ядро, широкий — верх дышит
      this.pinkGain.gain.setTargetAtTime((0.02 + arousal * 0.03) * (0.4 + masking * 0.8) * trim * (1 - land * 0.7), t, 2.5);

      // РЕЗОНАНС ПОСАДКИ. Окно сужается (Q 0.7 → 27) и ползёт вверх (420 → ~1900 Гц): шум собирается
      // в тон и тончает до металлического. Громкость звона — колокол sin(π·land): нет в начале,
      // максимум в середине рассвета, ноль в конце. Поэтому он не «выключается», а испаряется.
      if (this.landBands) {
        const base = 520 + land * 360;                     // к концу ~880 Гц — там, где звон читается
        this.landBands.forEach(({ bp, ratio }) => {
          bp.frequency.setTargetAtTime(base * ratio, t, 0.8);
          bp.Q.setTargetAtTime(1 + land * 95, t, 0.8);     // шум → звон: всё держится на добротности
        });
        this.landFeed.gain.setTargetAtTime(clamp(this.landRing, 0, 1), t, 0.35);
        this.landGain.gain.setTargetAtTime(land * 2.2, t, 0.9);
      }

      // громкость: фаза (cur.master, пик 0.5) → норма ×2 × громкость × толщина стены; в потоке чуть тише
      const present = 1 - depth * 0.15;
      // затухание в тишину (пауза/выкл) — быстрое (~0.4с тау): жест должен отвечать сразу; всё остальное — мягкие 1.2с
      const tau = (this.phase === 'ниточка' || this.phase === 'off') ? 0.4 : 1.2;
      let g = this.cur.master * 2 * vol * 0.9575 * present;   // 0.9575 = (0.8 + 0.45·0.35): прежний уровень при дефолте
      // KEEP-ALIVE ДОМА ЗВУКА (крит-баг прода 08-01, корень 07-22 доказан симптомом автора):
      // offscreen-документ живёт с reason AUDIO_PLAYBACK — Chrome закрывает его, как только выход
      // умолкает НАСОВСЕМ. Громкость в 0 (или пауза) = полная тишина → Chrome убивает дом вместе с
      // фазой сессии; возврат громкости поднимает ПУСТОЙ дом (phase='off') и звук уже не воскресает.
      // Пока рейс идёт (phase ≠ off), держим неслышимый пол ~0.0015 (выход ≈ −80 дБ, ниже 16-бит кванта —
      // ухом не поймать), но для Chrome дом «играет» и не выгружается. В покое (off) пол снят — тишина честная.
      if (this.phase !== 'off') g = Math.max(g, 0.0015);
      this.master.gain.setTargetAtTime(g, t, tau);
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
        // ОСТАТОК ЗАВОДА — то, что человек выставил, БЕЗ хвоста рассвета. Табло на иконке считает по
        // нему: сессия заводится на `минуты + DAWN`, и таймер на 15 показывал 16, а на 5 стартовал с 6
        // (поймано автором 08-24). Дуга по-прежнему считает полное расстояние до прибытия.
        left: Math.max(0, this._remaining() - this.DAWN),
        depth: this.cur.depth,
        brightness: clamp(this.cur.brightness, 0, 1.2),
        on: this.phase !== 'off'
      }, extra || {}));
    }

    _tick() {
      if (!this.AC) return;
      const t = nowSec();
      const tod = timeOfDayBrightness();

      if (this.phase === 'ручей') {
        this.landing = 0; this.landRing = 1;
        this.cur.master = 0.5; this.cur.depth = 0.15; this.cur.brightness = tod;
      } else if (this.phase === 'собирание') {
        this.landing = 0; this.landRing = 1;
        const p = clamp((t - this.phaseStart) / this.GATHER, 0, 1);
        this.cur.master = 0.5;
        this.cur.depth = lerp(0.15, 0.6, easeInOut(p));
        this.cur.brightness = tod * (1 - 0.15 * p);
        if (p >= 1) { this.phase = 'ткань'; this.phaseStart = t; }
      } else if (this.phase === 'ткань') {
        this.landing = 0; this.landRing = 1;
        const el = t - this.sessionStart;
        const plateauEnd = this.sessionDur - this.DAWN;
        const p = clamp((el - this.GATHER) / Math.max(1, plateauEnd - this.GATHER), 0, 1);
        this.cur.master = 0.5;
        this.cur.depth = lerp(0.6, 0.9, p); // углубление — периферийное чувство времени
        this.cur.brightness = tod * 0.9;
        if (el >= plateauEnd) { this.phase = 'рассвет'; this.phaseStart = t; }
      } else if (this.phase === 'рассвет') {
        const p = clamp((t - this.phaseStart) / this.DAWN, 0, 1);
        // ПОСАДКА, А НЕ ИСЧЕЗНОВЕНИЕ (08-24). Было: уровень падал с первой секунды рассвета, то есть
        // конец рейса = СНЯТИЕ звука. Снятие можно не заметить — особенно человеку в потоке, ради
        // которого всё и делается, и «таймер кончился» до него не доходит.
        // Стало: две трети рассвета уровень ДЕРЖИТСЯ, а меняется спектр — ткань светлеет (`landing`),
        // и только последняя треть уводит в тишину. Прибытие слышно как ПРИХОД СВЕТА, а не как пропажа.
        // Закон цел: ни одного дискретного удара, всё едет через setTargetAtTime (прецедент Session —
        // конец = смена звука, не будильник; SOUND.md урок 6).
        // ТРИ УЧАСТКА РАССВЕТА (по метафоре сна и пробуждения):
        //   0 … 35 %   сон истончается — шум темнеет и тает, ничего конкретного;
        //  35 … 90 %   СОБИРАНИЕ — окна сужаются, из шума проступает звон (медленно, потом быстро);
        //  90 … 100 %  подача шума обрезана: полосы дозванивают сами и гаснут вместе с уровнем.
        // Последнее, что слышно, — звон на затухании. Именно это автор и описал: «собирается в
        // конкретное, но уже затухая», «последнюю секунду — о, это дзынь колокольчика».
        this.landing = Math.pow(clamp((p - 0.35) / 0.55, 0, 1), 1.6);
        this.landRing = 1 - easeInOut(clamp((p - 0.9) / 0.1, 0, 1));    // подача шума в колокол
        const soft = easeInOut(clamp(p / 0.5, 0, 1));
        this.cur.master = 0.5 * (1 - 0.45 * soft) * (1 - easeInOut(clamp((p - 0.9) / 0.1, 0, 1)));
        this.cur.depth = lerp(0.9, 0.4, easeInOut(p));
        this.cur.brightness = lerp(tod * 0.9, Math.min(1.15, tod + 0.35), easeInOut(p));
        // конец рассвета: движок ГАСИТ САМ (не ждёт панель). justEnded — панели (уголь+счёт), если открыта;
        // turnOff — тишина+стоп даже при свёрнутой панели (иначе звук застревал играть в «ручье», крит 08-01).
        if (p >= 1) { this._emit({ justEnded: true }); this.turnOff(); return; }
      } else if (this.phase === 'ниточка') {
        this.cur.master = 0; this.cur.depth = 0.05; this.cur.brightness = tod; // пауза = тишина (юзер-тест 07-16: «нажал — затихло», жест отвечает сразу)
      } else if (this.phase === 'угасание') {
        // ручное «завершить»: короткий благодарный выдох в тишину (НЕ церемония рассвета) — юзер-тест №6
        const p = clamp((t - this.phaseStart) / this._extDur, 0, 1);
        this.cur.master = this._extFrom * (1 - easeInOut(p));
        this.cur.depth = lerp(this.cur.depth, 0.15, 0.08);
        this.cur.brightness = tod;
        // конец ручного «завершить»: тоже гасим САМ (turnOff останавливает тики и глушит,
        // раньше tickTimer крутился в 'off' до панельного turnOff, а при свёрнутой панели — вечно).
        if (p >= 1) { this._emit({ justEnded: true }); this.turnOff(); return; }
      }
      this._apply();
      this._notifyTone();
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
      if (this.tier === 'premium') this._scheduleHarmony();
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
    extend(sec) { // «ещё 5 минуток» (на полке v2): из рассвета — назад в ткань; в сессии — длиннее
      if (this.phase === 'рассвет') {
        this.sessionDur = (nowSec() - this.sessionStart) + sec + this.DAWN;
        this.phase = 'ткань'; this.phaseStart = nowSec(); this._tick();
      } else if (['собирание', 'ткань', 'ниточка'].includes(this.phase)) {
        this.sessionDur += sec; this._tick();
      }
    }
    extinguish(sec) { // ручное «завершить»: быстрый выдох sec сек → тишина. Без церемонии рассвета (юзер-тест №6)
      if (!['собирание', 'ткань', 'ниточка'].includes(this.phase)) return;
      this._extFrom = this.cur.master; this._extDur = Math.max(0.3, sec);
      this.phase = 'угасание'; this.phaseStart = nowSec(); this._tick();
    }
    turnOff() {
      this.phase = 'off';
      if (this.AC) { this.cur.master = 0; this._apply(); }
      this._notifyTone();                 // рейс кончился — слой снимается, узлы освобождаются
      this._emit();
      if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
      clearTimeout(this._harmonyTimer); this._harmonyTimer = null;
      setTimeout(() => { if (this.phase === 'off' && this.AC && this.AC.state === 'running') this.AC.suspend(); }, 3500);
    }
    setChar(c) { Object.assign(this.char, c); this._apply(); this._emit(); }
    // цвет шума: brown (дефолт) · pink · white. Колокол посадки берёт СЫРОЙ brown-источник до
    // лоупаса и от цвета не зависит — звон одинаков на всех трёх.
    setColour(c) { this.colour = COLOUR[c] ? c : 'brown'; this._apply(); this._emit(); }
  }

  window.AudioEngine = AudioEngine;
})();
