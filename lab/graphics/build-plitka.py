#!/usr/bin/env python3
"""Плитка выдачи 440×280 под Brown Noise Generator (выпуск 1.2), 27.09.2026.

Канон 3.1: плитку видят в общем списке стора, её задача — зацепить взгляд. Контрастный фон, по центру
тематическая иконка, подпись о сути, мало слов (ставит и не носитель языка). Документация Google: плитка
не локализуется — одна на все языки, поэтому текста минимум: имя (английская часть имени есть на всех языках).
Язык — панели: тёплое почти-чёрное поле, янтарное свечение, лёгкое зерно (видимый шум). Знак — шкала и звезда
из иконки (`icon-2026-09-26-b-dajl.svg`) без квадратной подложки: на плитке светится сам знак.
    python3 build-plitka.py v1   → shots/variants/plitka-{a-centr,b-sleva}--v1.png
"""
import os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
VARIANT = sys.argv[1] if len(sys.argv) > 1 else "base"
OUTDIR = os.path.join(HERE, "shots", "variants")

svg = open(os.path.join(HERE, "icon-2026-09-26-b-dajl.svg"), encoding="utf-8").read()
svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
ZNAK = re.sub(r'<rect [^>]*fill="url\(#pole\)"/>', "", svg)            # знак без квадратной подложки
ZNAK = ZNAK.replace('width="128" height="128"', 'width="100%" height="100%"')

PAGE = """<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:#0a0908}
  .t{position:relative;width:440px;height:280px;overflow:hidden;
     background:radial-gradient(ellipse 70%% 90%% at %(gx)s %(gy)s,#2a1b0f 0%%,#140f0c 45%%,#0a0908 100%%);
     font-family:'SF Pro Display','Inter',system-ui,-apple-system,sans-serif}
  .glow{position:absolute;left:%(gx)s;top:%(gy)s;width:300px;height:300px;transform:translate(-50%%,-50%%);border-radius:50%%;
        background:radial-gradient(circle closest-side,rgba(255,176,85,.30) 0%%,rgba(255,176,85,.10) 45%%,rgba(255,176,85,0) 100%%)}
  canvas{position:absolute;inset:0;width:440px;height:280px;mix-blend-mode:screen;opacity:.22}
  .znak{position:absolute;%(znak)s}
  .nm{position:absolute;%(nm)s;color:#fbf2e4;font-weight:700;letter-spacing:-.8px;line-height:1.02;
      text-shadow:0 2px 16px rgba(0,0,0,.6)}
  .sub{position:absolute;%(sub)s;color:#ffb055;font-weight:600;font-size:15px;letter-spacing:.2px}
</style>
<div class="t"><div class="glow"></div><canvas id="z" width="220" height="140"></canvas>
  <div class="znak">%(svg)s</div><div class="nm">%(name)s</div>%(subdiv)s</div>
<script>
const c = document.getElementById('z'), x = c.getContext('2d'), im = x.createImageData(220, 140), d = im.data;
for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 120; d[i] = v; d[i+1] = v * .78; d[i+2] = v * .52; d[i+3] = 255; }
x.putImageData(im, 0, 0);
</script>"""

VARIANTS = {
    "a-centr": dict(gx="50%", gy="38%", znak="left:50%;top:22px;width:132px;height:132px;transform:translateX(-50%)",
                    nm="left:0;right:0;top:170px;text-align:center;font-size:36px", name="Brown Noise Generator",
                    sub="", subdiv=""),
    "b-sleva": dict(gx="28%", gy="48%", znak="left:22px;top:50%;width:150px;height:150px;transform:translateY(-54%)",
                    nm="left:186px;top:78px;font-size:38px", name="Brown Noise<br>Generator",
                    sub="left:188px;top:172px", subdiv='<div class="sub">no ads · for focus</div>'),
}


def shoot(html, out):
    with tempfile.NamedTemporaryFile("w", suffix=".html", dir=HERE, delete=False, encoding="utf-8") as f:
        f.write(html); src = f.name
    tmp = out + ".2x.png"
    try:
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                        "--window-size=440,280", "--virtual-time-budget=1500", f"--screenshot={tmp}", f"file://{src}"],
                       capture_output=True, timeout=90)
    finally:
        os.remove(src)
    subprocess.run(["sips", "-z", "280", "440", tmp, "--out", out], capture_output=True)
    os.remove(tmp)
    print("→", os.path.relpath(out, HERE), f"{os.path.getsize(out) // 1024} КБ")


if __name__ == "__main__":
    for key, v in VARIANTS.items():
        shoot(PAGE % dict(v, svg=ZNAK), os.path.join(OUTDIR, f"plitka-{key}--{VARIANT}.png"))
