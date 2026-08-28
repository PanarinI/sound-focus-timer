#!/usr/bin/env python3
"""Кадр «ощущение звука» — 1280×800, до/после внимания.

Задача (слово автора 08-27): показать НЕ «здесь есть звук», а что от него происходит с человеком.
Приём взят у ExportGPT: было → стрелка → стало, в одном кадре. Понятно без языка.

Что показано, по-честному: это функция МАСКИРОВКИ, а не блокировки. Слева внешние звуки достают
до работы; справа тёплый купол их гасит — они остаются снаружи и притупляются. Мы ничего не
запрещаем и никого не наказываем, и картинка не должна этого обещать.

Слов минимум (канон 3.1: ставит и не носитель языка). Одна фраза, конкретная, без игры слов.
"""
import os, subprocess, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
random.seed(7)

def spikes(cx, cy, n, r0, r1, colour, w0, w1):
    """Острые внешние звуки, летящие к работе. Углы разведены неравномерно — не звезда, а помеха."""
    out = []
    for i in range(n):
        a = (i / n) * 2 * math.pi + random.uniform(-0.18, 0.18)
        x1, y1 = cx + math.cos(a) * r0, cy + math.sin(a) * r0 * 0.78
        x2, y2 = cx + math.cos(a) * r1, cy + math.sin(a) * r1 * 0.78
        out.append(f"<line x1='{x2:.0f}' y1='{y2:.0f}' x2='{x1:.0f}' y2='{y1:.0f}' "
                   f"stroke='{colour}' stroke-width='{random.uniform(w0,w1):.1f}' stroke-linecap='round'/>")
    return "".join(out)

WINDOW = """
  <g transform='translate(%(x)s,%(y)s)' opacity='%(op)s'>
    <rect width='250' height='168' rx='11' fill='#0e1430' stroke='#2b3californ' stroke-width='1.4'/>
    <rect width='250' height='26' rx='11' fill='#161d3d'/><rect y='16' width='250' height='10' fill='#161d3d'/>
    <circle cx='16' cy='13' r='3.4' fill='#3d4straight'/><circle cx='28' cy='13' r='3.4' fill='#3d4a72'/>
    <circle cx='40' cy='13' r='3.4' fill='#3d4a72'/>
    %(lines)s
  </g>"""

def window(x, y, op=1.0):
    lines = "".join(
        f"<rect x='20' y='{48 + i*17}' width='{w}' height='6' rx='3' fill='#28345c'/>"
        for i, w in enumerate([196, 168, 208, 150, 184, 120]))
    return (WINDOW % {"x": x, "y": y, "op": op, "lines": lines}) \
        .replace("#2b3californ", "#243157").replace("#3d4straight", "#3d4a72")

HTML = f"""<!doctype html><meta charset="utf-8"><style>
  html,body{{margin:0;padding:0;background:#05060f}}
  .s{{position:relative;width:1280px;height:800px;overflow:hidden;background:#05060f;
     font-family:'SF Pro Display','Inter',system-ui,sans-serif;
     background:radial-gradient(ellipse 90% 100% at 50% 42%,#131c40 0%,#090d22 55%,#05060f 100%)}}
  .cap{{position:absolute;left:0;right:0;bottom:74px;text-align:center;color:#FFF6E6;
     font-size:38px;font-weight:700;letter-spacing:-1px}}
  .sub{{position:absolute;left:0;right:0;bottom:40px;text-align:center;color:#93a2c4;
     font-size:19px;font-weight:500}}
</style>
<div class="s">
  <svg width="1280" height="800" viewBox="0 0 1280 800">
    <defs>
      <radialGradient id="dome" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFC061" stop-opacity=".30"/>
        <stop offset="58%" stop-color="#F2941F" stop-opacity=".13"/>
        <stop offset="100%" stop-color="#F2941F" stop-opacity="0"/>
      </radialGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="3.2"/></filter>
    </defs>

    <!-- БЫЛО: внешние звуки достают до работы -->
    {spikes(330, 330, 13, 150, 330, '#7b8fbe', 2.0, 4.2)}
    {window(205, 246, 1)}

    <!-- стрелка: приём ExportGPT, читается без языка -->
    <g stroke="#FFC978" stroke-width="5" fill="none" stroke-linecap="round">
      <line x1="612" y1="330" x2="668" y2="330"/>
      <polyline points="652,316 668,330 652,344"/>
    </g>

    <!-- СТАЛО: тот же кадр, но звуки остаются снаружи тёплого купола -->
    <g filter="url(#soft)" opacity=".45">{spikes(950, 330, 13, 268, 372, '#5d6d95', 2.0, 4.2)}</g>
    <circle cx="950" cy="330" r="250" fill="url(#dome)"/>
    {window(825, 246, 1)}
  </svg>
  <div class="cap">Warm noise covers the sounds around you</div>
  <div class="sub">Your work stays where it was. What pulls at it stops reaching.</div>
</div>"""

path = os.path.join(HERE, "_feel.html")
open(path, "w", encoding="utf-8").write(HTML)
out = os.path.join(HERE, "shot-feel.png")
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=1", "--window-size=1280,800",
                f"--screenshot={out}", f"file://{path}"], capture_output=True)
os.remove(path)
print("→", out)
