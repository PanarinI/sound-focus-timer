// icon.js — рисование иконки-таймера. Один источник для двух поверхностей:
// подключается и в service worker (`importScripts`), и в лабораторный стенд
// (`<script src>`), чтобы автор видел на стенде РОВНО то, что уедет в продукт.
// Никаких chrome-зависимостей: только OffscreenCanvas, он есть и там и там.
//
// ЗАКОН: показываем ОСТАВШИЙСЯ ПУТЬ, а не утекающее время. Без цифр, без красного,
// без ускорения к финалу — «сопровождает, не наказывает». Постоянно видимый обратный
// отсчёт давит; дуга остатка — нет.
(() => {
  'use strict';

  const WARM = '232,178,92';    // тёплый янтарь — палитра рейса
  const STAR = '255,226,178';   // сама звезда

  function drawIcon(size, frac, paused) {
    const c = new OffscreenCanvas(size, size);
    const x = c.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const r = size * 0.36, w = Math.max(2, size * 0.14);

    x.lineWidth = w; x.lineCap = 'round';

    // весь маршрут — еле различимое кольцо. Без него дуга не читается как ДОЛЯ:
    // глазу нужна мера, иначе видно «сколько-то», а не «сколько из скольки».
    x.strokeStyle = `rgba(${WARM},0.18)`;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();

    // оставшийся путь — от «двенадцати часов» по часовой стрелке
    if (frac > 0) {
      x.strokeStyle = `rgba(${WARM},${paused ? 0.42 : 0.95})`;
      x.beginPath();
      x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      x.stroke();
    }

    // звезда в центре — тот же смысловой центр, что и в панели
    x.fillStyle = `rgba(${STAR},${paused ? 0.5 : 0.95})`;
    x.beginPath(); x.arc(cx, cy, Math.max(1.2, size * 0.10), 0, Math.PI * 2); x.fill();

    return x.getImageData(0, 0, size, size);
  }

  globalThis.drawTimerIcon = drawIcon;
})();
