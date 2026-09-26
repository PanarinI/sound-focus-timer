#!/usr/bin/env python3
"""Кадр «шум закрывает звуки вокруг» — 1280×800, было → стало.

Мысль (слово автора 08-27): показать не «здесь есть звук», а что от него происходит с человеком.
Приём взят у ExportGPT: было → стрелка → стало, в одном кадре, понятно без языка. Это функция
МАСКИРОВКИ, а не блокировки: голоса вокруг не запрещены, они просто перестают доставать до работы.

26.09 — перерисовано в язык панели 1.2.0 (разбор в dizajn/ZHURNAL.md: «мысль оставить, перерисовать»):
тёплое почти-чёрное поле, окно работы цвета органов панели, голоса — зигзаги холодного серого (чужой
звук), янтарная стрелка. Кокон справа — тёплое свечение и КРУПА: так панель сама рисует маскировку
(таблица «звук → картинка»: маскировка = покрытие поля, «стена между тобой и миром»). Крупа
коричневого шума — те же 12 px на крупинку, что в панели. Подписей нет: слова ждут имени.

**Слово автора 26.09: в набор не идёт** — «идея интересная, но не считывает прямо сразу… схематично».
В сторе остаётся прежний shot-feel.png; код, которым рисовали прежние варианты, — в git (1e52757).

НЕ ЗАТИРАТЬ (правило автора 08-27): прогон кладёт кадр в variants/, в дело — копия после слова автора.
    python3 build-feel.py            → variants/shot-feel--raw.png
    python3 build-feel.py <имя>      → variants/shot-feel--<имя>.png
"""
import math, os, random, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
VARIANT = sys.argv[1] if len(sys.argv) > 1 else "raw"
VARDIR = os.path.join(HERE, "variants")
os.makedirs(VARDIR, exist_ok=True)
OUT = os.path.join(VARDIR, f"shot-feel--{VARIANT}.png")
random.seed(7)

CY = 372                       # середина обеих сцен; низ кадра свободен под будущую подпись
LEFT, RIGHT = 330, 950         # центры «было» и «стало»
WW, WH = 250, 168              # окно работы
DOME = 250                     # радиус кокона
VOICE = "#aeb5c0"              # голоса вокруг — холодный серый, чужой звук рядом с тёплым


def window(cx):
    """Окно работы в цветах органов панели (плашка пресетов #141110, рамка #2e2825)."""
    x, y = cx - WW / 2, CY - WH / 2
    lines = "".join(f"<rect x='20' y='{48 + i * 17}' width='{w}' height='6' rx='3' fill='#3a322c'/>"
                    for i, w in enumerate([196, 168, 208, 150, 184, 120]))
    return (f"<g transform='translate({x:.0f},{y:.0f})'>"
            f"<rect width='{WW}' height='{WH}' rx='9' fill='#141110' stroke='#2e2825' stroke-width='1.4'/>"
            f"<path d='M0 9 Q0 0 9 0 H{WW - 9} Q{WW} 0 {WW} 9 V26 H0 Z' fill='#1c1714'/>"
            "<circle cx='16' cy='13' r='3.4' fill='#4a423b'/><circle cx='28' cy='13' r='3.4' fill='#4a423b'/>"
            f"<circle cx='40' cy='13' r='3.4' fill='#4a423b'/>{lines}</g>")


# голоса: откуда идут (угол от центра сцены, градусы) и докуда достают — до кромки окна
VOICES = [(-162, 1.0), (-96, 0.9), (-28, 0.85), (18, 0.8), (152, 1.05), (205, 0.9)]


def edge(cx, a):
    """Точка на кромке окна по лучу из центра."""
    dx, dy = math.cos(a), math.sin(a)
    k = min((WW / 2) / abs(dx) if dx else 1e9, (WH / 2) / abs(dy) if dy else 1e9)
    return cx + dx * k, CY + dy * k


def voice(cx, deg, reach, damped):
    """Голос — зигзаг речи, летящий к работе. В коконе (damped) он не доходит до окна: у кромки
    купола дрожь стихает и линия тает за 40 px — «перестаёт доставать», а не упирается в стену."""
    a = math.radians(deg)
    x1, y1 = edge(cx, a)
    r0 = 330 * reach
    x0, y0 = cx + math.cos(a) * r0, CY + math.sin(a) * r0 * 0.82
    if damped and math.hypot(x0 - cx, y0 - CY) < DOME + 70:   # голос рождается снаружи купола
        k0 = (DOME + 70) / math.hypot(x0 - cx, y0 - CY)
        x0, y0 = cx + (x0 - cx) * k0, CY + (y0 - CY) * k0
    L = math.hypot(x1 - x0, y1 - y0)
    if damped:                                              # докуда живёт голос: кромка купола + 40 px
        bx, by = x0 - cx, y0 - CY                           # пересечение луча с окружностью купола
        ux, uy = (x1 - x0) / L, (y1 - y0) / L
        b = bx * ux + by * uy
        t_in = -b - math.sqrt(max(0.0, b * b - (bx * bx + by * by - DOME * DOME)))
        end = min(L, t_in + 40)
    else:
        t_in, end = L, L
    n, px, py = 46, -math.sin(a), math.cos(a)             # вдоль луча, дрожь — поперёк
    pts = []
    for i in range(n + 1):
        d = end * i / n
        x, y = x0 + (x1 - x0) * d / L, y0 + (y1 - y0) * d / L
        amp = 15 * (0.55 + 0.45 * math.sin(d / L * 7 + deg)) * random.uniform(0.25, 1)
        if damped and d > t_in:
            amp *= max(0.0, 1 - (d - t_in) / 40)            # внутри купола дрожь стихает
        s = 1 if i % 2 else -1
        pts.append(f"{x + px * amp * s:.1f},{y + py * amp * s:.1f}")
    if not damped:
        return (f"<polyline points='{' '.join(pts)}' fill='none' stroke='{VOICE}' stroke-opacity='.95' "
                f"stroke-width='2.1' stroke-linejoin='round' stroke-linecap='round'/>")
    gid = f"g{int(cx)}{deg}".replace('-', 'm')
    ex, ey = x0 + (x1 - x0) * end / L, y0 + (y1 - y0) * end / L
    k = t_in / end
    return (f"<linearGradient id='{gid}' gradientUnits='userSpaceOnUse' x1='{x0:.0f}' y1='{y0:.0f}' "
            f"x2='{ex:.0f}' y2='{ey:.0f}'><stop offset='0' stop-color='{VOICE}' stop-opacity='.6'/>"
            f"<stop offset='{k:.2f}' stop-color='{VOICE}' stop-opacity='.5'/>"
            f"<stop offset='1' stop-color='{VOICE}' stop-opacity='0'/></linearGradient>"
            f"<polyline points='{' '.join(pts)}' fill='none' stroke='url(#{gid})' "
            f"stroke-width='2.1' stroke-linejoin='round' stroke-linecap='round'/>")


svg = "".join([
    *(voice(LEFT, d, r, False) for d, r in VOICES),
    window(LEFT),
    # стрелка: приём ExportGPT, читается без языка; янтарь — тёплый панели
    f"<g stroke='#ffb055' stroke-width='5' fill='none' stroke-linecap='round' stroke-linejoin='round'>"
    f"<line x1='612' y1='{CY}' x2='668' y2='{CY}'/><polyline points='652,{CY - 14} 668,{CY} 652,{CY + 14}'/></g>",
    f"<circle cx='{RIGHT}' cy='{CY}' r='{DOME}' fill='url(#kokon)'/>",
    *(voice(RIGHT, d, r, True) for d, r in VOICES),
])

HTML = f"""<!doctype html><meta charset="utf-8"><style>
  html,body{{margin:0;padding:0;background:#070606}}
  .s{{position:relative;width:1280px;height:800px;overflow:hidden;
     background:radial-gradient(ellipse 88% 96% at 50% 46%,#1d150f 0%,#0f0c0a 54%,#070606 100%)}}
  svg{{position:absolute;inset:0}}
  /* крупа кокона: маленький буфер, растянутый со сглаживанием, — так рисует зерно сама панель */
  canvas{{position:absolute;left:{RIGHT - DOME}px;top:{CY - DOME}px;width:{2 * DOME}px;height:{2 * DOME}px;
     mix-blend-mode:overlay;opacity:.5;
     -webkit-mask-image:radial-gradient(circle,#000 0%,#000 48%,transparent 70%);
     mask-image:radial-gradient(circle,#000 0%,#000 48%,transparent 70%)}}
  .top{{z-index:2}}
</style>
<div class="s">
  <svg width="1280" height="800" viewBox="0 0 1280 800"><defs>
    <radialGradient id="kokon" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffb055" stop-opacity=".34"/>
      <stop offset="55%" stop-color="#ffb055" stop-opacity=".13"/>
      <stop offset="100%" stop-color="#ffb055" stop-opacity="0"/>
    </radialGradient></defs>{svg}</svg>
  <canvas id="krupa" width="{round(2 * DOME / 12)}" height="{round(2 * DOME / 12)}"></canvas>
  <svg class="top" width="1280" height="800" viewBox="0 0 1280 800">{window(RIGHT)}</svg>
</div>
<script>
  // тот же рецепт, что у панели (hearth.js sloi): яркость 80 + случайное · тёплый оттенок коричневого
  let s = 7; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const c = document.getElementById('krupa'), x = c.getContext('2d'), img = x.createImageData(c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {{
    const v = 80 + rnd() * 160;
    img.data[i] = v; img.data[i + 1] = v * 0.80; img.data[i + 2] = v * 0.56; img.data[i + 3] = 190;
  }}
  x.putImageData(img, 0, 0);
</script>"""

path = os.path.join(HERE, "_feel.html")
open(path, "w", encoding="utf-8").write(HTML)
tmp = OUT + ".2x.png"
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--use-mock-keychain",
                "--no-first-run", "--force-device-scale-factor=2", "--window-size=1280,800",
                "--virtual-time-budget=1500", f"--screenshot={tmp}", f"file://{path}"], capture_output=True)
subprocess.run(["sips", "-z", "800", "1280", tmp, "--out", OUT], capture_output=True)
os.remove(path); os.remove(tmp)
print("→", os.path.relpath(OUT, HERE), f"{os.path.getsize(OUT) // 1024} КБ")
