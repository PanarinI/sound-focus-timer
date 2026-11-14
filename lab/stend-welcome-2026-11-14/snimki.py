#!/usr/bin/env python3
"""Снимки настоящей панели для режима «как пользоваться» на welcome (14.11).

Тот же закон, что у кадров стора («инструмент = явь», lab/graphics/shots/README.md): панель — настоящий
`extension/hearth.html` в headless-Chrome, управляется входами человека (дайл стрелками, клик по списку комнат,
Start), рейс перематывается сдвигом начала. Механику берём из `lab/graphics/shots/build-raw-shots.py`
(WRAP + shoot), своего не пишем. Звук не нужен: Chrome запускается с --mute-audio.

НЕ ЗАТИРАТЬ (правило автора 08-27): снимки ложатся рядом со стендом под именем варианта —
    python3 snimki.py            → snimok-<имя>--base.png
    python3 snimki.py v2         → snimok-<имя>--v2.png
В дело (на страницу) идёт копия без суффикса, сделанная после слова автора.
"""
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BRS = os.path.join(HERE, "..", "graphics", "shots", "build-raw-shots.py")
VARIANT = sys.argv[1] if len(sys.argv) > 1 else "base"

sys.argv = [BRS]                                   # их разбор аргументов не должен видеть наши
spec = importlib.util.spec_from_file_location("brs", BRS)
brs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(brs)                       # верх модуля — только константы; действия живут под __main__

MIN6 = 378   # 6′ 18″ прожито: на 25′ осталось 18′ 42″
PANELS = {
    "pokoj":   dict(size=(366, 608), steps=[]),                                  # первое открытие: open office, 15′
    "komnaty": dict(size=(366, 760), steps=["drop"]),                            # открыт список комнат
    "vremya":  dict(size=(366, 608), steps=["dial:25"]),                         # шкала на 25
    "rejs":    dict(size=(366, 608), steps=["dial:25", "start", f"shift:{MIN6}"]),  # 7-я минута рейса
}

for name, p in PANELS.items():
    w, h = p["size"]
    out = os.path.join(HERE, f"snimok-{name}--{VARIANT}.png")
    steps = "[" + ",".join(f'"{s}"' for s in p["steps"]) + "]"
    brs.shoot(brs.WRAP % dict(w=w, h=h, src=os.path.join(brs.EXT, "hearth.html"), steps=steps), w, h, out)
    print("→", os.path.basename(out), f"{os.path.getsize(out) // 1024} КБ")
