#!/usr/bin/env python3
"""Кадр листинга «где это живёт» 1280×800 — окно браузера, страница, панель справа.

Канон 3.1 просит для большого баннера ровно это: «берём скрин продукта… добавив вокруг UI браузера».
У нас его не было ни разу: панель висела в пустоте с подписью словами. Теперь видно без слов, что
это узкая полоса сбоку от работы, а не отдельное приложение.

Закон «инструмент = явь»: панель в кадре — РЕАЛЬНЫЙ `extension/hearth.html` в iframe, не рисунок.
Она стоит в покое, поэтому показывает то, что человек увидит первым: цифру завода и звезду.
Страница слева — нейтральный макет текста, ничей сайт не изображаем.
"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PANEL = "panel-now.png"   # панель снята отдельно (`_panelshot`): в композите iframe вешает Chrome
# НЕ ЗАТИРАТЬ (правило автора 08-27): прогон кладёт свой вариант в `variants/` под именем,
# а в дело идёт копия, сделанная руками после слова автора. Раньше каждый прогон писал поверх
# одного файла, и вернуться к принятой версии было некуда.
#     python3 build-home-shot.py <имя>      → variants/shot-home--<имя>.png
#     cp variants/shot-home--<имя>.png shot-home.png
VARIANT = (sys.argv[1] if len(sys.argv) > 1 else "base")
VARDIR = os.path.join(HERE, "variants")
os.makedirs(VARDIR, exist_ok=True)
OUT = os.path.join(VARDIR, f"shot-home--{VARIANT}.png")

lines = "".join(
    f"<div class='ln' style='width:{w}%'></div>" for w in
    [96, 88, 93, 74, 0, 91, 97, 82, 95, 68, 0, 90, 86, 94, 79])

HTML = """<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#05060f}
  .s{position:relative;width:1280px;height:800px;overflow:hidden;
     font-family:'SF Pro Display','Inter',system-ui,-apple-system,sans-serif;
     background:radial-gradient(ellipse 100%% 90%% at 50%% 34%%,#16204a 0%%,#0a0f26 58%%,#05060f 100%%)}
  /* Кадр был пресноватым: белая страница перетягивала взгляд, а панель — ради которой всё —
     тонула. Три поправки, все на фокус: свечение вокруг панели, тёплая кромка у стыка и
     приглушённая страница. В сцену ничего не добавлено, только перераспределён вес. */
  .win{position:absolute;left:56px;top:52px;width:1168px;height:696px;border-radius:14px;overflow:hidden;
     background:#fbfbfd;box-shadow:0 34px 90px rgba(0,0,0,.62),0 0 0 1px rgba(255,255,255,.06),52px 0 130px rgba(255,178,86,.34)}
  .bar{height:40px;background:#e8eaf0;display:flex;align-items:center;gap:7px;padding:0 13px}
  .dot{width:11px;height:11px;border-radius:50%%}
  .tab{margin-left:12px;height:26px;width:210px;border-radius:7px 7px 0 0;background:#eef0f6}
  .url{height:38px;background:#f2f3f7;display:flex;align-items:center;padding:0 14px;gap:10px}
  .pill{height:22px;flex:1;border-radius:11px;background:#fff;border:1px solid #dcdfe8}
  .body{display:flex;height:618px}
  .page{flex:1;padding:34px 40px;background:#eef0f6;position:relative}
  .page:after{content:'';position:absolute;right:0;top:0;bottom:0;width:230px;pointer-events:none;
     background:linear-gradient(to left,rgba(255,170,72,.20) 0%%,rgba(255,170,72,.07) 46%%,rgba(255,170,72,0) 100%%)}
  .h2{width:52%%;height:19px;border-radius:5px;background:#c9cede;margin-bottom:22px}
  .ln{height:9px;border-radius:5px;background:#dcdfe9;margin-bottom:11px}
  .ln[style*="width:0"]{background:transparent;margin-bottom:20px}
  .side{width:366px;border-left:1px solid rgba(255,196,120,.42);background:#05060f}
  /* панель вписана по ШИРИНЕ полосы и обрезана снизу — в окне браузера её низ уходит за край,
     ровно как в жизни: док виден, а всё остальное — небо */
  .side img{width:366px;display:block;object-fit:cover;object-position:50%% 100%%;height:618px}
  /* рамка панели: без неё стык страницы и неба выглядит обрубленным */
  .side{position:relative;box-shadow:inset 16px 0 46px rgba(255,178,86,.16),-16px 0 40px rgba(0,0,0,.42)}
  .hp{margin-bottom:20px;display:block}
  .capin{position:absolute;left:0;bottom:0;width:802px;padding:52px 56px 38px;box-sizing:border-box;
     background:linear-gradient(to top,rgba(8,10,24,.94) 46%%,rgba(8,10,24,0) 100%%);
     color:#FFF6E6;font-size:44px;font-weight:700;letter-spacing:-1.3px;line-height:1.06}
</style>
<div class="s">
  <div class="win">
    <div class="bar"><div class="dot" style="background:#ff5f57"></div><div class="dot" style="background:#febc2e"></div>
      <div class="dot" style="background:#28c840"></div><div class="tab"></div></div>
    <div class="url"><div class="pill"></div></div>
    <div class="body">
      <div class="page"><div class="h2"></div>%(lines)s</div>
      <div class="side"><img src="%(panel)s"></div>
    </div>
    <div class="capin">
      <svg class="hp" viewBox="0 0 48 48" width="50" height="50" fill="none" stroke="#FFC978"
           stroke-width="3.4" stroke-linecap="round">
        <path d="M9 30v-6a15 15 0 0 1 30 0v6"/>
        <rect x="4.5" y="27.5" width="10" height="15" rx="5" fill="#FFC978" stroke="none"/>
        <rect x="33.5" y="27.5" width="10" height="15" rx="5" fill="#FFC978" stroke="none"/>
      </svg>
      A focus timer<br>in your side panel</div>
  </div>

</div>
"""

p = os.path.join(HERE, "_home.html")
open(p, "w", encoding="utf-8").write(HTML % {"lines": lines, "panel": PANEL})
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=1", "--window-size=1280,800",
                "--virtual-time-budget=4000", f"--screenshot={OUT}", f"file://{p}"], capture_output=True)
os.remove(p)
print("→", OUT)
