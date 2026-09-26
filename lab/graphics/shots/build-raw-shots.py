#!/usr/bin/env python3
"""Сырые кадры листинга 1280×800 с новой панели 1.2.0 — БЕЗ подписей: слова ждут имени.

Закон кадра «инструмент = явь» (README): панель — настоящий `extension/hearth.html` в iframe headless-Chrome,
и управляется она теми же входами, что у человека: клик по Start, по пресету, по цвету, стрелка на дайле.
Рейс перематывается сдвигом начала рейса назад — тем же приёмом, каким движок продолжает рейс после паузы
(engine.resume: «сдвиг старта — линия времени продолжается»). Звук для кадра не нужен: --mute-audio.

Четыре кадра:
  1 pokoj   — браузер: страница и панель в покое (первое открытие: open office, 15′)
  2 rejs    — браузер: 7-я минута рейса на 25′ — зерно, отсчёт 18′ 42″, на иконке бейдж «19»
  3 presety — панель, открыт список пресетов
  4 cveta   — три панели в рейсе: brown (open office) · pink (café) · white (цвет нажат руками → custom)

НЕ ЗАТИРАТЬ (правило автора 08-27): прогон кладёт кадры в variants/ под именем варианта,
в дело идёт копия, сделанная руками после слова автора.
    python3 build-raw-shots.py            → variants/raw-{1..4}-*--base.png
    python3 build-raw-shots.py 2 4 v2     → только кадры 2 и 4, вариант v2
    python3 build-raw-shots.py panel dom  → только снимок панели variants/panel-dom--base.png
        (dom — панель под окно слайда «где это живёт», его собирает build-home-shot.py)
Снимки самой панели (сырьё кадров) остаются рядом: variants/panel-*--<вариант>.png.
"""
import os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.normpath(os.path.join(HERE, "../../../extension"))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
VARDIR = os.path.join(HERE, "variants")
FLAGS = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--use-mock-keychain", "--no-first-run",
         "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required", "--mute-audio",
         "--force-device-scale-factor=2"]

args = sys.argv[1:]
ONLY_PANEL = args[1] if len(args) > 1 and args[0] == "panel" else None
if ONLY_PANEL:
    args = []
ONLY = {a for a in args if a.isdigit()}
VARIANT = next((a for a in args if not a.isdigit()), "base")
os.makedirs(VARDIR, exist_ok=True)

MIN6 = 378   # 6′ 18″ прожито → на 25′ осталось 18′ 42″, бейдж округляет вверх: 19

# ── СНИМКИ ПАНЕЛИ ────────────────────────────────────────────────────────────────
# шаги — входы человека; dial:25 — стрелками до деления, shift — перемотка рейса
PANELS = {
    "pokoj":   dict(size=(366, 608), steps=[]),
    "rejs":    dict(size=(366, 608), steps=["dial:25", "start", f"shift:{MIN6}"]),
    "presety": dict(size=(380, 760), steps=["drop"]),
    "brown":   dict(size=(380, 760), steps=["dial:25", "start", f"shift:{MIN6}"]),
    "pink":    dict(size=(380, 760), steps=["preset:cafe", "dial:25", "start", f"shift:{MIN6}"]),
    "white":   dict(size=(380, 760), steps=["colour:white", "dial:25", "start", f"shift:{MIN6}"]),
    "dom":     dict(size=(366, 618), steps=[]),   # покой под боковую полосу слайда build-home-shot.py
}

WRAP = """<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#0d0c0b;overflow:hidden}iframe{position:fixed;left:0;top:0;border:0;width:%(w)spx;height:%(h)spx}</style>
<iframe src="file://%(src)s"></iframe>
<script>
const STEPS = %(steps)s;
const fr = document.querySelector('iframe');
fr.addEventListener('load', async () => {
  const w = fr.contentWindow, d = fr.contentDocument, pause = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await pause(300);
    for (const s of STEPS) {
      const [k, v] = s.split(':');
      if (k === 'dial') {                                   // стрелки на дайле — как с клавиатуры
        const dial = d.getElementById('dial');
        for (let i = 0; i < 6 && +dial.getAttribute('aria-valuenow') !== +v; i++) {
          const key = +dial.getAttribute('aria-valuenow') < +v ? 'ArrowRight' : 'ArrowLeft';
          dial.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        }
      } else if (k === 'start') d.getElementById('start').click();
      else if (k === 'inf') d.getElementById('inf').click();          // режим без конца: шкалы нет
      else if (k === 'drop') d.getElementById('dropbtn').click();
      else if (k === 'preset') { d.getElementById('dropbtn').click(); d.querySelector(`#droplist li[data-p="${v}"]`).click(); }
      else if (k === 'colour') d.querySelector(`#colors b[data-c="${v}"]`).click();
      else if (k === 'shift') w.eval(`engine.sessionStart -= ${+v}; engine.phaseStart -= ${+v}; engine._tick();`);
      await pause(250);
    }
  } catch (e) { document.title = 'ERR ' + e.message; }
});
</script>"""


def shoot(page_html, w, h, out, budget=4500, dpr=2):
    """Страница → PNG в двойном разрешении (для панели) или ровно w×h (для кадра, ужатием sips)."""
    with tempfile.NamedTemporaryFile("w", suffix=".html", dir=HERE, delete=False, encoding="utf-8") as f:
        f.write(page_html)
        src = f.name
    try:
        flags = [f for f in FLAGS if not f.startswith("--force-device-scale-factor")]
        subprocess.run([CHROME, *flags, f"--force-device-scale-factor={dpr}",
                        f"--window-size={w},{h}", f"--virtual-time-budget={budget}",
                        f"--screenshot={out}", f"file://{src}"], capture_output=True, timeout=90)
    finally:
        os.remove(src)
    if not os.path.exists(out):
        sys.exit(f"Chrome не снял {out}")


def panel(name):
    p = PANELS[name]
    w, h = p["size"]
    out = os.path.join(VARDIR, f"panel-{name}--{VARIANT}.png")
    steps = "[" + ",".join(f'"{s}"' for s in p["steps"]) + "]"
    shoot(WRAP % dict(w=w, h=h, src=os.path.join(EXT, "hearth.html"), steps=steps), w, h, out,
          dpr=p.get("dpr", 2))
    return out


# ── КАДРЫ ────────────────────────────────────────────────────────────────────────
# кнопка расширения и бейдж — по исходнику Chrome (как на стенде иконки, lab/stend-ikonka-2026-09-26.html)
ACTION_JS = """
function chromeAction(img, text, k, bg) {
  const c = document.createElement('canvas'); c.width = c.height = 28 * k;
  const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 28 * k, 28 * k);
  x.imageSmoothingQuality = 'high'; x.drawImage(img, 6 * k, 6 * k, 16 * k, 16 * k);
  if (text) {
    x.font = `bold ${9 * k}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const tw = Math.min(23, Math.ceil(x.measureText(text).width / k)); let w = tw + 4;
    if (w %% 2) w += 1; w = Math.max(14, w);
    const bx = w >= 20 ? Math.floor((28 - w) / 2) : 28 - w, by = 14;
    x.fillStyle = bg; x.beginPath(); x.roundRect((bx - 1) * k, (by - 1) * k, (w + 2) * k, 16 * k, 3 * k); x.fill();
    x.fillStyle = '#2a2119'; x.beginPath(); x.roundRect(bx * k, by * k, w * k, 14 * k, 4 * k); x.fill();
    x.fillStyle = '#e8b25c'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, (bx + w / 2) * k, (by + 7.5) * k);
  }
  c.style.width = c.style.height = '28px'; return c;
}
const im = new Image();
im.onload = () => document.getElementById('act').append(chromeAction(im, BADGE, 2, '#ffffff'));
im.src = 'file://%(icon)s';
"""

PUZZLE = ('<svg width="20" height="20" viewBox="0 -960 960 960" fill="#474747"><path d="M720-120H200q-33 0-56.5-23.5'
          'T120-200v-152q48 0 84-30.5t36-77.5q0-47-36-77.5T120-568v-152q0-33 23.5-56.5T200-800h160q0-42 29-71t71-29q42 0 '
          '71 29t29 71h160q33 0 56.5 23.5T800-720v160q42 0 71 29t29 71q0 42-29 71t-71 29v160q0 33-23.5 56.5T720-120Zm-520'
          '-80h520v-240h80q8 0 14-6t6-14q0-8-6-14t-14-6h-80v-240H480v-80q0-8-6-14t-14-6q-8 0-14 6t-6 14v80H200v88q54 20 87 '
          '67t33 105q0 57-33 104t-87 68v88Z"/></svg>')

# Окно Chrome (светлая тема по умолчанию: тулбар #ffffff) · страница слева · боковая панель справа.
# Заголовок боковой панели Chrome (там имя расширения) не рисуем: имя меняется, слова ждут имени.
BROWSER = """<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:#070606}
  .s{position:relative;width:1280px;height:800px;overflow:hidden;
     background:radial-gradient(ellipse 70%% 85%% at 80%% 48%%,#23180f 0%%,#110d0b 48%%,#070606 100%%)}
  .win{position:absolute;left:56px;top:52px;width:1168px;height:696px;border-radius:12px;overflow:hidden;background:#e9eaec;
       box-shadow:0 34px 90px rgba(0,0,0,.66),0 0 0 1px rgba(255,255,255,.05),80px 0 170px rgba(255,176,85,.20)}
  .hdr{height:40px;display:flex;align-items:flex-end;gap:8px;padding:0 12px}
  .dots{display:flex;gap:8px;align-self:center}.dots i{width:12px;height:12px;border-radius:50%%;display:block}
  .tab{margin-left:14px;height:32px;width:230px;border-radius:9px 9px 0 0;background:#ffffff;display:flex;align-items:center;gap:9px;padding:0 12px}
  .tab b{width:15px;height:15px;border-radius:4px;background:#d5d8de}.tab u{height:7px;width:120px;border-radius:4px;background:#d5d8de}
  .tbar{height:40px;background:#ffffff;display:flex;align-items:center;gap:6px;padding:0 10px}
  .nav{width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:#474747;font:17px system-ui}
  .omni{flex:1;height:32px;border-radius:16px;background:#eff1f5;margin:0 8px}
  .ico{width:34px;height:34px;display:flex;align-items:center;justify-content:center}
  .av{width:22px;height:22px;border-radius:50%%;background:#9fb6d9}
  .body{position:absolute;left:0;right:0;top:80px;bottom:0;background:#ffffff;display:flex;gap:8px;padding:0 8px 8px}
  .page{flex:1;border-radius:8px;background:#f6f7f9;border:1px solid #e6e8ec;padding:46px 56px}
  .ln{height:10px;border-radius:5px;background:#dfe2e8;margin-bottom:13px}.gap{height:22px}
  .h{height:22px;width:46%%;border-radius:6px;background:#c9ced8;margin-bottom:30px}
  .side{width:366px;height:608px;border-radius:8px;overflow:hidden;background:#0d0c0b}
  .side img{width:366px;height:608px;display:block}
</style>
<div class="s"><div class="win">
  <div class="hdr"><div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
    <div class="tab"><b></b><u></u></div></div>
  <div class="tbar"><div class="nav">&#8592;</div><div class="nav">&#8594;</div><div class="nav">&#8635;</div><div class="omni"></div>
    <div class="ico" id="act"></div><div class="ico">%(puzzle)s</div><div class="ico"><div class="av"></div></div>
    <div class="ico" style="color:#474747;font:bold 17px system-ui">&#8942;</div></div>
  <div class="body"><div class="page"><div class="h"></div>%(lines)s</div><div class="side"><img src="file://%(panel)s"></div></div>
</div></div>
<script>const BADGE = '%(badge)s';%(action)s</script>"""

LINES = "".join(("<div class='gap'></div>" if w == 0 else f"<div class='ln' style='width:{w}%'></div>")
                for w in [94, 88, 91, 72, 0, 90, 95, 83, 86, 64, 0, 92, 87, 93, 58, 0, 89, 91, 76])

# Панели крупно на тёплом поле — без окна браузера (канон 3.1: «отдельные элементы интерфейса»).
FIELD = """<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:#070606}
  .s{position:relative;width:1280px;height:800px;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:%(gap)spx;
     background:radial-gradient(ellipse 62%% 78%% at 50%% 46%%,#22170e 0%%,#100c0a 52%%,#070606 100%%)}
  .p{border-radius:10px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.62),0 0 0 1px rgba(255,255,255,.05)}
  .p img{display:block;width:%(pw)spx;height:%(ph)spx}
</style><div class="s">%(imgs)s</div>"""


def frame(n, key, page, badge=""):
    tmp = os.path.join(VARDIR, f"_2x-{n}.png")
    out = os.path.join(VARDIR, f"raw-{n}-{key}--{VARIANT}.png")
    shoot(page, 1280, 800, tmp, budget=2500)
    subprocess.run(["sips", "-z", "800", "1280", tmp, "--out", out], capture_output=True)
    os.remove(tmp)
    print("→", os.path.relpath(out, HERE), f"{os.path.getsize(out) // 1024} КБ")


def browser(panel_png, badge):
    return BROWSER % dict(puzzle=PUZZLE, lines=LINES, panel=panel_png, badge=badge,
                          action=ACTION_JS % dict(icon=os.path.join(EXT, "icons/32.png")))


def field(pngs, pw, ph, gap):
    imgs = "".join(f'<div class="p"><img src="file://{p}"></div>' for p in pngs)
    return FIELD % dict(imgs=imgs, pw=pw, ph=ph, gap=gap)


if __name__ == "__main__":
    if ONLY_PANEL:
        print("→", os.path.relpath(panel(ONLY_PANEL), HERE))
        sys.exit()
    want = lambda n: not ONLY or str(n) in ONLY
    if want(1):
        frame(1, "pokoj", browser(panel("pokoj"), ""))
    if want(2):
        frame(2, "rejs", browser(panel("rejs"), "19"))
    if want(3):
        frame(3, "presety", field([panel("presety")], 380, 760, 0))
    if want(4):
        frame(4, "cveta", field([panel(c) for c in ("brown", "pink", "white")], 342, 684, 44))
