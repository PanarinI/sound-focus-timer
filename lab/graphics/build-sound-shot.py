#!/usr/bin/env python3
"""Кадр листинга «ощущение звука» 1280×800.

ИСТОРИЯ ОТКАТА (08-27, важно для того, кто придёт после). Этот кадр дважды уводило в сторону:
сначала в живопись (армянская манера, красиво), потом в холст-в-рамке. Оба раза автор отверг одним
доводом, и довод верный: **«ушли в красоту, а у красоты должен быть смысл»**. Уютная комната маслом
ничего не говорила про НАШ звук — под неё подошёл бы любой продукт; выставление красоты напоказ
слайду не работа. Живописные пробы остались в `gen/feel-arm-*.png`, в дело не идут.

Что вернули и почему оно работает: тёмная сцена, где человек РАБОТАЕТ, и дуги сигнала расходятся от
экрана — источник назван, тепло вокруг работы видно, ничего лишнего. Сцена заказана у генератора
через референсы (`gen_feel.py`, вариант `far`), кадрирование и буквы — кодом.
"""
import os, subprocess, math, sys
HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC = os.path.join(HERE, "gen", "feel-far.png")
# НЕ ЗАТИРАТЬ (правило автора 08-27). Раньше каждый прогон писал поверх одного файла, и вернуться
# к принятой версии было некуда. Теперь прогон кладёт свой вариант в `shots/variants/` под именем,
# а в дело идёт копия, сделанная руками после слова автора:
#     python3 build-sound-shot.py arcs          → variants/shot-sound--arcs.png
#     cp shots/variants/shot-sound--arcs.png shots/shot-sound.png
VARIANT = (sys.argv[1] if len(sys.argv) > 1 else "arcs")
VARDIR = os.path.join(HERE, "shots", "variants")
os.makedirs(VARDIR, exist_ok=True)
OUT = os.path.join(VARDIR, f"shot-sound--{VARIANT}.png")


def ring(cx, cy, rx, ry, seed, op, w):
    """Дуга звука от экрана ноутбука. Разомкнута снизу — так рисуют расходящийся сигнал, а замкнутое
    кольцо вокруг фигуры читалось аурой, будто звучит человек (обе правки автора 08-27).
    Неровность едва заметная: ±2.5 % на одной низкой волне — сильнее выходит карта высот."""
    pts = []
    A0, A1, N = math.pi * 1.04, math.pi * 1.96, 96
    for i in range(N + 1):
        a = A0 + (A1 - A0) * i / N
        k = 1 + 0.016 * math.sin(a * 2 + seed) + 0.009 * math.sin(a * 3 + seed * 1.6)
        pts.append(f"{cx + math.cos(a) * rx * k:.1f},{cy + math.sin(a) * ry * k:.1f}")
    return (f"<polyline points='{' '.join(pts)}' fill='none' stroke='#FFC978' "
            f"stroke-opacity='{op}' stroke-width='{w}' stroke-linecap='round'/>")


RINGS = "".join([                       # центр — экран, не фигура
    ring(838, 512, 132, 100, 0.7, .22, 2.2),
    ring(838, 512, 232, 176, 2.1, .15, 2.0),
    ring(838, 512, 348, 264, 4.4, .10, 1.8),
    ring(838, 512, 480, 364, 5.9, .06, 1.6),
])

HTML = """<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#05060f}
  .s{position:relative;width:1280px;height:800px;overflow:hidden;background:#05060f;
     font-family:'SF Pro Display','Inter',system-ui,-apple-system,sans-serif}
  .bg{position:absolute;inset:0;background:url('%(src)s') 50%% 88%%/1280px auto no-repeat}
  .rip{position:absolute;inset:0}
  .txt{position:absolute;left:88px;top:96px;z-index:3}
  .h{color:#FFF6E6;font-size:60px;font-weight:700;letter-spacing:-1.8px;line-height:1.05;
     text-shadow:0 3px 26px rgba(0,0,0,.8)}
</style>
<div class="s">
  <div class="bg"></div><div class="vig"></div>
  <svg class="rip" width="1280" height="800" viewBox="0 0 1280 800">%(rings)s</svg>
  <div class="txt"><div class="h">Work inside<br>a warm sound</div></div>
</div>"""

p = os.path.join(HERE, "_sound.html")
open(p, "w", encoding="utf-8").write(HTML % {"src": SRC, "rings": RINGS})
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=1", "--window-size=1280,800",
                f"--screenshot={OUT}", f"file://{p}"], capture_output=True)
os.remove(p)
print("→", OUT)
