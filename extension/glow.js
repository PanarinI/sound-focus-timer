// glow.js — ЯЗЫЧОК-ЗАКЛАДКА у правой кромки страницы (v3, решения автора 07-22).
// Роль ОДНА: ДВЕРЬ к очагу — клик открывает панель; при открытой панели тот же клик закрывает (зеркало).
// Присутствие (дышит жаром сессии) — свойство двери, не отдельная функция.
//
// v3 добавляет:
//  • УСЫНОВЛЕНИЕ СИРОТ: после перезагрузки экста в старых вкладках остаётся язычок мёртвого
//    поколения (его chrome.runtime мёртв). Прежний guard «уже висит — выходим» не давал новому
//    скрипту занять место → «неактивный рудимент» (баг автора). Теперь: старый host сносим, ставим свой.
//  • ping: живой язычок отвечает фону «я тут» — фон не вливает скрипт повторно (без дублей-слушателей).
//  • КРЕСТИК на ховере (реш. автора): выключает язычок совсем — пишет glowEnabled=false в storage
//    (единая труба-истина; фон погасит остальные вкладки, тумблер в настройках очага включит обратно).
// Законы прежние: узкий, у кромки; свечение кликов не перехватывает; габарит стабилен; closed shadow DOM.

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

  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      /* НИТЬ СВЕТА ПОЛЁТА у кромки (07-25: развернула «жар-плашку» эры угля, когерентно рейсу к звезде).
         Тонкая, тает к концам (лучевее — не брусок), ярче в середине; свет ПОЛЁТА леплется из-за кромки. */
      .tongue {
        position: fixed; right: 0; top: 50%;
        width: 8px; height: 116px;
        border-radius: 4px 0 0 4px;
        /* НАСЫЩЕННОЕ непрозрачное ядро (видно на БЕЛОЙ странице) + тающие концы (нить, не брусок). */
        background: linear-gradient(180deg,
          rgba(242,195,119,0) 0%, rgba(238,158,66,.94) 15%,
          #e8912c 50%,
          rgba(198,108,48,.94) 85%, rgba(176,101,60,0) 100%);
        box-shadow:
          -9px 0 24px rgba(255,150,60,.45),              /* тёплое свечение — видно на ТЁМНОЙ странице */
          -1px 0 3px rgba(45,22,8,.55);                  /* тёмная кромка — отрыв от БЕЛОЙ страницы */
        pointer-events: auto; cursor: pointer;
        transform: translate(120%, -50%);                /* спит ЗА кромкой — не «прозрачный ноль» */
        transition: transform .55s cubic-bezier(.22,.9,.3,1.12), box-shadow .8s ease, filter .5s ease, width .4s ease;
      }
      .tongue::after {                                   /* яркая жила-сердцевина нити — её кормит жар */
        content: ''; position: absolute; inset: 9px 1px 9px 1px;
        border-radius: 2px;
        background: linear-gradient(180deg, rgba(255,242,210,0), rgba(255,244,214,.95) 50%, rgba(255,226,170,0));
        opacity: var(--lit, .5);
        animation: breathe 6s ease-in-out infinite;
      }
      .tongue.on    { transform: translate(0, -50%); }
      .tongue:hover { transform: translate(-4px, -50%); width: 11px;
                      box-shadow: -13px 0 34px rgba(255,178,84,.62), -1px 0 3px rgba(45,22,8,.55); }
      .tongue:active { transform: translate(1px, -50%) scaleY(.97); }
      .tongue.paused { filter: saturate(.5) brightness(.72); }
      .tongue.paused::after { animation-duration: 12s; }
      .tongue.deny  { animation: deny .5s ease; }
      /* крестик-выключатель: живёт над нитью, показывается на ховере; прячется с задержкой,
         чтобы пережить перелёт курсора через зазор */
      .quit {
        position: fixed; right: 4px; top: calc(50% - 78px);
        width: 17px; height: 17px; border-radius: 50%;
        background: rgba(28,19,12,.92); border: 1px solid rgba(150,110,70,.5);
        color: #c9a06a; font: 11px/15px -apple-system, sans-serif; text-align: center;
        opacity: 0; pointer-events: none; cursor: pointer;
        transition: opacity .25s ease .45s;
      }
      .tongue:hover ~ .quit, .quit:hover {
        opacity: 1; pointer-events: auto; transition-delay: 0s;
      }
      .quit:hover { color: #f0d0a0; border-color: rgba(220,170,110,.8); }
      @keyframes breathe { 0%,100% { opacity: var(--lit, .5); } 50% { opacity: calc(var(--lit, .5) + .25); } }
      @keyframes deny { 0%,100% { transform: translate(0,-50%); } 30% { transform: translate(-3px, -50%) rotate(-1.6deg); } 65% { transform: translate(-1px, -50%) rotate(1.2deg); } }
      @media (prefers-reduced-motion: reduce) {
        .tongue { transition: none; }
        .tongue::after { animation: none; }
      }
    </style>
    <div class="tongue" part="tongue" title="Open / close"></div>
    <div class="quit" part="quit" title="Hide (bring back in panel settings)">✕</div>`;

  const tongue = root.querySelector('.tongue');
  const quit = root.querySelector('.quit');
  (document.body || document.documentElement).appendChild(host);

  // Крестик — обучающий, не вечный (реш. автора 07-22: «раздражал бы каждый раз, если я язычок ДЕРЖУ»):
  // показывается на ховере только первые ~3 раза (счёт в storage), дальше выключение живёт в настройках очага.
  let quitSeen = 99;
  quit.style.display = 'none';
  try {
    chrome.storage.local.get({ glowQuitSeen: 0 }).then((v) => {
      quitSeen = v.glowQuitSeen || 0;
      if (quitSeen < 3) quit.style.display = '';
    });
  } catch (e) {}
  let counted = false;
  tongue.addEventListener('mouseenter', () => {
    if (counted || quitSeen >= 3) return;
    counted = true;                                        // один засчитанный показ на вливание
    try { chrome.storage.local.set({ glowQuitSeen: quitSeen + 1 }); } catch (e) {}
  });

  // Появление = ВЫЕЗД (не проявление): предмет приехал, периферия это ловит.
  // В фоновой вкладке rAF заморожен → там без анимации, просто быть на месте:
  // выезд — событие момента старта, на чужой вкладке язычок должен просто СТОЯТЬ.
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

  // Крестик = «убрать язычок совсем» (труба-истина storage; фон погасит остальные вкладки,
  // включение обратно — тумблер в настройках очага). Здесь гасим сразу, не дожидаясь рассылки.
  quit.addEventListener('click', () => {
    slideOut(true);
    try { chrome.storage.local.set({ glowEnabled: false }); } catch (e) {}
  });

  const onMsg = (msg, sender, sendResponse) => {
    if (!msg || msg.target !== 'glow') return;
    if (msg.type === 'ping') { sendResponse({ alive: host.isConnected }); return; }
    if (msg.type === 'off') { slideOut(true); return; }
    if (msg.type === 'state') {
      const heat = Math.max(0, Math.min(1, msg.heat || 0));
      // жар кормит СВЕТ жилы и ореол; габарит и место не двигаются.
      // покой (heat 0) = тлеет тускло (дверь на месте, но очаг ещё не разожжён); сессия разгорается ярче.
      tongue.style.setProperty('--lit', (0.5 + heat * 0.45).toFixed(2));   // выше базовая яркость в покое — нить заметна
      if (!tongue.matches(':hover')) {
        // ореол нити растёт с жаром рейса — свет полёта просачивается дальше за кромку
        tongue.style.boxShadow =
          `-${(9 + heat * 8).toFixed(0)}px 0 ${(24 + heat * 20).toFixed(0)}px rgba(255,170,76,${(0.42 + heat * 0.3).toFixed(2)}), -1px 0 3px rgba(45,22,8,.55)`;
      }
      tongue.classList.toggle('paused', !!msg.paused);
      slideIn();
    }
  };
  chrome.runtime.onMessage.addListener(onMsg);
})();
