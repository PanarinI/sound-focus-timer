#!/usr/bin/env python3
"""
Кадры листинга CWS (1280×800) — «показать СУТЬ, ненавязчиво показывая интерфейс».

Не инструкция и не реклама дизайна (правка автора 08-02): каждый кадр несёт ОДНУ мысль о сути,
панель при этом просто живёт рядом и сама показывает, как этим пользуются.

Закон «инструмент = явь»: панель в кадре — НЕ рисунок, а РЕАЛЬНЫЙ `extension/hearth.html`,
поднятый в iframe и уведённый в настоящий рейс (dev-режим `fast`: 1 мин = 1 с).
Кадр снимается headless-Chrome при виртуальном времени → размер звезды честный.

Запуск:  python3 build-shots.py            (панели-сырьё + все кадры)
         python3 build-shots.py 2 4        (только выбранные кадры)
Выход:   shot-1.png … shot-4.png (ровно 1280×800) · panel-*.png (сырьё для врезок)
"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PANEL = "../../../extension/hearth.html"       # относительно shots/

PANEL_X, PANEL_Y, PANEL_W, PANEL_H = 838, 40, 360, 720   # панель на сцене = 400×800 × 0.9
SCALE = 0.9
def py(inner): return PANEL_Y + inner * SCALE            # y внутри панели → y сцены
def px(inner): return PANEL_X + inner * SCALE

# ориентиры внутри панели (400×800): звезда 320 · Finish 455 · ползунок 675 · громкость 725
Y_STAR, Y_FINISH, Y_SLIDER, Y_VOL = 320, 455, 675, 725

BOOT = """
  const WAIT = %(wait)s, DIAL = %(dial)s;
  for (const fr of document.querySelectorAll('iframe')) {
    fr.addEventListener('load', () => {
      const d = fr.contentDocument;
      try {
        d.getElementById('fast').checked = true;                 // dev: 1 мин = 1 с
        const ts = d.getElementById('timeslider');
        if (ts) { ts.value = DIAL; ts.dispatchEvent(new Event('input', {bubbles:true})); }
        if (WAIT > 0 && !fr.dataset.idle) {
          const w = d.getElementById('wrap');
          w.dispatchEvent(new Event('pointerdown'));
          w.dispatchEvent(new Event('pointerup'));
        }
      } catch (e) { document.title = 'ERR ' + e.message; }
    });
  }
"""

STAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#05060f}
  .stage{position:relative;width:1280px;height:800px;overflow:hidden;
    font-family:'SF Pro Display','Inter',system-ui,-apple-system,sans-serif;
    background:radial-gradient(ellipse 80%% 90%% at 78%% 45%%, #131c40 0%%, #090d22 52%%, #05060f 100%%);}
  .txt{position:absolute;left:92px;top:%(txt_top)spx;width:%(txt_w)spx;z-index:6}
  h1{color:#FFF6E6;font-size:%(h1)spx;font-weight:700;line-height:1.04;letter-spacing:-1.8px;margin:0}
  h1 em{color:#FFC978;font-style:normal;font-size:1.16em;letter-spacing:-2px}
  .sub{color:#9FAAC9;font-size:27px;font-weight:500;line-height:1.42;margin-top:28px}
  .sub b{color:#FFD79A;font-weight:600}
  .frame{position:absolute;left:%(px)spx;top:%(py)spx;width:%(pw)spx;height:%(ph)spx;border-radius:16px;overflow:hidden;
    border:1px solid rgba(255,255,255,.10);box-shadow:0 40px 120px rgba(0,0,0,.6),0 0 0 12px rgba(255,255,255,.018);z-index:3}
  .frame iframe{width:400px;height:800px;border:0;transform:scale(%(sc)s);transform-origin:0 0;display:block}
  .tab{position:absolute;left:%(px)spx;top:%(tab_y)spx;width:%(pw)spx;text-align:center;color:#6F7797;
    font-size:15px;font-weight:600;letter-spacing:1.6px;z-index:4}
  /* пара кадров «минута 1 → минута 24» — единственная выноска во всём наборе */
  .cell{position:absolute;z-index:6;border-radius:14px;border:1px solid rgba(255,255,255,.09);background:#070a18;
    background-repeat:no-repeat;box-shadow:0 20px 50px rgba(0,0,0,.5)}
  .clab{position:absolute;z-index:6;color:#9FAAC9;font-size:19px;font-weight:600;text-align:center}
  .arrow{position:absolute;z-index:6;color:#FFC978;font-size:34px;font-weight:700}
</style></head><body>
<div class="stage">
  <div class="txt"><h1>%(title)s</h1><div class="sub">%(sub)s</div></div>
  <div class="frame"><iframe src="%(panel)s"></iframe></div>
  <div class="tab">%(tab)s</div>
  %(marks)s
</div>
<script>%(boot)s</script>
</body></html>"""

RAW = """<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#05060f}iframe{width:400px;height:800px;border:0;display:block}</style>
</head><body><iframe src="%(panel)s"></iframe>
<script>%(boot)s</script></body></html>"""


def cell(left, top, size, src, cx, cy, label):
    """квадрат-кадр: вырезка вокруг точки (cx,cy) из готового PNG панели (400×800)"""
    return (f'<div class="cell" style="left:{left}px;top:{top}px;width:{size}px;height:{size}px;'
            f'background-image:url({src});background-position:{-(cx-size/2)}px {-(cy-size/2)}px"></div>'
            f'<div class="clab" style="left:{left}px;top:{top+size+12}px;width:{size}px">{label}</div>')


# ── ЧЕТЫРЕ МЫСЛИ (не четыре шага) ───────────────────────────────────────────────
SHOTS = [
    # 1 — ЧТО ЭТО. Ударение на SOUND (правка автора 08-02).
    dict(n=1, wait=0, dial=2, h1=70, txt_top=290, tab="CHROME SIDE PANEL", marks="",
         title="A timer made<br>of <em>sound</em>",
         sub="Warm brown noise instead of ticking and red digits."),

    # 2 — ВРЕМЯ БЕЗ ЦИФР (пара «минута 1 → минута 24» — реальные кадры одного рейса)
    dict(n=2, wait=21, dial=2, h1=66, txt_top=190, txt_w=520,
         title="Time you<br>don't count",
         sub="The star draws closer as the session runs. One glance and you know where you are.",
         tab="",
         marks=cell(92, 500, 150, "panel-idle.png", 200, 320, "minute 1")
               + '<div class="arrow" style="left:262px;top:555px">→</div>'
               + cell(312, 500, 150, "panel-late.png", 200, 320, "minute 24")),

    # 3 — ОТСТРОЙКА ОТ БЛОКЕРОВ
    dict(n=3, wait=16, dial=2, h1=64, txt_top=270, tab="", marks="",
         title="Nothing is blocked.<br>Nothing is punished.",
         sub="No sites locked, no streak to break. The sound simply holds the session together."),

    # 4 — ДВА КОНЦА: мягкий выход (реальная фаза «рассвет», DAWN = 120 с)
    dict(n=4, wait=65, dial=0, h1=64, txt_top=270, tab="", marks="",
         title="It ends like a sunrise,<br>not an alarm",
         sub="Over the last two minutes the sound brightens and lets you go."),
]


def chrome(src, out, w, h, budget):
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required",
        "--force-device-scale-factor=2", f"--virtual-time-budget={budget}",
        f"--window-size={w},{h}", f"--screenshot={out}", f"file://{src}",
    ], capture_output=True)
    subprocess.run(["sips", "-z", str(h), str(w), out], capture_output=True)


def build_panel(name, wait, dial=2):
    src = os.path.join(HERE, f"_raw-{name}.html")
    out = os.path.join(HERE, f"panel-{name}.png")
    open(src, "w").write(RAW % dict(panel=PANEL, boot=BOOT % dict(wait=wait, dial=dial)))
    chrome(src, out, 400, 800, 3000 + wait * 1000)
    print(f"panel-{name}.png ({wait}s)")


def build(shot):
    src = os.path.join(HERE, f"shot-{shot['n']}.html")
    out = os.path.join(HERE, f"shot-{shot['n']}.png")
    open(src, "w").write(STAGE % dict(
        panel=PANEL, boot=BOOT % dict(wait=shot["wait"], dial=shot["dial"]),
        h1=shot["h1"], txt_top=shot["txt_top"], txt_w=shot.get("txt_w", 640),
        title=shot["title"], sub=shot["sub"], marks=shot["marks"], tab=shot["tab"],
        px=PANEL_X, py=PANEL_Y, pw=PANEL_W, ph=PANEL_H, sc=SCALE,
        tab_y=PANEL_Y + PANEL_H + 18))
    chrome(src, out, 1280, 800, 3000 + shot["wait"] * 1000)
    print(f"shot-{shot['n']}.png ({shot['wait']}s полёта)")


if __name__ == "__main__":
    only = set(sys.argv[1:])
    if not only:
        build_panel("idle", 0)
        build_panel("late", 21)
    for s in SHOTS:
        if only and str(s["n"]) not in only:
            continue
        build(s)
