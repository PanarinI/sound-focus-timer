// sidepanel.js — логика компаса. Вынесен из sidepanel.html: MV3-страницы расширения
// не исполняют встроенный <script> (CSP script-src 'self') — только внешние файлы.
const $ = (id) => document.getElementById(id);
const C = 597;                 // длина окружности r=95
const MAXMIN = 120;            // полное кольцо = 120 мин
let dialMin = 45, last = null, twisting = false, orbDown = false, numTimer = null;

const engine = new AudioEngine(st => { last = st; renderAll(); });

const PRESETS = { warm: { energy: .38, masking: .45 }, bright: { energy: .72, masking: .34 }, deep: { energy: .24, masking: .70 } };
const LABELS = {
  off: 'выключено', 'ручей': 'звук — фон дня', 'собирание': 'вход в фокус…',
  'ткань': 'в потоке', 'рассвет': 'рассвет — заканчивай мысль', 'ниточка': 'пауза'
};
const inSession = p => ['собирание', 'ткань', 'ниточка', 'рассвет'].includes(p);

// --- геометрия компаса ---
function geo(e) {
  const r = $('compass').getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const dx = e.clientX - cx, dy = e.clientY - cy;
  const dist = Math.hypot(dx, dy) / (r.width / 230);   // в координатах viewBox
  let ang = Math.atan2(dx, -dy) * 180 / Math.PI;       // 0 сверху, по часовой
  if (ang < 0) ang += 360;
  return { dist, ang };
}
function showNum() {
  $('num').innerHTML = dialMin > 0 ? (dialMin + '<small>′</small>') : '<small>без таймера</small>';
  $('num').classList.add('show');
  clearTimeout(numTimer); numTimer = setTimeout(() => $('num').classList.remove('show'), 1100);
}
function setFromAngle(ang) {
  dialMin = Math.max(0, Math.min(MAXMIN, Math.round((ang / 360 * MAXMIN) / 5) * 5));
  showNum(); renderAll();
}

$('compass').addEventListener('pointerdown', e => {
  const g = geo(e);
  if (g.dist > 62 && !inSession(engine.phase)) { twisting = true; $('compass').setPointerCapture(e.pointerId); setFromAngle(g.ang); }
  else if (g.dist <= 62) { orbDown = true; }
});
window.addEventListener('pointermove', e => { if (twisting) setFromAngle(geo(e).ang); });
window.addEventListener('pointerup', () => {
  if (twisting) { twisting = false; if (dialMin > 0) { if (engine.phase === 'off') engine.turnOn(); engine.startSession(dialMin * 60); } }
  else if (orbDown) { orbDown = false; orbTap(); }
});

function orbTap() {
  const p = engine.phase;
  if (p === 'off') engine.turnOn();
  else if (p === 'ручей') engine.turnOff();
  else if (p === 'собирание' || p === 'ткань') engine.pause();
  else if (p === 'ниточка') engine.resume();
}
$('off').addEventListener('click', () => engine.turnOff());

// --- отрисовка ---
function renderAll() {
  const st = last, phase = st ? st.phase : 'off', on = !!(st && st.on);
  $('phase').textContent = LABELS[phase] || phase;
  $('brand').classList.toggle('on', on);
  $('orb').classList.toggle('on', on);

  const secs = inSession(phase) ? (st.remaining || 0) : dialMin * 60;
  const frac = Math.max(0, Math.min(1, secs / (MAXMIN * 60)));
  $('arc').style.strokeDashoffset = C * (1 - frac);

  // орб теплеет/глубеет с фокусом
  const b = Math.max(0, Math.min(1.2, (st && st.brightness) || 0.6));
  const d = Math.max(0, Math.min(1, (st && st.depth) || 0.15));
  if (on) {
    const warm = Math.round(120 + b * 120), g = Math.round(150 + b * 55), bl = Math.round(225 - b * 55);
    $('orb').style.background = `radial-gradient(circle at 42% 36%, rgb(${warm + 30},${g + 30},${bl}), rgb(${warm - 30},${g - 40},${bl - 70}))`;
    $('arc').style.stroke = `rgb(${Math.round(200 + b * 30)}, ${Math.round(150 + b * 40)}, ${Math.round(90 + d * 30)})`;
  } else {
    $('orb').style.background = ''; $('arc').style.stroke = '';
  }
}

// characters / settings
document.querySelectorAll('.chip:not(.soon)').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); el.classList.add('on');
    const pr = PRESETS[el.dataset.c]; $('energy').value = pr.energy; $('masking').value = pr.masking; engine.setChar(pr);
  });
});
['energy', 'masking', 'volume'].forEach(k => $(k).addEventListener('input', () => {
  engine.setChar({ [k]: +$(k).value }); document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
}));
$('seg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  $('seg').querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on');
  engine.setTier(b.dataset.t); $('experiments').classList.toggle('hidden', b.dataset.t !== 'premium');
}));
$('harmony').addEventListener('input', () => engine.setHarmony(+$('harmony').value));

renderAll();
