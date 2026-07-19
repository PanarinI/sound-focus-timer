// glow.js — ЯЗЫЧОК-ОТБЛЕСК у правой кромки страницы (Merlin-паттерн, реш. автора 07-17).
// Дом свернулся вправо — там же осталась светящаяся кромка двери. Две роли:
//   1) ПРИСУТСТВИЕ: очаг горит, даже когда дома не видно. Ре (ядро аудитории) не держит в уме
//      то, чего не видит («скрылось = не существует») — поэтому нужен ОБЪЕКТ на краю, не разлив света.
//   2) ДВЕРЬ ДОМОЙ: клик возвращает панель.
// Законы: планка кликабельна, но узкая и у самой кромки; свечение вокруг кликов НЕ перехватывает;
// размер стабилен (на контент не лезет) — по ходу сессии крепнет СВЕТ, а не габарит.
// Вёрстка хозяина неприкосновенна: всё внутри closed shadow DOM.

(() => {
  const ID = '__ember_glow_host';
  if (document.getElementById(ID)) return;                 // уже висит в этой вкладке

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
      .tongue {
        position: fixed; right: 0; top: 50%; transform: translateY(-50%);
        width: 7px; height: 58px; border-radius: 5px 0 0 5px;
        background: linear-gradient(180deg, #f0c072 0%, #e8912c 52%, #b9702a 100%);
        box-shadow: -5px 0 16px rgba(255,150,60,.30);
        opacity: 0; pointer-events: auto; cursor: pointer;
        transition: opacity 1.2s ease, width .35s ease, box-shadow 1.2s ease, filter .5s ease;
        animation: breathe 6s ease-in-out infinite;
      }
      .tongue:hover { width: 11px; box-shadow: -7px 0 22px rgba(255,165,70,.55); }
      .tongue.paused { filter: saturate(.4) brightness(.62); animation-duration: 11s; }
      @keyframes breathe { 0%,100% { opacity: var(--lit, .85); } 50% { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .tongue { animation: none; } }
    </style>
    <div class="tongue" part="tongue" title="Ember — очаг горит"></div>`;

  const tongue = root.querySelector('.tongue');
  (document.body || document.documentElement).appendChild(host);

  // Первое появление — короткий взмах: язычок раз показывается шире и возвращается.
  // Иначе его не находят (автор искал прежний отблеск 5 минут; Лу-новичок не станет искать вовсе).
  let greeted = false;
  function greet() {
    if (greeted) return;
    greeted = true;
    tongue.style.width = '15px';
    setTimeout(() => { tongue.style.width = ''; }, 900);
  }

  tongue.addEventListener('click', () => {
    chrome.runtime.sendMessage({ target: 'bg', type: 'openHome' }).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.target !== 'glow') return;
    if (msg.type === 'off') {
      tongue.style.opacity = 0;
      setTimeout(() => host.remove(), 1400);                // дать догореть, потом убрать узел
      return;
    }
    if (msg.type === 'state') {
      const heat = Math.max(0, Math.min(1, msg.heat || 0));
      // крепнет СВЕТ: яркость и ореол растут с жаром, габарит остаётся прежним
      tongue.style.setProperty('--lit', (0.62 + heat * 0.3).toFixed(2));
      tongue.style.opacity = 1;
      tongue.style.boxShadow = `-${(4 + heat * 5).toFixed(0)}px 0 ${(13 + heat * 12).toFixed(0)}px rgba(255,150,60,${(0.24 + heat * 0.3).toFixed(2)})`;
      tongue.classList.toggle('paused', !!msg.paused);
      greet();
    }
  });
})();
