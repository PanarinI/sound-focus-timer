// popup.js — пульт. Шлёт команды в background, рисует состояние (дышащая точка + одна кнопка по фазе).
const $ = (id) => document.getElementById(id);
const cmd = (type, extra) => chrome.runtime.sendMessage(Object.assign({ target: 'bgcmd', type }, extra || {})).catch(() => {});
const query = () => chrome.runtime.sendMessage({ target: 'bgquery', type: 'getLatest' });

let selMin = 50;

const LABELS = {
  off: 'выключено', 'ручей': 'ручей — фон дня', 'собирание': 'собирание…',
  'ткань': 'в потоке', 'рассвет': 'рассвет — заканчивай мысль', 'ниточка': 'пауза'
};

function fmt(sec) {
  if (!sec) return '';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function render(st) {
  const phase = st ? st.phase : 'off';
  $('phaseLabel').textContent = LABELS[phase] || phase;

  const orb = $('orb');
  orb.classList.toggle('off', phase === 'off');
  if (st && st.on) {
    const d = Math.max(0, Math.min(1, st.depth || 0.15));
    const b = Math.max(0, Math.min(1.2, st.brightness || 0.6));
    const px = 34 + d * 30;
    orb.style.width = orb.style.height = px + 'px';
    const warm = Math.round(90 + b * 150), g = Math.round(120 + b * 90), bl = Math.round(210 - b * 70);
    orb.style.background = `radial-gradient(circle at 40% 38%, rgb(${warm + 40},${g + 40},${bl}), rgb(${warm - 20},${g - 30},${bl - 60}))`;
  }
  $('remaining').textContent = fmt(st && st.remaining);

  const primary = $('primary'), durations = $('durations'), secondary = $('secondary');
  primary.disabled = false;
  durations.classList.add('hidden');
  secondary.classList.add('hidden');

  if (phase === 'off') {
    primary.textContent = 'Включить';
  } else if (phase === 'ручей') {
    primary.textContent = 'Начать сессию';
    durations.classList.remove('hidden');
    secondary.classList.remove('hidden'); secondary.textContent = 'Выключить';
  } else if (phase === 'собирание' || phase === 'ткань') {
    primary.textContent = 'Пауза';
    secondary.classList.remove('hidden'); secondary.textContent = 'Завершить';
  } else if (phase === 'ниточка') {
    primary.textContent = 'Продолжить';
    secondary.classList.remove('hidden'); secondary.textContent = 'Завершить';
  } else if (phase === 'рассвет') {
    primary.textContent = 'рассвет…'; primary.disabled = true;
    secondary.classList.remove('hidden'); secondary.textContent = 'Выключить';
  }
}

$('primary').addEventListener('click', async () => {
  const st = await query();
  const phase = st ? st.phase : 'off';
  if (phase === 'off') cmd('turnOn');
  else if (phase === 'ручей') cmd('startSession', { duration: selMin * 60 });
  else if (phase === 'собирание' || phase === 'ткань') cmd('pause');
  else if (phase === 'ниточка') cmd('resume');
  setTimeout(refresh, 120);
});

$('secondary').addEventListener('click', async () => {
  const st = await query();
  const phase = st ? st.phase : 'off';
  if (phase === 'ручей' || phase === 'рассвет') cmd('turnOff');
  else cmd('endSession');
  setTimeout(refresh, 120);
});

document.querySelectorAll('.chip').forEach((ch) => {
  ch.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    ch.classList.add('active'); selMin = +ch.dataset.min;
  });
});

['balance', 'brightness', 'volume'].forEach((k) => {
  $(k).addEventListener('input', () => {
    cmd('setChar', { char: { [k]: +$(k).value } });
  });
});

async function refresh() { render(await query()); }
setInterval(refresh, 600);
refresh();
