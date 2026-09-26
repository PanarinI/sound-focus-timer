#!/usr/bin/env python3
"""Новый набор слайдов листинга 1280×800 — под новое ядро (25–26.09: ведёт звук, таймер не обязателен).

Формат стора только горизонтальный, а панель вертикальная — три приёма (план в dizajn/ZHURNAL.md):
«колонна» (одна панель крупно во всю высоту + строка о сути) · «ряд» (2–3 панели рядом, когда слайд
показывает разницу) · «браузер» (панель рядом со страницей — один раз, где это живёт).

Слайд 1 «колонна»: панель в рейсе БЕЗ КОНЦА (∞) — звук идёт, отсчёта нет, шкалы нет: ровно новое ядро.
Панель — настоящая `extension/hearth.html`, снятая build-raw-shots.py теми же входами человека (∞, Start),
в тройном разрешении — на слайде она крупнее, чем в жизни (канон 3.1: элемент интерфейса, увеличенный).
Строка слева до выбора имени — временная: заголовок swap2 «Warm brown noise, designed for focus».

Слайд 2 «список крупно» (слово автора: «под разные случаи есть разные варианты — грамотная точка сборки
для демонстрации фичи»). Настоящая панель с открытым списком комнат — ровно то, что человек увидит, выбирая:
шесть ситуаций читаются одним взглядом, ручки под списком показывают, как звук встал под выбранную
(café: розовый шум — розовеет и свет, и ручки). В кадре участок от света звезды до ручек, вдвое крупнее —
названия читаются и на слайде, уменьшенном вдвое (памятка Google). Края растворены в поле — наезд, не вырезка.
Шкала-«спидометр» для комнат отклонена автором: шкала в панели значит время (dizajn/ZHURNAL.md 26.09).
Своих слов на слайде нет: подписи ждут имени.

НЕ ЗАТИРАТЬ (правило автора 08-27): variants/nabor-<n>-<ключ>--<вариант>.png; в дело — копия после слова.
    python3 build-nabor.py            → оба слайда, вариант base
    python3 build-nabor.py 2 v2       → только слайд 2, вариант v2
"""
import importlib.util, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[1:]
ONLY = {a for a in ARGS if a.isdigit()}
VARIANT = next((a for a in ARGS if not a.isdigit() and a not in ("k", "kk")), "base")

spec = importlib.util.spec_from_file_location("raw", os.path.join(HERE, "build-raw-shots.py"))
raw = importlib.util.module_from_spec(spec)
sys.argv = [sys.argv[0]]                      # у build-raw-shots свои аргументы — не путаем с нашими
spec.loader.exec_module(raw)
raw.VARIANT = VARIANT

# панель под «колонну»: композиция 360×660 целиком, по 10 px поля сверху и снизу; ∞ → рейс
raw.PANELS["kolonna"] = dict(size=(380, 680), steps=["inf", "start"], dpr=3)
raw.PANELS["spisok"] = dict(size=(380, 680), steps=["preset:cafe", "inf", "start", "drop"], dpr=4)
PANEL_H = 752                                  # на слайде: по 24 px воздуха сверху и снизу
PANEL_W = round(380 * PANEL_H / 680)

KOLONNA = """<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:#080706}
  .s{position:relative;width:1280px;height:800px;overflow:hidden;
     background:radial-gradient(ellipse 58%% 78%% at 74%% 34%%,#2a1c10 0%%,#130e0b 52%%,#080706 100%%)}
  .txt{position:absolute;left:96px;top:50%%;transform:translateY(-50%%);width:620px;
     font-family:'SF Pro Display','Inter',system-ui,-apple-system,sans-serif;
     color:#FFF6E6;font-size:64px;font-weight:700;letter-spacing:-1.8px;line-height:1.04}
  .p{position:absolute;right:92px;top:%(top)spx;width:%(pw)spx;height:%(ph)spx;border-radius:11px;overflow:hidden;
     box-shadow:0 30px 90px rgba(0,0,0,.62),0 0 0 1px rgba(255,255,255,.05)}
  .p img{display:block;width:%(pw)spx;height:%(ph)spx}
</style>
<div class="s">
  <div class="txt">%(line)s</div>
  <div class="p"><img src="file://%(panel)s"></div>
</div>"""


def kolonna():
    png = raw.panel("kolonna")
    tmp = os.path.join(raw.VARDIR, "_2x-nabor-1.png")
    out = os.path.join(raw.VARDIR, f"nabor-1-kolonna--{VARIANT}.png")
    page = KOLONNA % dict(top=(800 - PANEL_H) // 2, pw=PANEL_W, ph=PANEL_H, panel=png,
                          line="Warm brown noise,<br>designed for focus")
    raw.shoot(page, 1280, 800, tmp, budget=2500)
    subprocess.run(["sips", "-z", "800", "1280", tmp, "--out", out], capture_output=True)
    os.remove(tmp)
    print("→", os.path.relpath(out, HERE), f"{os.path.getsize(out) // 1024} КБ")


# ── СЛАЙД 2: список крупно ────────────────────────────────────────────────────────
# участок панели (координаты снимка 380×680, замерено по кадру): ширина композиции 10…370; по высоте —
# от центра звезды (218) до ручек: список 299…487, кнопка 490…522, ручки 556…591. Растворение краёв
# (сверху 18 %, снизу с 90 %) не должно задевать ни пункта списка, ни ручек — отсюда 212…638 и ×1,87.
UCH_X, UCH_Y, UCH_W, UCH_H, ZOOM = 10, 212, 360, 426, 1.87

SPISOK = """<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:#080706}
  .s{position:relative;width:1280px;height:800px;overflow:hidden;
     background:radial-gradient(ellipse 58%% 78%% at 70%% 30%%,#26191b 0%%,#120d0c 52%%,#080706 100%%)}
  .z{position:absolute;right:72px;top:%(top)spx;width:%(w)spx;height:%(h)spx;overflow:hidden;
     /* края растворены: сверху — свет звезды уходит вверх, снизу и по бокам короче */
     -webkit-mask-image:linear-gradient(to bottom,transparent 0%%,#000 18%%,#000 90%%,transparent 100%%),
                        linear-gradient(to right,transparent 0%%,#000 10%%,#000 90%%,transparent 100%%);
     -webkit-mask-composite:source-in;
     mask-image:linear-gradient(to bottom,transparent 0%%,#000 18%%,#000 90%%,transparent 100%%),
                linear-gradient(to right,transparent 0%%,#000 10%%,#000 90%%,transparent 100%%);
     mask-composite:intersect}
  .z img{position:absolute;left:%(ix)spx;top:%(iy)spx;width:%(iw)spx;height:%(ih)spx}
</style>
<div class="s"><div class="z"><img src="file://%(panel)s"></div></div>"""


def spisok():
    png = raw.panel("spisok")
    tmp = os.path.join(raw.VARDIR, "_2x-nabor-2.png")
    out = os.path.join(raw.VARDIR, f"nabor-2-spisok--{VARIANT}.png")
    w, h = round(UCH_W * ZOOM), round(UCH_H * ZOOM)
    page = SPISOK % dict(top=(800 - h) // 2, w=w, h=h, ix=round(-UCH_X * ZOOM), iy=round(-UCH_Y * ZOOM),
                         iw=round(380 * ZOOM), ih=round(680 * ZOOM), panel=png)
    raw.shoot(page, 1280, 800, tmp, budget=2500)
    subprocess.run(["sips", "-z", "800", "1280", tmp, "--out", out], capture_output=True)
    os.remove(tmp)
    print("→", os.path.relpath(out, HERE), f"{os.path.getsize(out) // 1024} КБ")



# ── СЛАЙД 3: без рекламы, живёт рядом с работой ───────────────────────────────────
# Скелет принят автором 26.09 («давай третий слайд»): главная растущая боль из таблиц ключей —
# `brown noise no ads` 2 900/мес, +719 % за три года, мы там №1. Канон 3.1: скрин продукта в UI браузера.
# Окно браузера — то же, что у сырых кадров (build-raw-shots.py): страница слева, панель справа в рейсе
# на 25′ (7-я минута, бейдж «19» на иконке). Заголовок — на странице, как в любимом автором swap2.
#   A — чисто: заголовок, подпись, мягкое кольцо у иконки с бейджем (звук идёт и при закрытой панели)
#   B — то же + дуги звука от звезды через страницу (мотив swap2)
raw.PANELS["noads"] = dict(size=(366, 608), steps=["dial:25", "start", f"shift:{raw.MIN6}"], dpr=3)
_home = open(os.path.join(HERE, "build-home-shot.py"), encoding="utf-8").read()
ARCS = _home[_home.index('ARCS = """') + 9:_home.index('"""', _home.index('ARCS = """') + 9)]
# центр звезды в окне: полоса панели x 794 (1168 − 8 − 366), тело окна с y 80; звезда композиции 360×660
# в полосе 366×608 ужата в 608/660: x 183 + 3·k, y 208·k
_K = 608 / 660
STAR_X, STAR_Y = 794 + 183 + 3 * _K, 80 + 208 * _K

NOADS_EXTRA_CSS = """
  .ph{color:#1b2440;font-size:58px;font-weight:700;letter-spacing:-1.4px;line-height:1.06;margin:4px 0 16px}
  .psub{color:#9a6a1c;font-size:25px;font-weight:600;letter-spacing:-.2px;margin:0 0 44px}
  .page{font-family:'SF Pro Display','Inter',system-ui,-apple-system,sans-serif}
  .quote{max-width:560px;border-left:4px solid #E0A03C;padding:2px 0 2px 22px;margin:0 0 38px}
  .qt{color:#243050;font-size:31px;font-weight:600;line-height:1.22;letter-spacing:-.5px}
  .qa{color:#7b869e;font-size:16px;font-weight:600;margin-top:11px}
"""


def noads(arcs, quote=False, sub=''):
    png = raw.panel("noads")
    page = raw.browser(png, "19")
    page = page.replace("</style>", NOADS_EXTRA_CSS.replace("%%", "%") + "</style>", 1)
    # подпись «Close the panel — it keeps playing» снята словом автора 26.09 («смотри, это машина, у неё открывается
    # капот»): она про устройство, а не про то, что человек получает. Кольцо у иконки подпирало её — снято вместе.
    head = "<div class='ph'>Brown noise.<br>No ads.</div>"
    if sub:
        head += f"<div class='psub'>{sub}</div>"
    else:
        head = head.replace("class='ph'", "class='ph' style='margin-bottom:40px'")
    if quote:   # голос 4 (ГОЛОСА.md, 27.08); канал не записан, поэтому «from a user», не «review»
        head += ("<div class='quote'><div class='qt'>“It silenced the chaos in my head.”</div>"
                 "<div class='qa'>from a user</div></div>")
    page = page.replace("<div class=\"page\"><div class=\"h\"></div>", "<div class=\"page\">" + head, 1)
    if arcs:
        svg = (f"<svg width='1168' height='696' viewBox='0 0 1168 696' style='position:absolute;left:0;top:0;"
               f"pointer-events:none;z-index:3'><g transform='translate({STAR_X - 985:.1f},{STAR_Y - 257:.1f})'>{ARCS}</g></svg>")
        page = page.replace("<div class=\"body\">", svg + "<div class=\"body\">", 1)
    key = ("b-dugi" if arcs else "a-chisto") + ("-citata" if quote else "") + ("-podpis" if sub else "")
    tmp = os.path.join(raw.VARDIR, f"_2x-nabor-3{key}.png")
    out = os.path.join(raw.VARDIR, f"nabor-3-noads-{key}--{VARIANT}.png")
    raw.shoot(page, 1280, 800, tmp, budget=3000)
    subprocess.run(["sips", "-z", "800", "1280", tmp, "--out", out], capture_output=True)
    os.remove(tmp)
    print("→", os.path.relpath(out, HERE), f"{os.path.getsize(out) // 1024} КБ")


# ── СЛАЙД 1 «КОКОН» (идея автора 26.09: «первый слайд, может и в нарушение канона, но про суть») ──────────
# Сцена — заказ у генератора (../gen_kokon.py, эскизы gen/kokon-*.png). Кодом доводим сам кокон нашим языком:
# в панели зерно = видимый шум, маскировка = слой, затягивающий поле. Поэтому дальше от экрана — гуще зерно
# и мягче размытие (шум стирает комнату), у экрана — чисто. Центр кокона — ноутбук (доли кадра cx, cy).
KOKON = """<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:#080706}
  .s{position:relative;width:1280px;height:800px;overflow:hidden}
  .s img{position:absolute;left:0;top:0;width:1280px;height:800px;object-fit:cover;object-position:50%% 55%%}
  .blur{filter:blur(%(blur)spx) brightness(.86);
        -webkit-mask-image:radial-gradient(ellipse %(rx)s%% %(ry)s%% at %(cx)s%% %(cy)s%%,transparent 38%%,#000 100%%);
        mask-image:radial-gradient(ellipse %(rx)s%% %(ry)s%% at %(cx)s%% %(cy)s%%,transparent 38%%,#000 100%%)}
  canvas{position:absolute;left:0;top:0;width:1280px;height:800px;mix-blend-mode:screen;opacity:%(gr)s;
        -webkit-mask-image:radial-gradient(ellipse %(rx)s%% %(ry)s%% at %(cx)s%% %(cy)s%%,transparent 30%%,#000 95%%);
        mask-image:radial-gradient(ellipse %(rx)s%% %(ry)s%% at %(cx)s%% %(cy)s%%,transparent 30%%,#000 95%%)}
  .cap{position:absolute;%(cappos)s;color:#fbf2e4;font:700 62px/1.04 'SF Pro Display','Inter',system-ui,-apple-system,sans-serif;
       letter-spacing:-1.4px;text-shadow:0 2px 22px rgba(20,10,4,.55),0 0 2px rgba(20,10,4,.35)}
</style><div class="s"><img src="file://%(src)s"><img class="blur" src="file://%(src)s"><canvas id="z" width="640" height="400"></canvas>
<div class="cap">%(cap)s</div></div>
<script>
// зерно — как в панели (hearth.js kadr): тёплый оттенок коричневого шума, крупинка 2 px кадра
const c = document.getElementById('z'), x = c.getContext('2d'), im = x.createImageData(640, 400), d = im.data;
for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 150; d[i] = v; d[i+1] = v * .78; d[i+2] = v * .52; d[i+3] = 255; }
x.putImageData(im, 0, 0);
</script>"""


def kokon(src, cx, cy, key, rx=46, ry=52, blur=5, gr=.55, cap="", cappos="left:84px;bottom:78px"):
    page = KOKON % dict(src=os.path.join(HERE, "..", "gen", src), cx=cx, cy=cy, rx=rx, ry=ry, blur=blur, gr=gr, cap=cap,
                        cappos=cappos)
    tmp = os.path.join(raw.VARDIR, f"_2x-nabor-1{key}.png")
    out = os.path.join(raw.VARDIR, f"nabor-1-kokon-{key}--{VARIANT}.png")
    raw.shoot(page, 1280, 800, tmp, budget=2500)
    subprocess.run(["sips", "-z", "800", "1280", tmp, "--out", out], capture_output=True)
    os.remove(tmp)
    print("→", os.path.relpath(out, HERE), f"{os.path.getsize(out) // 1024} КБ")


# ── СЛАЙД 2 «КОЛОННА С КОМНАТАМИ» (слово автора 27.09: «на 2-м слайде уже должен появиться интерфейс…
# но тогда мы теряем фокус пресетов — можем не терять?») ─────────────────────────────────────────────
# Колонна (вся панель крупно) + открытый список комнат: интерфейс целиком и пресеты в фокусе одним кадром.
raw.PANELS["kol-kafe"] = dict(size=(380, 680), steps=["preset:cafe", "inf", "start", "drop"], dpr=3)
raw.PANELS["kol-ofis"] = dict(size=(380, 680), steps=["preset:office", "inf", "start", "drop"], dpr=3)


def kolonna_komnaty(panel_key, key, line):
    png = raw.panel(panel_key)
    tmp = os.path.join(raw.VARDIR, f"_2x-nabor-2k{key}.png")
    out = os.path.join(raw.VARDIR, f"nabor-2-kolonna-komnaty-{key}--{VARIANT}.png")
    page = KOLONNA % dict(top=(800 - PANEL_H) // 2, pw=PANEL_W, ph=PANEL_H, panel=png, line=line)
    raw.shoot(page, 1280, 800, tmp, budget=2500)
    subprocess.run(["sips", "-z", "800", "1280", tmp, "--out", out], capture_output=True)
    os.remove(tmp)
    print("→", os.path.relpath(out, HERE), f"{os.path.getsize(out) // 1024} КБ")

if __name__ == "__main__":
    if "kk" in ARGS:       # только колонна с комнатами: python3 build-nabor.py kk <вариант>
        kolonna_komnaty("kol-kafe", "kafe", "A sound<br>for every room.")
        kolonna_komnaty("kol-ofis", "ofis", "A sound<br>for every room.")
        sys.exit()
    if "k" in ARGS:        # только кокон: python3 build-nabor.py k <вариант>
        # голова в экран (слово автора 26.09) + подпись, выбранная автором
        kokon("kokon-zhenshchina-v12.png", 57, 50, "zhenshchina", rx=52, ry=64, cap="Your quiet corner,<br>anywhere.")
        kokon("kokon-zhenshchina-v12.png", 57, 50, "zhenshchina-sprava", rx=52, ry=64, cap="Your quiet corner,<br>anywhere.",
              cappos="right:84px;top:74px;text-align:right")
        sys.exit()
    if not ONLY or "1" in ONLY:
        kolonna()
    if not ONLY or "2" in ONLY:
        spisok()
    if not ONLY or "3" in ONLY:
        noads(True, quote=True)
        noads(True, quote=True, sub="Nothing breaks your focus.")
