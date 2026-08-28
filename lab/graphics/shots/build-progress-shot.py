#!/usr/bin/env python3
"""Кадр листинга «сколько осталось» 1280×800.

Прошлая версия показывала только рост звезды, и на неё справедливо спрашивалось «и?» (автор 08-27):
из картинки не следовало, что это вообще ТАЙМЕР. Теперь на кадре есть и то, и другое: иконка в
тулбаре с числом оставшихся минут (табло 1.1.4) и сама панель, где то же самое сказано расстоянием.

Закон «инструмент = явь»: обе панели — реальный `hearth.html`, уведённый в настоящий рейс на 25
минут в dev-режиме `fast` (1 минута = 1 секунда). Слева 1-я минута, справа 13-я; числа на иконках
(24 и 12) — ровно то, что в эти моменты показывает `paintBadge`.
"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# НЕ ЗАТИРАТЬ (правило автора 08-27): прогон кладёт свой вариант в `variants/` под именем,
# а в дело идёт копия, сделанная руками после слова автора. Раньше каждый прогон писал поверх
# одного файла, и вернуться к принятой версии было некуда.
#     python3 build-progress-shot.py <имя>      → variants/shot-progress--<имя>.png
#     cp variants/shot-progress--<имя>.png shot-progress.png
VARIANT = (sys.argv[1] if len(sys.argv) > 1 else "base")
VARDIR = os.path.join(HERE, "variants")
os.makedirs(VARDIR, exist_ok=True)
OUT = os.path.join(VARDIR, f"shot-progress--{VARIANT}.png")

def icon(n):
    """Иконка расширения в тулбаре с баджем — тот же вид, что человек увидит у себя."""
    return f"""<div class="ic"><img src="../icon128.png"><div class="badge">{n}</div></div>"""

HTML = """<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#05060f}
  .s{position:relative;width:1280px;height:800px;overflow:hidden;
     font-family:'SF Pro Display','Inter',system-ui,-apple-system,sans-serif;
     background:radial-gradient(ellipse 96%% 92%% at 50%% 40%%,#16204a 0%%,#0a0f26 58%%,#05060f 100%%)}
  .row{position:absolute;left:0;right:0;top:82px;display:flex;justify-content:center;align-items:flex-start;gap:104px}
  .col{text-align:center}
  .ic{position:relative;width:96px;height:96px;margin:0 auto 22px}
  .ic img{width:96px;height:96px;border-radius:22px;display:block}
  .badge{position:absolute;right:-10px;bottom:-6px;min-width:44px;height:32px;border-radius:9px;
     background:#2a2119;color:#e8b25c;font-size:21px;font-weight:700;line-height:32px;padding:0 8px;
     box-shadow:0 4px 14px rgba(0,0,0,.55)}
  .card{width:270px;height:392px;border-radius:16px;overflow:hidden;
     box-shadow:0 26px 64px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08)}
  .card img{width:270px;height:540px;display:block;margin-top:-54px}
  .lab{margin-top:18px;color:#9fb0d4;font-size:20px;font-weight:600}
  .arw{color:#FFC978;font-size:42px;font-weight:300;margin-top:210px}
  /* Не проза, а ВЫНОСКИ: «тут минуты — тут звезда». Фокус кадра — показать, что у продукта есть
     функция таймера, несмотря на его загадочность. Это не инструкция к пользованию, а доказательство. */
  .call{position:absolute;color:#FFC978;font-size:21px;font-weight:600;white-space:nowrap}
  .dial{position:absolute;left:0;right:0;bottom:52px;text-align:center;color:#FFF6E6;
     font-size:30px;font-weight:600;letter-spacing:6px}
</style>
<div class="s">
  <div class="row">
    <div class="col">%(i1)s<div class="card"><img src="panel-early.png"></div></div>
    <div class="arw">&#8594;</div>
    <div class="col">%(i2)s<div class="card"><img src="panel-late.png"></div></div>
  </div>
  <svg width="1280" height="800" viewBox="0 0 1280 800" style="position:absolute;inset:0;pointer-events:none">
    <g stroke="#FFC978" stroke-width="1.6" fill="none" opacity=".8">
      <path d="M232 150 H338 Q370 150 376 168"/>
      <circle cx="232" cy="150" r="3" fill="#FFC978"/>
      <path d="M900 588 V412"/>
      <circle cx="900" cy="588" r="3" fill="#FFC978"/>
    </g>
  </svg>
  <div class="call" style="left:78px;top:114px">minutes left</div>
  <div class="call" style="left:900px;top:600px;transform:translateX(-50%%)">the star comes closer</div>
  <div class="dial">5 · 15 · 25 · 45 · 90 · &#8734;</div>
</div>"""

p = os.path.join(HERE, "_prog.html")
open(p, "w", encoding="utf-8").write(HTML % {"i1": icon(24), "i2": icon(12)})
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=1", "--window-size=1280,800",
                f"--screenshot={OUT}", f"file://{p}"], capture_output=True)
os.remove(p)
print("→", OUT)
