// glow.js — ЯЗЫЧОК у правой кромки страницы: дверь обратно в панель (клик открывает, при открытой — закрывает).
// ОБЛИК с 26.09 — «кусочек панели» (вариант Б стенда lab/stend-yazychok-2026-09-26.html, выбор автора):
// тёмная плашка с рамкой от руки, внутри звезда панели цвета шума. Покой — звезда мала и тускла,
// рейс — дышит, пауза — ровная. Выключатель движения панели (motion) гасит дыхание и здесь.
// Прежняя оранжевая неоновая нить эпохи уголька выбивалась из новой панели (слово автора 26.09).
//
// МЕХАНИКА прежняя (v3, 07-22):
//  • УСЫНОВЛЕНИЕ СИРОТ: после перезагрузки экста в старых вкладках остаётся язычок мёртвого
//    поколения (его chrome.runtime мёртв) — старый host сносим, ставим свой.
//  • ping: живой язычок отвечает фону «я тут» — фон не вливает скрипт повторно (без дублей-слушателей).
// Законы: узкий, у кромки; кликов страницы не перехватывает; габарит стабилен; closed shadow DOM.

(() => {
  const ID = '__ember_glow_host';
  const orphan = document.getElementById(ID);
  if (orphan) orphan.remove();                             // сирота прошлого поколения — усыновляем место

  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = [
    'position:fixed', 'right:0', 'top:50%', 'transform:translateY(-50%)',
    'width:0', 'height:0', 'margin:0', 'padding:0', 'border:0',
    'pointer-events:none', 'z-index:2147483647'
  ].join(';');

  // цвет интерфейса = цвет шума (те же пары, что у кружков цвета в панели)
  const GAMMA = { brown: ['#ffb055', '#ffd9a0'], pink: ['#e8a0b4', '#ffd8e2'], white: ['#dfe4ea', '#ffffff'] };

  // рамка от руки: верх, скруглённый левый край, низ; правый край открыт — плашка выходит из-за кромки
  const W = 16, H = 66, drozh = () => (Math.random() - 0.5) * 0.6;
  const ramka = (() => {
    const r = 6, pts = [];
    for (let x = W; x >= r; x -= 3) pts.push([x, 0.5 + drozh()]);
    for (let a = 0; a <= 1; a += 0.25) { const t = -Math.PI / 2 - a * Math.PI / 2; pts.push([r + r * Math.cos(t) + 0.5, r + r * Math.sin(t) + 0.5]); }
    for (let y = r; y <= H - r; y += 4) pts.push([0.5 + drozh(), y]);
    for (let a = 0; a <= 1; a += 0.25) { const t = Math.PI - a * Math.PI / 2; pts.push([r + r * Math.cos(t) + 0.5, H - r + r * Math.sin(t) - 0.5]); }
    for (let x = r; x <= W; x += 3) pts.push([x, H - 0.5 + drozh()]);
    return pts.map((p, i) => (i ? 'L ' : 'M ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  })();

  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .kus{position:fixed;right:0;top:50%;width:${W}px;height:${H}px;border-radius:6px 0 0 6px;overflow:hidden;
           background:#0d0c0b;box-shadow:-2px 0 9px rgba(0,0,0,.28);pointer-events:auto;cursor:pointer;
           --warm:#ffb055;--warm-soft:#ffd9a0;--dyh:5.5s;--mercanie:1;
           transform:translate(120%,-50%);                               /* спит ЗА кромкой */
           transition:transform .55s cubic-bezier(.22,.9,.3,1.12)}
      .kus.on{transform:translate(0,-50%)}
      .kus.on:hover{transform:translate(-3px,-50%)}
      .kus::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity .6s;
           background:radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--warm) 22%, transparent) 0%, transparent 72%)}
      .kus.run::before{opacity:1}
      .kus.paused::before{opacity:.45}
      svg{position:absolute;inset:0;width:100%;height:100%}
      svg path{fill:none;stroke:#3a322c;stroke-width:1}
      .kz{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;
          width:18px;height:18px;opacity:.55;
          background:radial-gradient(circle, var(--warm-soft) 0 11%, color-mix(in srgb, var(--warm) 62%, transparent) 32%, transparent 70%);
          transition:width .6s cubic-bezier(.2,.7,.2,1), height .6s cubic-bezier(.2,.7,.2,1), opacity .6s}
      .kus.run .kz{width:30px;height:30px;opacity:1;animation:nakal var(--dyh) ease-in-out infinite}
      .kus.paused .kz{width:24px;height:24px;opacity:.75}
      .kus.still .kz{animation:none}
      .kus.deny{animation:deny .5s ease}
      @keyframes nakal{0%,100%{filter:brightness(calc(1 - .07*var(--mercanie)))}
                       43%{filter:brightness(calc(1 + .09*var(--mercanie)))}
                       68%{filter:brightness(calc(1 - .04*var(--mercanie)))}}
      @keyframes deny{0%,100%{transform:translate(0,-50%)}30%{transform:translate(-3px,-50%) rotate(-1.6deg)}65%{transform:translate(-1px,-50%) rotate(1.2deg)}}
      @media (prefers-reduced-motion: reduce){ .kus{transition:none} .kz{animation:none !important} }
    </style>
    <div class="kus" part="tongue" title="Open / close">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${ramka}"/></svg>
      <div class="kz"></div>
    </div>`;

  const tongue = root.querySelector('.kus');
  (document.body || document.documentElement).appendChild(host);

  // Появление = ВЫЕЗД (не проявление): предмет приехал, периферия это ловит.
  // В фоновой вкладке rAF заморожен → там без анимации, просто быть на месте.
  function slideIn() {
    if (document.hidden) { tongue.classList.add('on'); return; }
    requestAnimationFrame(() => requestAnimationFrame(() => tongue.classList.add('on')));
  }

  // Смерть = снять слушателя СРАЗУ (иначе зомби: host снят, а слушатель отвечает фону на ping
  // «я жив» → при включении обратно скрипт не вливается и язычок не возвращается — баг автора 07-22).
  function slideOut(kill) {
    tongue.classList.remove('on');
    if (kill) {
      try { chrome.runtime.onMessage.removeListener(onMsg); } catch (e) {}
      setTimeout(() => host.remove(), 700);
    }
  }

  tongue.addEventListener('click', () => {
    chrome.runtime.sendMessage({ target: 'bg', type: 'openHome' })
      .then((r) => {
        if (r && r.ok) return;
        // Дверь не открылась — честный видимый отказ + точная причина в консоли страницы.
        tongue.classList.remove('deny'); void tongue.offsetWidth; tongue.classList.add('deny');
        console.warn('[ember] дверь не открылась:', r && r.error);
      })
      .catch(() => {});
  });

  const onMsg = (msg, sender, sendResponse) => {
    if (!msg || msg.target !== 'glow') return;
    if (msg.type === 'ping') { sendResponse({ alive: host.isConnected }); return; }
    if (msg.type === 'off') { slideOut(true); return; }
    if (msg.type === 'state') {
      const active = msg.active !== false;             // старый фон без поля active — считаем рейсом
      const paused = !!msg.paused;
      tongue.classList.toggle('run', active && !paused);
      tongue.classList.toggle('paused', active && paused);
      tongue.classList.toggle('still', !!msg.still);
      const [w, s] = GAMMA[msg.colour] || GAMMA.brown;
      tongue.style.setProperty('--warm', w);
      tongue.style.setProperty('--warm-soft', s);
      slideIn();
    }
  };
  chrome.runtime.onMessage.addListener(onMsg);
})();
