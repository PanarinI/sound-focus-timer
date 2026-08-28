#!/usr/bin/env python3
"""Промо-плитка CWS 440×280 — та, что показывается в СПИСКЕ поиска (канон 3.1).

Канон требует от неё три вещи: просто и понятно · аккуратно · КОНТРАСТНЫЙ фон. И отдельно —
мало слов, потому что ставит и не носитель языка. Поэтому: два коротких слова о том, что
расширение делает, звезда продукта, и ничего больше.

Устройство: фактура заказана у генератора (`gen_promo.py`, зерно, которого кодом не сделать),
композиция и типографика — здесь. Генератор букв не рисует: кривая надпись на витрине хуже,
чем её отсутствие.

Запуск: python3 build-promo.py [gen/promo-bg-cloth.png]
"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BG = sys.argv[1] if len(sys.argv) > 1 else "gen/promo-bg-cloth.png"

HTML = """<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#05060f}
  .t{position:relative;width:440px;height:280px;overflow:hidden;background:#05060f;
     font-family:'SF Pro Display','Inter',system-ui,sans-serif}
  /* Чистая подложка кодом: своё свечение + мелкое зерно фильтром SVG. Заказанная у генератора
     фактура проиграла — она приходит радиальным пятном с ВПЕЧАТАННЫМ прямоугольным краем,
     который маской не снять (проба 08-27, три цента). Кодом край растворяется по-настоящему. */
  .glow{position:absolute;right:-40px;top:50%%;width:430px;height:430px;transform:translateY(-50%%);
     background:radial-gradient(circle closest-side,rgba(255,201,120,.95) 0%%,rgba(242,149,31,.55) 26%%,
       rgba(180,90,30,.18) 55%%,rgba(20,25,60,0) 78%%)}
  .grain{position:absolute;inset:0;opacity:.16;mix-blend-mode:overlay;
     /* размер полотна у SVG-шума задаём ЯВНО: без него он рисуется дефолтными 300×150 и
        тайлится прямоугольниками — на плитке это читалось как квадрат вокруг свечения */
     background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/></filter><rect width='220' height='220' filter='url(%%23n)'/></svg>") repeat;background-size:220px 220px}
  .bg{display:none;position:absolute;inset:0;background:url('%(bg)s') center/cover no-repeat;
      /* фактуру приглушаем и уводим вправо-вниз: слева должно остаться место словам */
      transform:translate(22%%,14%%) scale(1.35);opacity:.92;
      /* маска обязательна: у заказанной фактуры свечение вписано в прямоугольник, и без
         растворения краёв на плитке виден квадрат вокруг пятна */
      -webkit-mask-image:radial-gradient(ellipse 62%% 78%% at 62%% 46%%,#000 34%%,transparent 100%%)}
  .star{position:absolute;left:330px;top:140px;width:96px;height:96px;transform:translate(-50%%,-50%%);
     background:radial-gradient(circle closest-side,#fff6e2 0%%,#ffd98f 22%%,#f2a955 46%%,rgba(214,120,70,.2) 72%%,rgba(214,120,70,0) 100%%)}
  .txt{position:absolute;left:34px;top:96px;z-index:3}
  .h{color:#FFF6E6;font-size:44px;font-weight:700;letter-spacing:-1.4px;line-height:1.02;
     text-shadow:0 2px 18px rgba(0,0,0,.75)}
  .s{color:#FFC978;font-size:19px;font-weight:600;margin-top:10px;letter-spacing:.2px;
     text-shadow:0 2px 14px rgba(0,0,0,.75)}
</style>
<div class="t"><div class="glow"></div><div class="grain"></div><div class="star"></div>
  <div class="txt"><div class="h">Focus timer</div><div class="s">made of warm sound</div></div>
</div>"""

path = os.path.join(HERE, "_promo.html")
with open(path, "w", encoding="utf-8") as fh:
    fh.write(HTML % {"bg": BG})
out = os.path.join(HERE, "promo-tile-440.png")
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=1", "--window-size=440,280",
                f"--screenshot={out}", f"file://{path}"], capture_output=True)
os.remove(path)
print("→", out)
